import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const STORAGE_BUCKET = 'project-images';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

const views = {
  loading: document.getElementById('loading-view'),
  login: document.getElementById('login-view'),
  dashboard: document.getElementById('dashboard-view'),
  groupForm: document.getElementById('group-form-view'),
  projectForm: document.getElementById('project-form-view'),
  unauthorized: document.getElementById('unauthorized-view'),
  configError: document.getElementById('config-error-view'),
};

const elements = {
  loginForm: document.getElementById('login-form'),
  loginButton: document.getElementById('login-button'),
  loginMessage: document.getElementById('login-message'),
  logoutButtons: document.querySelectorAll('[data-logout]'),
  dashboardMessage: document.getElementById('dashboard-message'),
  adminUser: document.getElementById('admin-user'),
  groupList: document.getElementById('group-list'),
  groupCount: document.getElementById('group-count'),
  projectList: document.getElementById('project-list'),
  projectCount: document.getElementById('project-count'),
  groupForm: document.getElementById('group-form'),
  groupFormTitle: document.getElementById('group-form-title'),
  groupFormMessage: document.getElementById('group-form-message'),
  groupDescription: document.getElementById('group-description'),
  groupDescriptionCount: document.getElementById('group-description-count'),
  saveGroupButton: document.getElementById('save-group-button'),
  projectForm: document.getElementById('project-form'),
  projectFormTitle: document.getElementById('project-form-title'),
  projectFormMessage: document.getElementById('project-form-message'),
  projectTitle: document.getElementById('project-title'),
  projectSlug: document.getElementById('project-slug'),
  projectGroup: document.getElementById('project-group'),
  projectSummary: document.getElementById('project-summary'),
  projectSummaryCount: document.getElementById('project-summary-count'),
  coverInput: document.getElementById('cover-image'),
  coverPreview: document.getElementById('cover-preview'),
  galleryInput: document.getElementById('gallery-images'),
  galleryPreview: document.getElementById('gallery-preview'),
  tags: document.getElementById('project-tags'),
  statusNote: document.getElementById('project-status-note'),
  configErrorMessage: document.getElementById('config-error-message'),
};

const state = {
  groups: [],
  projects: [],
  currentProject: null,
  coverSignedUrl: '',
  pendingCover: null,
  removeCover: false,
  existingGallery: [],
  removedGallery: [],
  pendingGallery: [],
  objectUrls: [],
  slugManuallyEdited: false,
  sessionVersion: 0,
};

let supabase;

function showOnly(viewName) {
  Object.entries(views).forEach(([name, element]) => {
    if (element) element.hidden = name !== viewName;
  });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function setMessage(element, message = '', isError = false) {
  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle('admin-message--error', Boolean(message) && isError);
}

function formatError(error, fallback) {
  if (error?.code === '23505') return 'That slug is already in use. Choose a unique slug.';
  if (error?.code === '23503') return 'This Project Group cannot be deleted while it contains Projects.';
  return error?.message || fallback;
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function createButton(label, className, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', handler);
  return button;
}

function createEmptyRow(message, columns = 1) {
  if (columns === 1) {
    const div = document.createElement('div');
    div.className = 'empty-row';
    div.textContent = message;
    return div;
  }

  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = columns;
  cell.className = 'empty-row';
  cell.textContent = message;
  row.append(cell);
  return row;
}

async function loadConfig() {
  const response = await fetch('/api/admin-config', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Missing or invalid Supabase environment variables.');

  const config = await response.json();
  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    throw new Error('Missing or invalid Supabase environment variables.');
  }
  return config;
}

async function handleSession(session) {
  const version = ++state.sessionVersion;
  setMessage(elements.loginMessage);
  setMessage(elements.dashboardMessage);

  if (!session?.user) {
    elements.adminUser.textContent = '';
    elements.loginForm.reset();
    showOnly('login');
    return;
  }

  showOnly('loading');
  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (version !== state.sessionVersion) return;
  if (error) {
    elements.configErrorMessage.textContent = formatError(error, 'Admin authorization could not be verified.');
    showOnly('configError');
    return;
  }
  if (!data) {
    showOnly('unauthorized');
    return;
  }

  elements.adminUser.textContent = session.user.email || 'Authenticated administrator';
  showOnly('dashboard');
  await loadDashboard();
}

async function initializeAdmin() {
  try {
    const config = await loadConfig();
    supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => handleSession(session), 0);
    });

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    await handleSession(data.session);
  } catch (error) {
    elements.configErrorMessage.textContent = formatError(error, 'The authentication service could not be configured.');
    showOnly('configError');
  }
}

async function loadDashboard(successMessage = '') {
  setMessage(elements.dashboardMessage, 'Loading content…');
  const [groupsResult, projectsResult] = await Promise.all([
    supabase.from('project_groups').select('*').order('name'),
    supabase
      .from('projects')
      .select('id,title,slug,status,project_group_id,cover_image_path,updated_at,project_groups(name)')
      .order('updated_at', { ascending: false }),
  ]);

  if (groupsResult.error || projectsResult.error) {
    setMessage(
      elements.dashboardMessage,
      formatError(groupsResult.error || projectsResult.error, 'Content could not be loaded.'),
      true,
    );
    return;
  }

  state.groups = groupsResult.data || [];
  state.projects = projectsResult.data || [];
  renderGroups();
  renderProjects();
  setMessage(elements.dashboardMessage, successMessage);
}

function renderGroups() {
  elements.groupList.replaceChildren();
  elements.groupCount.textContent = String(state.groups.length);
  if (!state.groups.length) {
    elements.groupList.append(createEmptyRow('No Project Groups yet. Create one before adding a Project.'));
    return;
  }

  state.groups.forEach((group) => {
    const row = document.createElement('article');
    row.className = 'group-row';
    const content = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = group.name;
    const description = document.createElement('p');
    description.textContent = group.short_description || 'No description';
    content.append(title, description);

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.append(
      createButton('Edit', 'button-secondary button-small', () => openGroupForm(group)),
      createButton('Delete', 'button-danger button-small', () => deleteGroup(group)),
    );
    row.append(content, actions);
    elements.groupList.append(row);
  });
}

function renderProjects() {
  elements.projectList.replaceChildren();
  elements.projectCount.textContent = String(state.projects.length);
  if (!state.projects.length) {
    elements.projectList.append(createEmptyRow('No Projects yet.', 4));
    return;
  }

  state.projects.forEach((project) => {
    const row = document.createElement('tr');
    const titleCell = document.createElement('td');
    const title = document.createElement('strong');
    title.textContent = project.title;
    const slug = document.createElement('div');
    slug.className = 'field-help';
    slug.textContent = project.slug;
    titleCell.append(title, slug);

    const groupCell = document.createElement('td');
    groupCell.textContent = project.project_groups?.name || 'Unknown group';
    const statusCell = document.createElement('td');
    const status = document.createElement('span');
    status.className = `status-badge status-badge--${project.status}`;
    status.textContent = project.status;
    statusCell.append(status);

    const actionsCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.append(
      createButton('Edit', 'button-secondary button-small', () => openProjectForm(project.id)),
      createButton('Delete', 'button-danger button-small', () => deleteProject(project)),
    );
    actionsCell.append(actions);
    row.append(titleCell, groupCell, statusCell, actionsCell);
    elements.projectList.append(row);
  });
}

function openGroupForm(group = null) {
  elements.groupForm.reset();
  setMessage(elements.groupFormMessage);
  document.getElementById('group-id').value = group?.id || '';
  document.getElementById('group-name').value = group?.name || '';
  elements.groupDescription.value = group?.short_description || '';
  elements.groupDescriptionCount.textContent = String(elements.groupDescription.value.length);
  elements.groupFormTitle.textContent = group ? 'Edit Project Group' : 'New Project Group';
  showOnly('groupForm');
  document.getElementById('group-name').focus();
}

async function saveGroup(event) {
  event.preventDefault();
  setMessage(elements.groupFormMessage);
  elements.saveGroupButton.disabled = true;

  const formData = new FormData(elements.groupForm);
  const id = String(formData.get('id') || '');
  const values = {
    name: String(formData.get('name') || '').trim(),
    short_description: String(formData.get('short_description') || '').trim(),
  };

  try {
    const query = id
      ? supabase.from('project_groups').update(values).eq('id', id)
      : supabase.from('project_groups').insert(values);
    const { error } = await query;
    if (error) throw error;
    showOnly('dashboard');
    await loadDashboard(id ? 'Project Group updated.' : 'Project Group created.');
  } catch (error) {
    setMessage(elements.groupFormMessage, formatError(error, 'Project Group could not be saved.'), true);
  } finally {
    elements.saveGroupButton.disabled = false;
  }
}

async function deleteGroup(group) {
  if (!window.confirm(`Delete the Project Group “${group.name}”?`)) return;
  setMessage(elements.dashboardMessage, 'Deleting Project Group…');
  const { error } = await supabase.from('project_groups').delete().eq('id', group.id);
  if (error) {
    setMessage(elements.dashboardMessage, formatError(error, 'Project Group could not be deleted.'), true);
    return;
  }
  await loadDashboard('Project Group deleted.');
}

function cleanupObjectUrls() {
  state.objectUrls.forEach(({ url }) => URL.revokeObjectURL(url));
  state.objectUrls = [];
}

function objectUrl(file) {
  const existing = state.objectUrls.find((entry) => entry.file === file);
  if (existing) return existing.url;
  const url = URL.createObjectURL(file);
  state.objectUrls.push({ file, url });
  return url;
}

function resetProjectMediaState() {
  cleanupObjectUrls();
  state.coverSignedUrl = '';
  state.pendingCover = null;
  state.removeCover = false;
  state.existingGallery = [];
  state.removedGallery = [];
  state.pendingGallery = [];
  elements.coverInput.value = '';
  elements.galleryInput.value = '';
  elements.coverPreview.replaceChildren();
  elements.galleryPreview.replaceChildren();
}

function populateGroupSelect(selectedId = '') {
  elements.projectGroup.replaceChildren();
  const prompt = document.createElement('option');
  prompt.value = '';
  prompt.textContent = 'Select a Project Group';
  elements.projectGroup.append(prompt);
  state.groups.forEach((group) => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.name;
    option.selected = group.id === selectedId;
    elements.projectGroup.append(option);
  });
}

async function signedUrl(path) {
  if (!path) return '';
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

async function openProjectForm(projectId = null) {
  if (!state.groups.length) {
    setMessage(elements.dashboardMessage, 'Create a Project Group before creating a Project.', true);
    return;
  }

  elements.projectForm.reset();
  resetProjectMediaState();
  setMessage(elements.projectFormMessage);
  state.currentProject = null;
  state.slugManuallyEdited = Boolean(projectId);
  ['overview-editor', 'challenge-editor', 'work-editor'].forEach((id) => {
    document.getElementById(id).innerHTML = '';
  });

  if (!projectId) {
    elements.projectFormTitle.textContent = 'New Project';
    elements.statusNote.textContent = 'Choose whether to save this project as a draft or publish it.';
    populateGroupSelect();
    updateProjectCounters();
    showOnly('projectForm');
    elements.projectTitle.focus();
    return;
  }

  showOnly('loading');
  const [projectResult, tagsResult, galleryResult] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('project_tags').select('tags(name)').eq('project_id', projectId),
    supabase.from('project_gallery_images').select('*').eq('project_id', projectId).order('sort_order'),
  ]);

  const error = projectResult.error || tagsResult.error || galleryResult.error;
  if (error) {
    showOnly('dashboard');
    setMessage(elements.dashboardMessage, formatError(error, 'Project could not be loaded.'), true);
    return;
  }

  const project = projectResult.data;
  state.currentProject = project;
  state.existingGallery = galleryResult.data || [];
  elements.projectFormTitle.textContent = 'Edit Project';
  document.getElementById('project-id').value = project.id;
  elements.projectTitle.value = project.title;
  elements.projectSlug.value = project.slug;
  populateGroupSelect(project.project_group_id);
  elements.projectSummary.value = project.short_summary || '';
  document.getElementById('overview-editor').innerHTML = sanitizeRichText(project.overview_html || '');
  document.getElementById('challenge-editor').innerHTML = sanitizeRichText(project.challenge_html || '');
  document.getElementById('work-editor').innerHTML = sanitizeRichText(project.what_we_did_html || '');
  elements.tags.value = (tagsResult.data || []).map((row) => row.tags?.name).filter(Boolean).join(', ');
  elements.statusNote.textContent = `Current status: ${project.status}. Choose an action below.`;
  updateProjectCounters();

  try {
    const urls = await Promise.all([
      signedUrl(project.cover_image_path),
      ...state.existingGallery.map((image) => signedUrl(image.storage_path)),
    ]);
    state.coverSignedUrl = urls[0];
    state.existingGallery = state.existingGallery.map((image, index) => ({ ...image, signedUrl: urls[index + 1] }));
  } catch (error) {
    setMessage(elements.projectFormMessage, formatError(error, 'Some image previews could not be loaded.'), true);
  }

  renderCoverPreview();
  renderGalleryPreview();
  showOnly('projectForm');
}

function previewCard(src, label, removeHandler) {
  const card = document.createElement('article');
  card.className = 'preview-card';
  const image = document.createElement('img');
  image.src = src;
  image.alt = '';
  const remove = createButton('Remove', 'button-small', removeHandler);
  remove.setAttribute('aria-label', `Remove ${label}`);
  const caption = document.createElement('p');
  caption.className = 'preview-card__label';
  caption.textContent = label;
  card.append(image, remove, caption);
  return card;
}

function renderCoverPreview() {
  elements.coverPreview.replaceChildren();
  if (state.pendingCover) {
    elements.coverPreview.append(previewCard(objectUrl(state.pendingCover), state.pendingCover.name, () => {
      state.pendingCover = null;
      elements.coverInput.value = '';
      renderCoverPreview();
    }));
    return;
  }
  if (state.currentProject?.cover_image_path && !state.removeCover && state.coverSignedUrl) {
    elements.coverPreview.append(previewCard(state.coverSignedUrl, 'Current cover image', () => {
      state.removeCover = true;
      renderCoverPreview();
    }));
  }
}

function renderGalleryPreview() {
  elements.galleryPreview.replaceChildren();
  state.existingGallery
    .filter((image) => !state.removedGallery.some((removed) => removed.id === image.id))
    .forEach((image, index) => {
      elements.galleryPreview.append(previewCard(image.signedUrl, `Gallery image ${index + 1}`, () => {
        state.removedGallery.push(image);
        renderGalleryPreview();
      }));
    });

  state.pendingGallery.forEach((file, index) => {
    elements.galleryPreview.append(previewCard(objectUrl(file), file.name, () => {
      state.pendingGallery.splice(index, 1);
      renderGalleryPreview();
    }));
  });
}

function validateImage(file) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error(`${file.name} is not a supported image type.`);
  if (file.size > MAX_IMAGE_SIZE) throw new Error(`${file.name} is larger than 10 MB.`);
}

function fileExtension(file) {
  const known = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
  return known[file.type];
}

async function uploadImage(projectId, area, file) {
  validateImage(file);
  const path = `${projectId}/${area}/${crypto.randomUUID()}.${fileExtension(file)}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

function normalizedTags(rawTags) {
  const bySlug = new Map();
  rawTags.split(',').forEach((raw) => {
    const name = raw.trim();
    const slug = slugify(name);
    if (name && slug && !bySlug.has(slug)) bySlug.set(slug, { name, slug });
  });
  return [...bySlug.values()];
}

async function saveProjectTags(projectId, tagValues) {
  const { error: deleteError } = await supabase.from('project_tags').delete().eq('project_id', projectId);
  if (deleteError) throw deleteError;
  if (!tagValues.length) return;

  const { data: tags, error: tagError } = await supabase
    .from('tags')
    .upsert(tagValues, { onConflict: 'slug' })
    .select('id');
  if (tagError) throw tagError;

  const { error: joinError } = await supabase
    .from('project_tags')
    .insert(tags.map((tag) => ({ project_id: projectId, tag_id: tag.id })));
  if (joinError) throw joinError;
}

async function saveProject(event) {
  event.preventDefault();
  const requestedStatus = event.submitter?.dataset.projectStatus;
  if (!requestedStatus) return;
  setMessage(elements.projectFormMessage);

  const submitButtons = elements.projectForm.querySelectorAll('button[type="submit"]');
  submitButtons.forEach((button) => { button.disabled = true; });
  const formData = new FormData(elements.projectForm);
  const existingId = String(formData.get('id') || '');
  const projectId = existingId || crypto.randomUUID();
  const oldCoverPath = state.currentProject?.cover_image_path || '';

  const values = {
    id: projectId,
    title: String(formData.get('title') || '').trim(),
    slug: slugify(String(formData.get('slug') || '')),
    project_group_id: String(formData.get('project_group_id') || ''),
    short_summary: String(formData.get('short_summary') || '').trim(),
    cover_image_path: state.removeCover && !state.pendingCover ? null : oldCoverPath || null,
    overview_html: sanitizeRichText(document.getElementById('overview-editor').innerHTML),
    challenge_html: sanitizeRichText(document.getElementById('challenge-editor').innerHTML),
    what_we_did_html: sanitizeRichText(document.getElementById('work-editor').innerHTML),
    status: requestedStatus,
  };
  elements.projectSlug.value = values.slug;

  try {
    if (!values.title || !values.slug || !values.project_group_id) {
      throw new Error('Title, slug, and Project Group are required.');
    }

    const saveResult = existingId
      ? await supabase.from('projects').update(values).eq('id', projectId).select().single()
      : await supabase.from('projects').insert(values).select().single();
    if (saveResult.error) throw saveResult.error;
    state.currentProject = saveResult.data;

    await saveProjectTags(projectId, normalizedTags(String(formData.get('tags') || '')));

    if (state.pendingCover) {
      const newCoverPath = await uploadImage(projectId, 'cover', state.pendingCover);
      const { error } = await supabase.from('projects').update({ cover_image_path: newCoverPath }).eq('id', projectId);
      if (error) {
        await supabase.storage.from(STORAGE_BUCKET).remove([newCoverPath]);
        throw error;
      }
      state.currentProject.cover_image_path = newCoverPath;
      state.pendingCover = null;
      if (oldCoverPath) await supabase.storage.from(STORAGE_BUCKET).remove([oldCoverPath]);
    } else if (state.removeCover && oldCoverPath) {
      const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([oldCoverPath]);
      if (error) throw error;
      state.currentProject.cover_image_path = null;
    }

    if (state.removedGallery.length) {
      const removedIds = state.removedGallery.map((image) => image.id);
      const removedPaths = state.removedGallery.map((image) => image.storage_path);
      const { error: rowsError } = await supabase.from('project_gallery_images').delete().in('id', removedIds);
      if (rowsError) throw rowsError;
      const { error: filesError } = await supabase.storage.from(STORAGE_BUCKET).remove(removedPaths);
      if (filesError) throw filesError;
      state.existingGallery = state.existingGallery.filter((image) => !removedIds.includes(image.id));
      state.removedGallery = [];
    }

    let nextOrder = state.existingGallery.length;
    while (state.pendingGallery.length) {
      const file = state.pendingGallery[0];
      const path = await uploadImage(projectId, 'gallery', file);
      const { error } = await supabase.from('project_gallery_images').insert({
        project_id: projectId,
        storage_path: path,
        sort_order: nextOrder,
      });
      if (error) {
        await supabase.storage.from(STORAGE_BUCKET).remove([path]);
        throw error;
      }
      state.pendingGallery.shift();
      nextOrder += 1;
    }

    resetProjectMediaState();
    showOnly('dashboard');
    await loadDashboard(requestedStatus === 'published' ? 'Project published.' : 'Project saved as Draft.');
  } catch (error) {
    setMessage(elements.projectFormMessage, formatError(error, 'Project could not be saved.'), true);
  } finally {
    submitButtons.forEach((button) => { button.disabled = false; });
  }
}

async function deleteProject(project) {
  if (!window.confirm(`Delete the Project “${project.title}”? This also removes its uploaded images.`)) return;
  setMessage(elements.dashboardMessage, 'Deleting Project…');

  const { data: gallery, error: galleryError } = await supabase
    .from('project_gallery_images')
    .select('storage_path')
    .eq('project_id', project.id);
  if (galleryError) {
    setMessage(elements.dashboardMessage, formatError(galleryError, 'Project images could not be checked.'), true);
    return;
  }

  const { error: deleteError } = await supabase.from('projects').delete().eq('id', project.id);
  if (deleteError) {
    setMessage(elements.dashboardMessage, formatError(deleteError, 'Project could not be deleted.'), true);
    return;
  }

  const paths = [project.cover_image_path, ...(gallery || []).map((image) => image.storage_path)].filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
    if (storageError) {
      await loadDashboard('Project deleted, but some stored images could not be removed.');
      setMessage(elements.dashboardMessage, 'Project deleted, but some stored images could not be removed.', true);
      return;
    }
  }
  await loadDashboard('Project deleted.');
}

function sanitizeRichText(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const allowedTags = new Set(['P', 'BR', 'STRONG', 'EM', 'B', 'I', 'A', 'UL', 'OL', 'LI']);

  [...template.content.querySelectorAll('*')].forEach((element) => {
    if (element.tagName === 'DIV') {
      const paragraph = document.createElement('p');
      paragraph.append(...element.childNodes);
      element.replaceWith(paragraph);
      element = paragraph;
    }

    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }

    const originalHref = element.tagName === 'A' ? element.getAttribute('href') : null;
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
    if (element.tagName === 'A') {
      if (!originalHref) return;
      try {
        const url = new URL(originalHref, window.location.origin);
        if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new Error('Invalid link');
        element.setAttribute('href', originalHref);
        element.setAttribute('rel', 'noopener noreferrer');
      } catch {
        element.replaceWith(...element.childNodes);
      }
    }
  });
  return template.innerHTML.trim();
}

function setupRichEditors() {
  const template = document.getElementById('rich-toolbar-template');
  document.querySelectorAll('.rich-editor').forEach((wrapper) => {
    const editor = document.getElementById(wrapper.dataset.editor);
    const toolbar = wrapper.querySelector('.rich-toolbar');
    toolbar.append(template.content.cloneNode(true));
    toolbar.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-command]');
      if (!button) return;
      event.preventDefault();
      editor.focus();
      const command = button.dataset.command;
      if (command === 'createLink') {
        const url = window.prompt('Enter a link URL (https://… or mailto:…):');
        if (url) document.execCommand(command, false, url);
      } else {
        document.execCommand(command, false);
      }
    });
  });
}

function updateProjectCounters() {
  elements.projectSummaryCount.textContent = String(elements.projectSummary.value.length);
}

async function logout() {
  elements.logoutButtons.forEach((button) => { button.disabled = true; });
  const { error } = await supabase.auth.signOut();
  elements.logoutButtons.forEach((button) => { button.disabled = false; });
  if (error) {
    setMessage(elements.dashboardMessage, formatError(error, 'Logout failed.'), true);
  }
}

elements.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(elements.loginMessage);
  elements.loginButton.disabled = true;
  elements.loginButton.textContent = 'Logging in…';
  const formData = new FormData(elements.loginForm);
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: String(formData.get('email') || '').trim(),
      password: String(formData.get('password') || ''),
    });
    if (error) throw error;
  } catch (error) {
    setMessage(elements.loginMessage, formatError(error, 'Login failed.'), true);
  } finally {
    elements.loginButton.disabled = false;
    elements.loginButton.textContent = 'Log in';
  }
});

elements.logoutButtons.forEach((button) => button.addEventListener('click', logout));
document.getElementById('new-group-button').addEventListener('click', () => openGroupForm());
document.getElementById('new-project-button').addEventListener('click', () => openProjectForm());
document.querySelectorAll('[data-cancel-form]').forEach((button) => {
  button.addEventListener('click', () => {
    resetProjectMediaState();
    showOnly('dashboard');
  });
});
elements.groupForm.addEventListener('submit', saveGroup);
elements.projectForm.addEventListener('submit', saveProject);
elements.groupDescription.addEventListener('input', () => {
  elements.groupDescriptionCount.textContent = String(elements.groupDescription.value.length);
});
elements.projectSummary.addEventListener('input', updateProjectCounters);
elements.projectTitle.addEventListener('input', () => {
  if (!state.slugManuallyEdited) elements.projectSlug.value = slugify(elements.projectTitle.value);
});
elements.projectSlug.addEventListener('input', () => {
  state.slugManuallyEdited = true;
  elements.projectSlug.value = elements.projectSlug.value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-{2,}/g, '-');
});
elements.projectSlug.addEventListener('blur', () => {
  elements.projectSlug.value = slugify(elements.projectSlug.value);
});
elements.coverInput.addEventListener('change', () => {
  try {
    const file = elements.coverInput.files[0];
    if (!file) return;
    validateImage(file);
    state.pendingCover = file;
    state.removeCover = false;
    renderCoverPreview();
    setMessage(elements.projectFormMessage);
  } catch (error) {
    elements.coverInput.value = '';
    setMessage(elements.projectFormMessage, error.message, true);
  }
});
elements.galleryInput.addEventListener('change', () => {
  try {
    const files = [...elements.galleryInput.files];
    files.forEach(validateImage);
    state.pendingGallery.push(...files);
    elements.galleryInput.value = '';
    renderGalleryPreview();
    setMessage(elements.projectFormMessage);
  } catch (error) {
    elements.galleryInput.value = '';
    setMessage(elements.projectFormMessage, error.message, true);
  }
});

setupRichEditors();
initializeAdmin();

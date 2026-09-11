import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const STORAGE_BUCKET = 'project-images';
const NEWS_STORAGE_BUCKET = 'news-images';
const GAME_STORAGE_BUCKET = 'game-images';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const DRAFT_DATABASE = 'ripplegames-admin';
const DRAFT_STORE = 'project-drafts';
const NEWS_DRAFT_STORE = 'news-drafts';
const ACTIVE_DRAFT_KEY = 'ripplegames-admin-active-draft';

const views = {
  loading: document.getElementById('loading-view'),
  login: document.getElementById('login-view'),
  dashboard: document.getElementById('dashboard-view'),
  groupForm: document.getElementById('group-form-view'),
  gameForm: document.getElementById('game-form-view'),
  projectForm: document.getElementById('project-form-view'),
  newsForm: document.getElementById('news-form-view'),
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
  gameList: document.getElementById('game-list'),
  gameCount: document.getElementById('game-count'),
  newsList: document.getElementById('news-list'),
  newsCount: document.getElementById('news-count'),
  groupForm: document.getElementById('group-form'),
  groupFormTitle: document.getElementById('group-form-title'),
  groupFormMessage: document.getElementById('group-form-message'),
  groupDescription: document.getElementById('group-description'),
  groupDescriptionCount: document.getElementById('group-description-count'),
  saveGroupButton: document.getElementById('save-group-button'),
  gameForm: document.getElementById('game-form'),
  gameFormTitle: document.getElementById('game-form-title'),
  gameFormMessage: document.getElementById('game-form-message'),
  gameTitle: document.getElementById('game-title'),
  gameSlug: document.getElementById('game-slug'),
  gamePlayableUrl: document.getElementById('game-playable-url'),
  gameCoverInput: document.getElementById('game-cover-image'),
  gameCoverPreview: document.getElementById('game-cover-preview'),
  gameTags: document.getElementById('game-tags'),
  gameStatusNote: document.getElementById('game-status-note'),
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
  projectGames: document.getElementById('project-games'),
  statusNote: document.getElementById('project-status-note'),
  newsForm: document.getElementById('news-form'),
  newsFormTitle: document.getElementById('news-form-title'),
  newsFormMessage: document.getElementById('news-form-message'),
  newsTitle: document.getElementById('news-title'),
  newsSlug: document.getElementById('news-slug'),
  newsDate: document.getElementById('news-date'),
  newsSummary: document.getElementById('news-summary'),
  newsSummaryCount: document.getElementById('news-summary-count'),
  newsCoverInput: document.getElementById('news-cover-image'),
  newsCoverPreview: document.getElementById('news-cover-preview'),
  newsGalleryInput: document.getElementById('news-gallery-images'),
  newsGalleryPreview: document.getElementById('news-gallery-preview'),
  newsTags: document.getElementById('news-tags'),
  newsProjects: document.getElementById('news-projects'),
  newsGames: document.getElementById('news-games'),
  newsStatusNote: document.getElementById('news-status-note'),
  configErrorMessage: document.getElementById('config-error-message'),
};

const state = {
  groups: [],
  games: [],
  projects: [],
  newsPosts: [],
  currentProject: null,
  coverSignedUrl: '',
  pendingCover: null,
  removeCover: false,
  existingGallery: [],
  removedGallery: [],
  pendingGallery: [],
  objectUrls: [],
  slugManuallyEdited: false,
  currentNews: null,
  newsCoverSignedUrl: '',
  pendingNewsCover: null,
  removeNewsCover: false,
  existingNewsGallery: [],
  removedNewsGallery: [],
  pendingNewsGallery: [],
  newsObjectUrls: [],
  newsSlugManuallyEdited: false,
  currentGame: null,
  gameCoverSignedUrl: '',
  pendingGameCover: null,
  removeGameCover: false,
  gameObjectUrls: [],
  gameSlugManuallyEdited: false,
  sessionVersion: 0,
  authorizedUserId: '',
};

let supabase;
let draftDatabasePromise;
let draftSaveTimer;
let newsDraftSaveTimer;

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

function openDraftDatabase() {
  if (!draftDatabasePromise) {
    draftDatabasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DRAFT_DATABASE, 2);
      request.addEventListener('upgradeneeded', () => {
        if (!request.result.objectStoreNames.contains(DRAFT_STORE)) {
          request.result.createObjectStore(DRAFT_STORE);
        }
        if (!request.result.objectStoreNames.contains(NEWS_DRAFT_STORE)) {
          request.result.createObjectStore(NEWS_DRAFT_STORE);
        }
      });
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error));
    });
  }
  return draftDatabasePromise;
}

async function readProjectDraft(userId) {
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(DRAFT_STORE, 'readonly').objectStore(DRAFT_STORE).get(userId);
    request.addEventListener('success', () => resolve(request.result || null));
    request.addEventListener('error', () => reject(request.error));
  });
}

async function writeProjectDraft(userId, draft) {
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(DRAFT_STORE, 'readwrite').objectStore(DRAFT_STORE).put(draft, userId);
    request.addEventListener('success', () => resolve());
    request.addEventListener('error', () => reject(request.error));
  });
}

async function clearProjectDraft() {
  window.clearTimeout(draftSaveTimer);
  if (!state.authorizedUserId) return;
  try {
    const database = await openDraftDatabase();
    await new Promise((resolve, reject) => {
      const request = database.transaction(DRAFT_STORE, 'readwrite').objectStore(DRAFT_STORE).delete(state.authorizedUserId);
      request.addEventListener('success', () => resolve());
      request.addEventListener('error', () => reject(request.error));
    });
    if (window.localStorage.getItem(ACTIVE_DRAFT_KEY) === 'project') {
      window.localStorage.removeItem(ACTIVE_DRAFT_KEY);
    }
  } catch (error) {
    console.warn('The local Project draft could not be cleared.', error);
  }
}

function captureProjectDraft() {
  return {
    projectId: document.getElementById('project-id').value || null,
    title: elements.projectTitle.value,
    slug: elements.projectSlug.value,
    projectGroupId: elements.projectGroup.value,
    shortSummary: elements.projectSummary.value,
    overviewHtml: sanitizeRichText(document.getElementById('overview-editor').innerHTML),
    challengeHtml: sanitizeRichText(document.getElementById('challenge-editor').innerHTML),
    whatWeDidHtml: sanitizeRichText(document.getElementById('work-editor').innerHTML),
    tags: elements.tags.value,
    gameIds: [...elements.projectGames.querySelectorAll('input:checked')].map((input) => input.value),
    pendingCover: state.pendingCover,
    removeCover: state.removeCover,
    pendingGallery: state.pendingGallery,
    removedGalleryIds: state.removedGallery.map((image) => image.id),
    slugManuallyEdited: state.slugManuallyEdited,
    savedAt: new Date().toISOString(),
  };
}

async function persistProjectDraft() {
  if (!state.authorizedUserId || views.projectForm.hidden) return;
  try {
    await writeProjectDraft(state.authorizedUserId, captureProjectDraft());
    window.localStorage.setItem(ACTIVE_DRAFT_KEY, 'project');
  } catch (error) {
    console.warn('The local Project draft could not be saved.', error);
  }
}

function scheduleProjectDraftSave() {
  window.clearTimeout(draftSaveTimer);
  draftSaveTimer = window.setTimeout(persistProjectDraft, 300);
}

async function readNewsDraft(userId) {
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(NEWS_DRAFT_STORE, 'readonly').objectStore(NEWS_DRAFT_STORE).get(userId);
    request.addEventListener('success', () => resolve(request.result || null));
    request.addEventListener('error', () => reject(request.error));
  });
}

async function writeNewsDraft(userId, draft) {
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(NEWS_DRAFT_STORE, 'readwrite').objectStore(NEWS_DRAFT_STORE).put(draft, userId);
    request.addEventListener('success', () => resolve());
    request.addEventListener('error', () => reject(request.error));
  });
}

async function clearNewsDraft() {
  window.clearTimeout(newsDraftSaveTimer);
  if (!state.authorizedUserId) return;
  try {
    const database = await openDraftDatabase();
    await new Promise((resolve, reject) => {
      const request = database.transaction(NEWS_DRAFT_STORE, 'readwrite').objectStore(NEWS_DRAFT_STORE).delete(state.authorizedUserId);
      request.addEventListener('success', () => resolve());
      request.addEventListener('error', () => reject(request.error));
    });
    if (window.localStorage.getItem(ACTIVE_DRAFT_KEY) === 'news') {
      window.localStorage.removeItem(ACTIVE_DRAFT_KEY);
    }
  } catch (error) {
    console.warn('The local News draft could not be cleared.', error);
  }
}

function captureNewsDraft() {
  return {
    newsId: document.getElementById('news-id').value || null,
    title: elements.newsTitle.value,
    slug: elements.newsSlug.value,
    newsDate: elements.newsDate.value,
    shortSummary: elements.newsSummary.value,
    bodyHtml: sanitizeRichText(document.getElementById('news-body-editor').innerHTML),
    tags: elements.newsTags.value,
    projectIds: [...elements.newsProjects.querySelectorAll('input:checked')].map((input) => input.value),
    gameIds: [...elements.newsGames.querySelectorAll('input:checked')].map((input) => input.value),
    pendingCover: state.pendingNewsCover,
    removeCover: state.removeNewsCover,
    pendingGallery: state.pendingNewsGallery,
    removedGalleryIds: state.removedNewsGallery.map((image) => image.id),
    slugManuallyEdited: state.newsSlugManuallyEdited,
    savedAt: new Date().toISOString(),
  };
}

async function persistNewsDraft() {
  if (!state.authorizedUserId || views.newsForm.hidden) return;
  try {
    await writeNewsDraft(state.authorizedUserId, captureNewsDraft());
    window.localStorage.setItem(ACTIVE_DRAFT_KEY, 'news');
  } catch (error) {
    console.warn('The local News draft could not be saved.', error);
  }
}

function scheduleNewsDraftSave() {
  window.clearTimeout(newsDraftSaveTimer);
  newsDraftSaveTimer = window.setTimeout(persistNewsDraft, 300);
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
    state.authorizedUserId = '';
    elements.adminUser.textContent = '';
    elements.loginForm.reset();
    showOnly('login');
    return;
  }

  const preserveOpenView = state.authorizedUserId === session.user.id
    && (!views.projectForm.hidden || !views.groupForm.hidden || !views.newsForm.hidden || !views.gameForm.hidden);
  if (!preserveOpenView) showOnly('loading');
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
    state.authorizedUserId = '';
    showOnly('unauthorized');
    return;
  }

  state.authorizedUserId = session.user.id;
  elements.adminUser.textContent = session.user.email || 'Authenticated administrator';
  if (preserveOpenView) return;

  await loadDashboard();
  const restoredDraft = await restoreAdminDraft();
  if (!restoredDraft) showOnly('dashboard');
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
  const [groupsResult, projectsResult, newsResult, gamesResult] = await Promise.all([
    supabase.from('project_groups').select('*').order('name'),
    supabase
      .from('projects')
      .select('id,title,slug,status,project_group_id,cover_image_path,updated_at,project_groups(name)')
      .order('updated_at', { ascending: false }),
    supabase
      .from('news_posts')
      .select('id,title,slug,news_date,status,cover_image_path,updated_at,news_projects(project_id)')
      .order('news_date', { ascending: false }),
    supabase
      .from('games')
      .select('id,title,slug,playable_url,is_active,cover_image_path,updated_at')
      .order('updated_at', { ascending: false }),
  ]);

  if (groupsResult.error || projectsResult.error || newsResult.error || gamesResult.error) {
    setMessage(
      elements.dashboardMessage,
      formatError(groupsResult.error || projectsResult.error || newsResult.error || gamesResult.error, 'Content could not be loaded.'),
      true,
    );
    return;
  }

  state.groups = groupsResult.data || [];
  state.projects = projectsResult.data || [];
  state.newsPosts = newsResult.data || [];
  state.games = gamesResult.data || [];
  renderGroups();
  renderGames();
  renderProjects();
  renderNews();
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

function renderGames() {
  elements.gameList.replaceChildren();
  elements.gameCount.textContent = String(state.games.length);
  if (!state.games.length) {
    elements.gameList.append(createEmptyRow('No Games yet.', 4));
    return;
  }

  state.games.forEach((game) => {
    const row = document.createElement('tr');
    const titleCell = document.createElement('td');
    const title = document.createElement('strong');
    title.textContent = game.title;
    const slug = document.createElement('div');
    slug.className = 'field-help';
    slug.textContent = game.slug;
    titleCell.append(title, slug);

    const urlCell = document.createElement('td');
    urlCell.textContent = game.playable_url;
    const statusCell = document.createElement('td');
    const status = document.createElement('span');
    status.className = `status-badge status-badge--${game.is_active ? 'active' : 'inactive'}`;
    status.textContent = game.is_active ? 'Active' : 'Inactive';
    statusCell.append(status);

    const actionsCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.append(
      createButton('Edit', 'button-secondary button-small', () => openGameForm(game.id)),
      createButton('Delete', 'button-danger button-small', () => deleteGame(game)),
    );
    actionsCell.append(actions);
    row.append(titleCell, urlCell, statusCell, actionsCell);
    elements.gameList.append(row);
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

function renderNews() {
  elements.newsList.replaceChildren();
  elements.newsCount.textContent = String(state.newsPosts.length);
  if (!state.newsPosts.length) {
    elements.newsList.append(createEmptyRow('No News posts yet.', 5));
    return;
  }

  state.newsPosts.forEach((post) => {
    const row = document.createElement('tr');
    const titleCell = document.createElement('td');
    const title = document.createElement('strong');
    title.textContent = post.title;
    const slug = document.createElement('div');
    slug.className = 'field-help';
    slug.textContent = post.slug;
    titleCell.append(title, slug);

    const dateCell = document.createElement('td');
    dateCell.textContent = post.news_date;
    const projectsCell = document.createElement('td');
    const linkedCount = post.news_projects?.length || 0;
    projectsCell.textContent = linkedCount ? `${linkedCount} linked` : 'None';
    const statusCell = document.createElement('td');
    const status = document.createElement('span');
    status.className = `status-badge status-badge--${post.status}`;
    status.textContent = post.status;
    statusCell.append(status);

    const actionsCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.append(
      createButton('Edit', 'button-secondary button-small', () => openNewsForm(post.id)),
      createButton('Delete', 'button-danger button-small', () => deleteNews(post)),
    );
    actionsCell.append(actions);
    row.append(titleCell, dateCell, projectsCell, statusCell, actionsCell);
    elements.newsList.append(row);
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

function resetGameMediaState() {
  state.gameObjectUrls.forEach(({ url }) => URL.revokeObjectURL(url));
  state.gameObjectUrls = [];
  state.gameCoverSignedUrl = '';
  state.pendingGameCover = null;
  state.removeGameCover = false;
  elements.gameCoverInput.value = '';
  elements.gameCoverPreview.replaceChildren();
}

function gameObjectUrl(file) {
  const existing = state.gameObjectUrls.find((entry) => entry.file === file);
  if (existing) return existing.url;
  const url = URL.createObjectURL(file);
  state.gameObjectUrls.push({ file, url });
  return url;
}

function renderGameCoverPreview() {
  elements.gameCoverPreview.replaceChildren();
  if (state.pendingGameCover) {
    elements.gameCoverPreview.append(previewCard(gameObjectUrl(state.pendingGameCover), state.pendingGameCover.name, () => {
      state.pendingGameCover = null;
      elements.gameCoverInput.value = '';
      renderGameCoverPreview();
    }));
    return;
  }
  if (state.currentGame?.cover_image_path && !state.removeGameCover && state.gameCoverSignedUrl) {
    elements.gameCoverPreview.append(previewCard(state.gameCoverSignedUrl, 'Current cover image', () => {
      state.removeGameCover = true;
      renderGameCoverPreview();
    }));
  }
}

async function openGameForm(gameId = null) {
  elements.gameForm.reset();
  resetGameMediaState();
  setMessage(elements.gameFormMessage);
  state.currentGame = null;
  state.gameSlugManuallyEdited = Boolean(gameId);

  if (!gameId) {
    elements.gameFormTitle.textContent = 'New Game';
    elements.gameStatusNote.textContent = 'Choose whether to save this Game as inactive or make it active.';
    showOnly('gameForm');
    elements.gameTitle.focus();
    return;
  }

  showOnly('loading');
  const [gameResult, tagsResult] = await Promise.all([
    supabase.from('games').select('*').eq('id', gameId).single(),
    supabase.from('game_tags').select('tags(name)').eq('game_id', gameId),
  ]);
  const error = gameResult.error || tagsResult.error;
  if (error) {
    showOnly('dashboard');
    setMessage(elements.dashboardMessage, formatError(error, 'Game could not be loaded.'), true);
    return;
  }

  const game = gameResult.data;
  state.currentGame = game;
  elements.gameFormTitle.textContent = 'Edit Game';
  document.getElementById('game-id').value = game.id;
  elements.gameTitle.value = game.title;
  elements.gameSlug.value = game.slug;
  elements.gamePlayableUrl.value = game.playable_url;
  elements.gameTags.value = (tagsResult.data || []).map((row) => row.tags?.name).filter(Boolean).join(', ');
  elements.gameStatusNote.textContent = `Current status: ${game.is_active ? 'active' : 'inactive'}. Choose an action below.`;

  try {
    state.gameCoverSignedUrl = await signedUrl(game.cover_image_path, GAME_STORAGE_BUCKET);
  } catch (error) {
    setMessage(elements.gameFormMessage, formatError(error, 'The cover image preview could not be loaded.'), true);
  }
  renderGameCoverPreview();
  showOnly('gameForm');
}

async function saveGameTags(gameId, tagValues) {
  const { error: deleteError } = await supabase.from('game_tags').delete().eq('game_id', gameId);
  if (deleteError) throw deleteError;
  if (!tagValues.length) return;

  const { data: tags, error: tagError } = await supabase
    .from('tags')
    .upsert(tagValues, { onConflict: 'slug' })
    .select('id');
  if (tagError) throw tagError;
  const { error: joinError } = await supabase
    .from('game_tags')
    .insert(tags.map((tag) => ({ game_id: gameId, tag_id: tag.id })));
  if (joinError) throw joinError;
}

async function saveGame(event) {
  event.preventDefault();
  const requestedActive = event.submitter?.dataset.gameActive;
  if (requestedActive === undefined) return;
  setMessage(elements.gameFormMessage);

  const submitButtons = elements.gameForm.querySelectorAll('button[type="submit"]');
  submitButtons.forEach((button) => { button.disabled = true; });
  const formData = new FormData(elements.gameForm);
  const existingId = String(formData.get('id') || '');
  const gameId = existingId || crypto.randomUUID();
  const oldCoverPath = state.currentGame?.cover_image_path || '';
  const values = {
    id: gameId,
    title: String(formData.get('title') || '').trim(),
    slug: slugify(String(formData.get('slug') || '')),
    playable_url: String(formData.get('playable_url') || '').trim(),
    cover_image_path: state.removeGameCover && !state.pendingGameCover ? null : oldCoverPath || null,
    is_active: requestedActive === 'true',
  };
  elements.gameSlug.value = values.slug;

  try {
    if (!values.title || !values.slug || !values.playable_url) {
      throw new Error('Title, slug, and playable URL/route are required.');
    }
    const saveResult = existingId
      ? await supabase.from('games').update(values).eq('id', gameId).select().single()
      : await supabase.from('games').insert(values).select().single();
    if (saveResult.error) throw saveResult.error;
    state.currentGame = saveResult.data;
    document.getElementById('game-id').value = gameId;

    await saveGameTags(gameId, normalizedTags(String(formData.get('tags') || '')));

    if (state.pendingGameCover) {
      const newCoverPath = await uploadImage(gameId, 'cover', state.pendingGameCover, GAME_STORAGE_BUCKET);
      const { error } = await supabase.from('games').update({ cover_image_path: newCoverPath }).eq('id', gameId);
      if (error) {
        await supabase.storage.from(GAME_STORAGE_BUCKET).remove([newCoverPath]);
        throw error;
      }
      state.currentGame.cover_image_path = newCoverPath;
      state.pendingGameCover = null;
      if (oldCoverPath) await supabase.storage.from(GAME_STORAGE_BUCKET).remove([oldCoverPath]);
    } else if (state.removeGameCover && oldCoverPath) {
      const { error } = await supabase.storage.from(GAME_STORAGE_BUCKET).remove([oldCoverPath]);
      if (error) throw error;
      state.currentGame.cover_image_path = null;
    }

    resetGameMediaState();
    showOnly('dashboard');
    await loadDashboard(values.is_active ? 'Game activated.' : 'Game saved as inactive.');
  } catch (error) {
    setMessage(elements.gameFormMessage, formatError(error, 'Game could not be saved.'), true);
  } finally {
    submitButtons.forEach((button) => { button.disabled = false; });
  }
}

async function deleteGame(game) {
  if (!window.confirm(`Delete the Game “${game.title}”? This also removes its cover image.`)) return;
  setMessage(elements.dashboardMessage, 'Deleting Game…');
  const { error: deleteError } = await supabase.from('games').delete().eq('id', game.id);
  if (deleteError) {
    setMessage(elements.dashboardMessage, formatError(deleteError, 'Game could not be deleted.'), true);
    return;
  }
  if (game.cover_image_path) {
    const { error: storageError } = await supabase.storage.from(GAME_STORAGE_BUCKET).remove([game.cover_image_path]);
    if (storageError) {
      await loadDashboard('Game deleted, but its stored cover image could not be removed.');
      setMessage(elements.dashboardMessage, 'Game deleted, but its stored cover image could not be removed.', true);
      return;
    }
  }
  await loadDashboard('Game deleted.');
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

function populateGameSelector(container, inputName, selectedIds = []) {
  const selected = new Set(selectedIds);
  container.replaceChildren();
  if (!state.games.length) {
    const message = document.createElement('p');
    message.className = 'field-help';
    message.textContent = 'No Games are available. Create a Game in the registry first.';
    container.append(message);
    return;
  }

  state.games.forEach((game) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = inputName;
    checkbox.value = game.id;
    checkbox.checked = selected.has(game.id);
    const text = document.createElement('span');
    text.textContent = game.is_active ? game.title : `${game.title} (inactive)`;
    label.append(checkbox, text);
    container.append(label);
  });
}

async function signedUrl(path, bucket = STORAGE_BUCKET) {
  if (!path) return '';
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

async function openProjectForm(projectId = null, { persistDraft = true } = {}) {
  if (!state.groups.length) {
    setMessage(elements.dashboardMessage, 'Create a Project Group before creating a Project.', true);
    return false;
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
    populateGameSelector(elements.projectGames, 'game_ids');
    updateProjectCounters();
    showOnly('projectForm');
    elements.projectTitle.focus();
    if (persistDraft) await persistProjectDraft();
    return true;
  }

  showOnly('loading');
  const [projectResult, tagsResult, galleryResult, gamesResult] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('project_tags').select('tags(name)').eq('project_id', projectId),
    supabase.from('project_gallery_images').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('project_games').select('game_id').eq('project_id', projectId),
  ]);

  const error = projectResult.error || tagsResult.error || galleryResult.error || gamesResult.error;
  if (error) {
    showOnly('dashboard');
    setMessage(elements.dashboardMessage, formatError(error, 'Project could not be loaded.'), true);
    return false;
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
  populateGameSelector(elements.projectGames, 'game_ids', (gamesResult.data || []).map((row) => row.game_id));
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
  if (persistDraft) await persistProjectDraft();
  return true;
}

async function restoreProjectDraft() {
  let draft;
  try {
    draft = await readProjectDraft(state.authorizedUserId);
  } catch (error) {
    console.warn('The local Project draft could not be read.', error);
    return false;
  }
  if (!draft) return false;

  const opened = await openProjectForm(draft.projectId, { persistDraft: false });
  if (!opened) {
    await clearProjectDraft();
    return false;
  }

  elements.projectTitle.value = draft.title || '';
  elements.projectSlug.value = draft.slug || '';
  elements.projectGroup.value = draft.projectGroupId || '';
  elements.projectSummary.value = draft.shortSummary || '';
  document.getElementById('overview-editor').innerHTML = sanitizeRichText(draft.overviewHtml || '');
  document.getElementById('challenge-editor').innerHTML = sanitizeRichText(draft.challengeHtml || '');
  document.getElementById('work-editor').innerHTML = sanitizeRichText(draft.whatWeDidHtml || '');
  elements.tags.value = draft.tags || '';
  populateGameSelector(elements.projectGames, 'game_ids', Array.isArray(draft.gameIds) ? draft.gameIds : []);
  state.pendingCover = draft.pendingCover || null;
  state.removeCover = Boolean(draft.removeCover);
  state.pendingGallery = Array.isArray(draft.pendingGallery) ? draft.pendingGallery : [];
  state.removedGallery = state.existingGallery.filter((image) =>
    (draft.removedGalleryIds || []).includes(image.id));
  state.slugManuallyEdited = Boolean(draft.slugManuallyEdited);
  updateProjectCounters();
  renderCoverPreview();
  renderGalleryPreview();
  setMessage(elements.projectFormMessage, 'Unsaved local changes restored.');
  window.localStorage.setItem(ACTIVE_DRAFT_KEY, 'project');
  return true;
}

async function restoreAdminDraft() {
  const activeDraft = window.localStorage.getItem(ACTIVE_DRAFT_KEY);
  if (activeDraft === 'news') return (await restoreNewsDraft()) || restoreProjectDraft();
  if (activeDraft === 'project') return (await restoreProjectDraft()) || restoreNewsDraft();
  return (await restoreProjectDraft()) || restoreNewsDraft();
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
      scheduleProjectDraftSave();
    }));
    return;
  }
  if (state.currentProject?.cover_image_path && !state.removeCover && state.coverSignedUrl) {
    elements.coverPreview.append(previewCard(state.coverSignedUrl, 'Current cover image', () => {
      state.removeCover = true;
      renderCoverPreview();
      scheduleProjectDraftSave();
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
        scheduleProjectDraftSave();
      }));
    });

  state.pendingGallery.forEach((file, index) => {
      elements.galleryPreview.append(previewCard(objectUrl(file), file.name, () => {
        state.pendingGallery.splice(index, 1);
        renderGalleryPreview();
        scheduleProjectDraftSave();
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

async function uploadImage(projectId, area, file, bucket = STORAGE_BUCKET) {
  validateImage(file);
  const path = `${projectId}/${area}/${crypto.randomUUID()}.${fileExtension(file)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
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

async function saveLinkedGames(table, foreignKey, contentId, gameIds) {
  const { error: deleteError } = await supabase.from(table).delete().eq(foreignKey, contentId);
  if (deleteError) throw deleteError;
  if (!gameIds.length) return;
  const { error: insertError } = await supabase
    .from(table)
    .insert(gameIds.map((gameId) => ({ [foreignKey]: contentId, game_id: gameId })));
  if (insertError) throw insertError;
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
    await saveLinkedGames('project_games', 'project_id', projectId, formData.getAll('game_ids').map(String));

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

    await clearProjectDraft();
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

function localDateValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function resetNewsMediaState() {
  state.newsObjectUrls.forEach(({ url }) => URL.revokeObjectURL(url));
  state.newsObjectUrls = [];
  state.newsCoverSignedUrl = '';
  state.pendingNewsCover = null;
  state.removeNewsCover = false;
  state.existingNewsGallery = [];
  state.removedNewsGallery = [];
  state.pendingNewsGallery = [];
  elements.newsCoverInput.value = '';
  elements.newsGalleryInput.value = '';
  elements.newsCoverPreview.replaceChildren();
  elements.newsGalleryPreview.replaceChildren();
}

function newsObjectUrl(file) {
  const existing = state.newsObjectUrls.find((entry) => entry.file === file);
  if (existing) return existing.url;
  const url = URL.createObjectURL(file);
  state.newsObjectUrls.push({ file, url });
  return url;
}

function populateNewsProjects(selectedIds = []) {
  const selected = new Set(selectedIds);
  elements.newsProjects.replaceChildren();
  if (!state.projects.length) {
    const message = document.createElement('p');
    message.className = 'field-help';
    message.textContent = 'No Projects are available.';
    elements.newsProjects.append(message);
    return;
  }

  state.projects.forEach((project) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'project_ids';
    checkbox.value = project.id;
    checkbox.checked = selected.has(project.id);
    const text = document.createElement('span');
    text.textContent = project.title;
    label.append(checkbox, text);
    elements.newsProjects.append(label);
  });
}

function renderNewsCoverPreview() {
  elements.newsCoverPreview.replaceChildren();
  if (state.pendingNewsCover) {
    elements.newsCoverPreview.append(previewCard(newsObjectUrl(state.pendingNewsCover), state.pendingNewsCover.name, () => {
      state.pendingNewsCover = null;
      elements.newsCoverInput.value = '';
      renderNewsCoverPreview();
      scheduleNewsDraftSave();
    }));
    return;
  }
  if (state.currentNews?.cover_image_path && !state.removeNewsCover && state.newsCoverSignedUrl) {
    elements.newsCoverPreview.append(previewCard(state.newsCoverSignedUrl, 'Current cover image', () => {
      state.removeNewsCover = true;
      renderNewsCoverPreview();
      scheduleNewsDraftSave();
    }));
  }
}

function renderNewsGalleryPreview() {
  elements.newsGalleryPreview.replaceChildren();
  state.existingNewsGallery
    .filter((image) => !state.removedNewsGallery.some((removed) => removed.id === image.id))
    .forEach((image, index) => {
      elements.newsGalleryPreview.append(previewCard(image.signedUrl, `Gallery image ${index + 1}`, () => {
        state.removedNewsGallery.push(image);
        renderNewsGalleryPreview();
        scheduleNewsDraftSave();
      }));
    });

  state.pendingNewsGallery.forEach((file, index) => {
    elements.newsGalleryPreview.append(previewCard(newsObjectUrl(file), file.name, () => {
      state.pendingNewsGallery.splice(index, 1);
      renderNewsGalleryPreview();
      scheduleNewsDraftSave();
    }));
  });
}

function updateNewsCounters() {
  elements.newsSummaryCount.textContent = String(elements.newsSummary.value.length);
}

async function openNewsForm(newsId = null, { persistDraft = true } = {}) {
  elements.newsForm.reset();
  document.getElementById('news-id').value = '';
  resetNewsMediaState();
  setMessage(elements.newsFormMessage);
  state.currentNews = null;
  state.newsSlugManuallyEdited = Boolean(newsId);
  document.getElementById('news-body-editor').innerHTML = '';

  if (!newsId) {
    elements.newsFormTitle.textContent = 'New News Post';
    elements.newsDate.value = localDateValue();
    elements.newsStatusNote.textContent = 'Choose whether to save this News post as a draft or publish it.';
    populateNewsProjects();
    populateGameSelector(elements.newsGames, 'game_ids');
    updateNewsCounters();
    showOnly('newsForm');
    elements.newsTitle.focus();
    if (persistDraft) await persistNewsDraft();
    return true;
  }

  showOnly('loading');
  const [newsResult, tagsResult, projectsResult, gamesResult, galleryResult] = await Promise.all([
    supabase.from('news_posts').select('*').eq('id', newsId).single(),
    supabase.from('news_tags').select('tags(name)').eq('news_id', newsId),
    supabase.from('news_projects').select('project_id').eq('news_id', newsId),
    supabase.from('news_games').select('game_id').eq('news_id', newsId),
    supabase.from('news_gallery_images').select('*').eq('news_id', newsId).order('sort_order'),
  ]);
  const error = newsResult.error || tagsResult.error || projectsResult.error || gamesResult.error || galleryResult.error;
  if (error) {
    showOnly('dashboard');
    setMessage(elements.dashboardMessage, formatError(error, 'News post could not be loaded.'), true);
    return false;
  }

  const post = newsResult.data;
  state.currentNews = post;
  state.existingNewsGallery = galleryResult.data || [];
  elements.newsFormTitle.textContent = 'Edit News Post';
  document.getElementById('news-id').value = post.id;
  elements.newsTitle.value = post.title;
  elements.newsSlug.value = post.slug;
  elements.newsDate.value = post.news_date;
  elements.newsSummary.value = post.short_summary || '';
  document.getElementById('news-body-editor').innerHTML = sanitizeRichText(post.body_html || '');
  elements.newsTags.value = (tagsResult.data || []).map((row) => row.tags?.name).filter(Boolean).join(', ');
  populateNewsProjects((projectsResult.data || []).map((row) => row.project_id));
  populateGameSelector(elements.newsGames, 'game_ids', (gamesResult.data || []).map((row) => row.game_id));
  elements.newsStatusNote.textContent = `Current status: ${post.status}. Choose an action below.`;
  updateNewsCounters();

  try {
    const urls = await Promise.all([
      signedUrl(post.cover_image_path, NEWS_STORAGE_BUCKET),
      ...state.existingNewsGallery.map((image) => signedUrl(image.storage_path, NEWS_STORAGE_BUCKET)),
    ]);
    state.newsCoverSignedUrl = urls[0];
    state.existingNewsGallery = state.existingNewsGallery.map((image, index) => ({ ...image, signedUrl: urls[index + 1] }));
  } catch (error) {
    setMessage(elements.newsFormMessage, formatError(error, 'Some image previews could not be loaded.'), true);
  }
  renderNewsCoverPreview();
  renderNewsGalleryPreview();
  showOnly('newsForm');
  if (persistDraft) await persistNewsDraft();
  return true;
}

async function restoreNewsDraft() {
  let draft;
  try {
    draft = await readNewsDraft(state.authorizedUserId);
  } catch (error) {
    console.warn('The local News draft could not be read.', error);
    return false;
  }
  if (!draft) return false;

  const opened = await openNewsForm(draft.newsId, { persistDraft: false });
  if (!opened) {
    await clearNewsDraft();
    return false;
  }
  elements.newsTitle.value = draft.title || '';
  elements.newsSlug.value = draft.slug || '';
  elements.newsDate.value = draft.newsDate || localDateValue();
  elements.newsSummary.value = draft.shortSummary || '';
  document.getElementById('news-body-editor').innerHTML = sanitizeRichText(draft.bodyHtml || '');
  elements.newsTags.value = draft.tags || '';
  populateNewsProjects(Array.isArray(draft.projectIds) ? draft.projectIds : []);
  populateGameSelector(elements.newsGames, 'game_ids', Array.isArray(draft.gameIds) ? draft.gameIds : []);
  state.pendingNewsCover = draft.pendingCover || null;
  state.removeNewsCover = Boolean(draft.removeCover);
  state.pendingNewsGallery = Array.isArray(draft.pendingGallery) ? draft.pendingGallery : [];
  state.removedNewsGallery = state.existingNewsGallery.filter((image) =>
    (draft.removedGalleryIds || []).includes(image.id));
  state.newsSlugManuallyEdited = Boolean(draft.slugManuallyEdited);
  updateNewsCounters();
  renderNewsCoverPreview();
  renderNewsGalleryPreview();
  setMessage(elements.newsFormMessage, 'Unsaved local changes restored.');
  window.localStorage.setItem(ACTIVE_DRAFT_KEY, 'news');
  return true;
}

async function saveNewsTags(newsId, tagValues) {
  const { error: deleteError } = await supabase.from('news_tags').delete().eq('news_id', newsId);
  if (deleteError) throw deleteError;
  if (!tagValues.length) return;

  const { data: tags, error: tagError } = await supabase
    .from('tags')
    .upsert(tagValues, { onConflict: 'slug' })
    .select('id');
  if (tagError) throw tagError;
  const { error: joinError } = await supabase
    .from('news_tags')
    .insert(tags.map((tag) => ({ news_id: newsId, tag_id: tag.id })));
  if (joinError) throw joinError;
}

async function saveNewsProjects(newsId, projectIds) {
  const { error: deleteError } = await supabase.from('news_projects').delete().eq('news_id', newsId);
  if (deleteError) throw deleteError;
  if (!projectIds.length) return;
  const { error: insertError } = await supabase
    .from('news_projects')
    .insert(projectIds.map((projectId) => ({ news_id: newsId, project_id: projectId })));
  if (insertError) throw insertError;
}

async function saveNews(event) {
  event.preventDefault();
  const requestedStatus = event.submitter?.dataset.newsStatus;
  if (!requestedStatus) return;
  setMessage(elements.newsFormMessage);

  const submitButtons = elements.newsForm.querySelectorAll('button[type="submit"]');
  submitButtons.forEach((button) => { button.disabled = true; });
  const formData = new FormData(elements.newsForm);
  const existingId = String(formData.get('id') || '');
  const newsId = existingId || crypto.randomUUID();
  const oldCoverPath = state.currentNews?.cover_image_path || '';
  const values = {
    id: newsId,
    title: String(formData.get('title') || '').trim(),
    slug: slugify(String(formData.get('slug') || '')),
    news_date: String(formData.get('news_date') || ''),
    cover_image_path: state.removeNewsCover && !state.pendingNewsCover ? null : oldCoverPath || null,
    short_summary: String(formData.get('short_summary') || '').trim(),
    body_html: sanitizeRichText(document.getElementById('news-body-editor').innerHTML),
    status: requestedStatus,
  };
  elements.newsSlug.value = values.slug;

  try {
    if (!values.title || !values.slug || !values.news_date) {
      throw new Error('Title, slug, and date are required.');
    }
    const saveResult = existingId
      ? await supabase.from('news_posts').update(values).eq('id', newsId).select().single()
      : await supabase.from('news_posts').insert(values).select().single();
    if (saveResult.error) throw saveResult.error;
    state.currentNews = saveResult.data;
    document.getElementById('news-id').value = newsId;

    await saveNewsTags(newsId, normalizedTags(String(formData.get('tags') || '')));
    await saveNewsProjects(newsId, formData.getAll('project_ids').map(String));
    await saveLinkedGames('news_games', 'news_id', newsId, formData.getAll('game_ids').map(String));

    if (state.pendingNewsCover) {
      const newCoverPath = await uploadImage(newsId, 'cover', state.pendingNewsCover, NEWS_STORAGE_BUCKET);
      const { error } = await supabase.from('news_posts').update({ cover_image_path: newCoverPath }).eq('id', newsId);
      if (error) {
        await supabase.storage.from(NEWS_STORAGE_BUCKET).remove([newCoverPath]);
        throw error;
      }
      state.currentNews.cover_image_path = newCoverPath;
      state.pendingNewsCover = null;
      if (oldCoverPath) await supabase.storage.from(NEWS_STORAGE_BUCKET).remove([oldCoverPath]);
    } else if (state.removeNewsCover && oldCoverPath) {
      const { error } = await supabase.storage.from(NEWS_STORAGE_BUCKET).remove([oldCoverPath]);
      if (error) throw error;
      state.currentNews.cover_image_path = null;
    }

    if (state.removedNewsGallery.length) {
      const removedIds = state.removedNewsGallery.map((image) => image.id);
      const removedPaths = state.removedNewsGallery.map((image) => image.storage_path);
      const { error: rowsError } = await supabase.from('news_gallery_images').delete().in('id', removedIds);
      if (rowsError) throw rowsError;
      const { error: filesError } = await supabase.storage.from(NEWS_STORAGE_BUCKET).remove(removedPaths);
      if (filesError) throw filesError;
      state.existingNewsGallery = state.existingNewsGallery.filter((image) => !removedIds.includes(image.id));
      state.removedNewsGallery = [];
    }

    let nextOrder = state.existingNewsGallery.length
      ? Math.max(...state.existingNewsGallery.map((image) => image.sort_order)) + 1
      : 0;
    while (state.pendingNewsGallery.length) {
      const file = state.pendingNewsGallery[0];
      const path = await uploadImage(newsId, 'gallery', file, NEWS_STORAGE_BUCKET);
      const { error } = await supabase.from('news_gallery_images').insert({
        news_id: newsId,
        storage_path: path,
        sort_order: nextOrder,
      });
      if (error) {
        await supabase.storage.from(NEWS_STORAGE_BUCKET).remove([path]);
        throw error;
      }
      state.pendingNewsGallery.shift();
      nextOrder += 1;
    }

    await clearNewsDraft();
    resetNewsMediaState();
    showOnly('dashboard');
    await loadDashboard(requestedStatus === 'published' ? 'News post published.' : 'News post saved as Draft.');
  } catch (error) {
    await persistNewsDraft();
    setMessage(elements.newsFormMessage, formatError(error, 'News post could not be saved.'), true);
  } finally {
    submitButtons.forEach((button) => { button.disabled = false; });
  }
}

async function deleteNews(post) {
  if (!window.confirm(`Delete the News post “${post.title}”? This also removes its uploaded images.`)) return;
  setMessage(elements.dashboardMessage, 'Deleting News post…');

  const { data: gallery, error: galleryError } = await supabase
    .from('news_gallery_images')
    .select('storage_path')
    .eq('news_id', post.id);
  if (galleryError) {
    setMessage(elements.dashboardMessage, formatError(galleryError, 'News images could not be checked.'), true);
    return;
  }

  const { error: deleteError } = await supabase.from('news_posts').delete().eq('id', post.id);
  if (deleteError) {
    setMessage(elements.dashboardMessage, formatError(deleteError, 'News post could not be deleted.'), true);
    return;
  }
  const paths = [post.cover_image_path, ...(gallery || []).map((image) => image.storage_path)].filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(NEWS_STORAGE_BUCKET).remove(paths);
    if (storageError) {
      await loadDashboard('News post deleted, but some stored images could not be removed.');
      setMessage(elements.dashboardMessage, 'News post deleted, but some stored images could not be removed.', true);
      return;
    }
  }
  await loadDashboard('News post deleted.');
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
document.getElementById('new-news-button').addEventListener('click', () => openNewsForm());
document.getElementById('new-game-button').addEventListener('click', () => openGameForm());
document.querySelectorAll('[data-cancel-form]').forEach((button) => {
  button.addEventListener('click', async () => {
    if (button.hasAttribute('data-discard-project')) await clearProjectDraft();
    if (button.hasAttribute('data-discard-news')) await clearNewsDraft();
    resetProjectMediaState();
    resetNewsMediaState();
    resetGameMediaState();
    showOnly('dashboard');
  });
});
elements.groupForm.addEventListener('submit', saveGroup);
elements.gameForm.addEventListener('submit', saveGame);
elements.projectForm.addEventListener('submit', saveProject);
elements.newsForm.addEventListener('submit', saveNews);
elements.projectForm.addEventListener('input', scheduleProjectDraftSave);
elements.newsForm.addEventListener('input', scheduleNewsDraftSave);
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
elements.newsSummary.addEventListener('input', updateNewsCounters);
elements.newsTitle.addEventListener('input', () => {
  if (!state.newsSlugManuallyEdited) elements.newsSlug.value = slugify(elements.newsTitle.value);
});
elements.newsSlug.addEventListener('input', () => {
  state.newsSlugManuallyEdited = true;
  elements.newsSlug.value = elements.newsSlug.value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-{2,}/g, '-');
});
elements.newsSlug.addEventListener('blur', () => {
  elements.newsSlug.value = slugify(elements.newsSlug.value);
});
elements.gameTitle.addEventListener('input', () => {
  if (!state.gameSlugManuallyEdited) elements.gameSlug.value = slugify(elements.gameTitle.value);
});
elements.gameSlug.addEventListener('input', () => {
  state.gameSlugManuallyEdited = true;
  elements.gameSlug.value = elements.gameSlug.value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-{2,}/g, '-');
});
elements.gameSlug.addEventListener('blur', () => {
  elements.gameSlug.value = slugify(elements.gameSlug.value);
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
    scheduleProjectDraftSave();
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
    scheduleProjectDraftSave();
  } catch (error) {
    elements.galleryInput.value = '';
    setMessage(elements.projectFormMessage, error.message, true);
  }
});
elements.newsCoverInput.addEventListener('change', () => {
  try {
    const file = elements.newsCoverInput.files[0];
    if (!file) return;
    validateImage(file);
    state.pendingNewsCover = file;
    state.removeNewsCover = false;
    renderNewsCoverPreview();
    setMessage(elements.newsFormMessage);
    scheduleNewsDraftSave();
  } catch (error) {
    elements.newsCoverInput.value = '';
    setMessage(elements.newsFormMessage, error.message, true);
  }
});
elements.newsGalleryInput.addEventListener('change', () => {
  try {
    const files = [...elements.newsGalleryInput.files];
    files.forEach(validateImage);
    state.pendingNewsGallery.push(...files);
    elements.newsGalleryInput.value = '';
    renderNewsGalleryPreview();
    setMessage(elements.newsFormMessage);
    scheduleNewsDraftSave();
  } catch (error) {
    elements.newsGalleryInput.value = '';
    setMessage(elements.newsFormMessage, error.message, true);
  }
});
elements.gameCoverInput.addEventListener('change', () => {
  try {
    const file = elements.gameCoverInput.files[0];
    if (!file) return;
    validateImage(file);
    state.pendingGameCover = file;
    state.removeGameCover = false;
    renderGameCoverPreview();
    setMessage(elements.gameFormMessage);
  } catch (error) {
    elements.gameCoverInput.value = '';
    setMessage(elements.gameFormMessage, error.message, true);
  }
});

setupRichEditors();
initializeAdmin();

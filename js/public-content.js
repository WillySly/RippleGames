import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const PROJECT_BUCKET = 'project-images';
const NEWS_BUCKET = 'news-images';

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function emptyState(title, message) {
  const wrapper = element('div', 'empty-state');
  wrapper.append(element('h2', '', title), element('p', '', message));
  return wrapper;
}

function renderError(container, message = 'Content could not be loaded. Please try again later.') {
  container.replaceChildren(emptyState('Unable to load content', message));
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function tagsNode(rows) {
  const names = (rows || []).map((row) => row.tags?.name).filter(Boolean);
  if (!names.length) return null;
  const wrapper = element('div', 'card-tags content-tags');
  names.forEach((name) => wrapper.append(element('span', 'tag', `#${name}`)));
  return wrapper;
}

function richTextNode(html) {
  const source = document.createElement('template');
  source.innerHTML = html || '';
  const allowedTags = new Set(['P', 'BR', 'STRONG', 'EM', 'B', 'I', 'A', 'UL', 'OL', 'LI']);

  [...source.content.querySelectorAll('*')].forEach((node) => {
    if (node.tagName === 'DIV') {
      const paragraph = document.createElement('p');
      paragraph.append(...node.childNodes);
      node.replaceWith(paragraph);
      node = paragraph;
    }
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }

    const href = node.tagName === 'A' ? node.getAttribute('href') : '';
    [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
    if (node.tagName === 'A' && href) {
      try {
        const url = new URL(href, window.location.origin);
        if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new Error('Invalid link');
        node.setAttribute('href', href);
        node.setAttribute('rel', 'noopener noreferrer');
      } catch {
        node.replaceWith(...node.childNodes);
      }
    }
  });

  const wrapper = element('div', 'content-rich-text');
  wrapper.append(source.content);
  return wrapper;
}

async function loadClient() {
  const response = await fetch('/api/admin-config', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Supabase is not configured.');
  const config = await response.json();
  if (!config.supabaseUrl || !config.supabasePublishableKey) throw new Error('Supabase is not configured.');
  return createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function signedImage(supabase, bucket, path) {
  if (!path) return '';
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) return '';
  return data.signedUrl;
}

function listingCard(item, type, href, imageUrl = '') {
  const card = element('a', 'listing-card');
  card.href = href;
  if (imageUrl) card.style.backgroundImage = `url("${imageUrl.replaceAll('"', '%22')}")`;
  const body = element('div', 'listing-card__body');
  body.append(
    element('span', 'listing-card__type', type),
    element('h3', 'listing-card__title', item.title),
    element('p', 'listing-card__description', item.short_summary || ''),
  );
  card.append(body);
  return card;
}

async function renderProjects(supabase) {
  const container = document.getElementById('projects-content');
  const [groupsResult, projectsResult] = await Promise.all([
    supabase.from('project_groups').select('id,name,short_description').order('name'),
    supabase
      .from('projects')
      .select('id,title,slug,short_summary,cover_image_path,project_group_id')
      .eq('status', 'published')
      .order('title'),
  ]);
  if (groupsResult.error || projectsResult.error) throw groupsResult.error || projectsResult.error;

  const projects = await Promise.all((projectsResult.data || []).map(async (project) => ({
    ...project,
    coverUrl: await signedImage(supabase, PROJECT_BUCKET, project.cover_image_path),
  })));
  container.replaceChildren();
  if (!projects.length) {
    container.append(emptyState('No published projects yet', 'Published Projects will appear here.'));
    return;
  }

  (groupsResult.data || []).forEach((group) => {
    const groupProjects = projects.filter((project) => project.project_group_id === group.id);
    if (!groupProjects.length) return;
    const section = element('section', 'content-section');
    const groupNode = element('div', 'project-group');
    groupNode.append(
      element('p', 'project-group__meta', 'Project group'),
      element('h2', 'content-section__heading', group.name),
    );
    if (group.short_description) groupNode.append(element('p', 'content-section__description', group.short_description));
    const grid = element('div', 'content-grid');
    groupProjects.forEach((project) => {
      grid.append(listingCard(project, 'Project', `/projects/${encodeURIComponent(project.slug)}`, project.coverUrl));
    });
    groupNode.append(grid);
    section.append(groupNode);
    container.append(section);
  });
}

async function renderNewsListing(supabase) {
  const container = document.getElementById('news-content');
  const { data, error } = await supabase
    .from('news_posts')
    .select('id,title,slug,news_date,short_summary,cover_image_path')
    .eq('status', 'published')
    .order('news_date', { ascending: false });
  if (error) throw error;
  const posts = await Promise.all((data || []).map(async (post) => ({
    ...post,
    coverUrl: await signedImage(supabase, NEWS_BUCKET, post.cover_image_path),
  })));
  container.replaceChildren();
  if (!posts.length) {
    container.append(emptyState('No published news yet', 'Published News posts will appear here.'));
    return;
  }
  const section = element('section', 'content-section');
  const grid = element('div', 'content-grid');
  posts.forEach((post) => {
    grid.append(listingCard(post, formatDate(post.news_date), `/news/${encodeURIComponent(post.slug)}`, post.coverUrl));
  });
  section.append(grid);
  container.append(section);
}

function contentSlug(collection) {
  const querySlug = new URLSearchParams(window.location.search).get('slug');
  if (querySlug) return querySlug;
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === collection && parts[1]) return decodeURIComponent(parts.slice(1).join('/'));
  return '';
}

function detailHeader(eyebrow, title, summary = '') {
  const header = element('header', 'content-page__hero content-detail__hero');
  header.append(element('p', 'content-page__eyebrow', eyebrow), element('h1', 'content-page__title', title));
  if (summary) header.append(element('p', 'content-page__intro', summary));
  return header;
}

function contentSection(title, html) {
  if (!html) return null;
  const section = element('section', 'content-section content-detail__section');
  section.append(element('h2', 'content-section__heading', title), richTextNode(html));
  return section;
}

function relatedLinks(title, items, collection) {
  if (!items.length) return null;
  const section = element('section', 'content-section content-detail__section');
  section.append(element('h2', 'content-section__heading', title));
  const list = element('ul', 'content-related');
  items.forEach((item) => {
    const link = element('a', '', item.title);
    link.href = `/${collection}/${encodeURIComponent(item.slug)}`;
    const row = document.createElement('li');
    row.append(link);
    list.append(row);
  });
  section.append(list);
  return section;
}

async function renderProjectDetail(supabase) {
  const container = document.getElementById('project-detail');
  const slug = contentSlug('projects');
  if (!slug) {
    container.replaceChildren(emptyState('Project not found', 'Return to the Projects page to browse published work.'));
    return;
  }
  const { data: project, error } = await supabase
    .from('projects')
    .select('id,title,slug,short_summary,cover_image_path,overview_html,challenge_html,what_we_did_html,project_groups(name),project_tags(tags(name)),project_gallery_images(storage_path,sort_order)')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (error) throw error;
  if (!project) {
    container.replaceChildren(emptyState('Project not found', 'This Project does not exist or is not published.'));
    document.title = 'Project not found – Ripple Games';
    return;
  }

  const gallery = [...(project.project_gallery_images || [])].sort((a, b) => a.sort_order - b.sort_order);
  const [coverUrl, galleryUrls, relatedResult] = await Promise.all([
    signedImage(supabase, PROJECT_BUCKET, project.cover_image_path),
    Promise.all(gallery.map((image) => signedImage(supabase, PROJECT_BUCKET, image.storage_path))),
    supabase.from('news_projects').select('news_posts(title,slug,news_date)').eq('project_id', project.id),
  ]);
  document.title = `${project.title} – Ripple Games`;
  container.replaceChildren(detailHeader(project.project_groups?.name || 'Project', project.title, project.short_summary));
  const tags = tagsNode(project.project_tags);
  if (tags) container.append(tags);
  if (coverUrl) {
    const image = element('img', 'content-cover');
    image.src = coverUrl;
    image.alt = project.title;
    container.append(image);
  }
  [
    contentSection('Overview', project.overview_html),
    contentSection('The Challenge', project.challenge_html),
    contentSection('What We Did', project.what_we_did_html),
  ].filter(Boolean).forEach((section) => container.append(section));

  const validGallery = galleryUrls.filter(Boolean);
  if (validGallery.length) {
    const section = element('section', 'content-section content-detail__section');
    section.append(element('h2', 'content-section__heading', 'Gallery'));
    const grid = element('div', 'content-gallery');
    validGallery.forEach((url, index) => {
      const image = document.createElement('img');
      image.src = url;
      image.alt = `${project.title} gallery image ${index + 1}`;
      image.loading = 'lazy';
      grid.append(image);
    });
    section.append(grid);
    container.append(section);
  }
  const relatedNews = (relatedResult.data || []).map((row) => row.news_posts).filter(Boolean);
  const related = relatedLinks('Related News', relatedNews, 'news');
  if (related) container.append(related);
}

async function renderNewsDetail(supabase) {
  const container = document.getElementById('news-detail');
  const slug = contentSlug('news');
  if (!slug) {
    container.replaceChildren(emptyState('News post not found', 'Return to the News page to browse published posts.'));
    return;
  }
  const { data: post, error } = await supabase
    .from('news_posts')
    .select('id,title,slug,news_date,short_summary,cover_image_path,body_html,news_tags(tags(name)),news_projects(projects(title,slug))')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (error) throw error;
  if (!post) {
    container.replaceChildren(emptyState('News post not found', 'This News post does not exist or is not published.'));
    document.title = 'News post not found – Ripple Games';
    return;
  }

  const coverUrl = await signedImage(supabase, NEWS_BUCKET, post.cover_image_path);
  document.title = `${post.title} – Ripple Games`;
  container.replaceChildren(detailHeader(formatDate(post.news_date), post.title, post.short_summary));
  const tags = tagsNode(post.news_tags);
  if (tags) container.append(tags);
  if (coverUrl) {
    const image = element('img', 'content-cover');
    image.src = coverUrl;
    image.alt = post.title;
    container.append(image);
  }
  if (post.body_html) {
    const section = element('section', 'content-section content-detail__section');
    section.append(richTextNode(post.body_html));
    container.append(section);
  }
  const projects = (post.news_projects || []).map((row) => row.projects).filter(Boolean);
  const related = relatedLinks('Related Projects', projects, 'projects');
  if (related) container.append(related);
}

async function initialize() {
  const page = document.body.dataset.contentPage;
  const container = document.querySelector('[data-content-root]');
  try {
    const supabase = await loadClient();
    if (page === 'projects') await renderProjects(supabase);
    if (page === 'news') await renderNewsListing(supabase);
    if (page === 'project-detail') await renderProjectDetail(supabase);
    if (page === 'news-detail') await renderNewsDetail(supabase);
  } catch (error) {
    console.error(error);
    if (container) renderError(container);
  }
}

initialize();

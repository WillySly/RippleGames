const PROJECT_BUCKET = 'project-images';
const NEWS_BUCKET = 'news-images';
const CACHE_PREFIX = 'ripplegames-public-content-v2:';
const CONFIG_CACHE_KEY = `${CACHE_PREFIX}config`;
const CONTENT_CACHE_MAX_AGE = 30 * 60 * 1000;
const CONFIG_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

function readCache(key, maxAge) {
  try {
    const cached = JSON.parse(window.localStorage.getItem(key));
    if (!cached || Date.now() - cached.savedAt > maxAge) return null;
    return cached.data;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Content still works when storage is unavailable or full.
  }
}

function removeCache(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
}

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
  names.forEach((name) => {
    const link = element('a');
    link.href = `/search.html?q=${encodeURIComponent(name)}`;
    link.append(element('span', 'tag', `#${name}`));
    wrapper.append(link);
  });
  return wrapper;
}

function normalizeSearchValue(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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

async function loadConfig() {
  let config = readCache(CONFIG_CACHE_KEY, CONFIG_CACHE_MAX_AGE);
  if (!config) {
    const response = await fetch('/api/admin-config', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Supabase is not configured.');
    config = await response.json();
    writeCache(CONFIG_CACHE_KEY, config);
  }
  if (!config.supabaseUrl || !config.supabasePublishableKey) throw new Error('Supabase is not configured.');
  return config;
}

async function queryTable(config, table, parameters) {
  const query = new URLSearchParams(parameters);
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      Accept: 'application/json',
      apikey: config.supabasePublishableKey,
    },
  });
  if (!response.ok) throw new Error(`Content request failed (${response.status}).`);
  return response.json();
}

function publicImageUrl(config, bucket, path) {
  if (!path) return '';
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${config.supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function listingCard(item, type, href, imageUrl = '', modifiers = '') {
  const card = element('a', `image-card listing-card ${modifiers}`.trim());
  card.href = href;
  if (imageUrl) card.style.backgroundImage = `url("${imageUrl.replaceAll('"', '%22')}")`;
  const body = element('div', 'image-card__content listing-card__body');
  if (type) body.append(element('span', 'listing-card__type', type));
  body.append(element('h3', 'image-card__title listing-card__title', item.title));
  if (item.short_summary) body.append(element('p', 'image-card__description listing-card__description', item.short_summary));
  card.append(body);
  return card;
}

async function renderProjects(config, cachedData = null) {
  const container = document.getElementById('projects-content');
  let groups = cachedData?.groups || [];
  let projects = cachedData?.projects || [];
  if (!cachedData) {
    projects = await queryTable(config, 'projects', {
      select: 'id,title,slug,short_summary,cover_image_path,project_group_id,status,project_groups(id,name,short_description)',
      status: 'eq.published',
      order: 'title.asc',
    });
    groups = [...new Map(projects
      .map((project) => project.project_groups)
      .filter(Boolean)
      .map((group) => [group.id, group])).values()]
      .sort((a, b) => a.name.localeCompare(b.name));
    projects = projects.map((project) => ({
      ...project,
      coverUrl: publicImageUrl(config, PROJECT_BUCKET, project.cover_image_path),
    }));
  }
  container.replaceChildren();
  if (!projects.length) {
    container.append(emptyState('No published projects yet', 'Published Projects will appear here.'));
    return { groups, projects };
  }

  groups.forEach((group) => {
    const groupProjects = projects.filter((project) => project.project_group_id === group.id);
    if (!groupProjects.length) return;
    const section = element('section', 'content-section');
    const groupNode = element('div', 'project-group');
    groupNode.append(element('h2', 'content-section__heading', group.name));
    if (group.short_description) groupNode.append(element('p', 'content-section__description', group.short_description));
    const grid = element('div', 'content-grid');
    groupProjects.forEach((project) => {
      grid.append(listingCard(project, '', `/projects/${encodeURIComponent(project.slug)}`, project.coverUrl, 'image-card--project'));
    });
    groupNode.append(grid);
    section.append(groupNode);
    container.append(section);
  });
  return { groups, projects };
}

async function renderNewsListing(config, cachedData = null) {
  const container = document.getElementById('news-content');
  let posts = cachedData?.posts || [];
  if (!cachedData) {
    posts = await queryTable(config, 'news_posts', {
      select: 'id,title,slug,news_date,short_summary,cover_image_path,status',
      status: 'eq.published',
      order: 'news_date.desc',
    });
    posts = posts.map((post) => ({
      ...post,
      coverUrl: publicImageUrl(config, NEWS_BUCKET, post.cover_image_path),
    }));
  }
  container.replaceChildren();
  if (!posts.length) {
    container.append(emptyState('No published news yet', 'Published News posts will appear here.'));
    return { posts };
  }
  const section = element('section', 'content-section');
  const grid = element('div', 'content-grid');
  posts.forEach((post) => {
    grid.append(listingCard(post, formatDate(post.news_date), `/news/${encodeURIComponent(post.slug)}`, post.coverUrl));
  });
  section.append(grid);
  container.append(section);
  return { posts };
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

function galleryCarousel(urls, projectTitle) {
  const section = element('section', 'content-section content-detail__section');
  const header = element('div', 'gallery-heading');
  header.append(element('h2', 'content-section__heading', 'Gallery'));

  const controls = element('div', 'gallery-controls');
  const previous = element('button', 'gallery-arrow', '←');
  const next = element('button', 'gallery-arrow', '→');
  previous.type = 'button';
  next.type = 'button';
  previous.setAttribute('aria-label', 'Previous gallery images');
  next.setAttribute('aria-label', 'Next gallery images');
  controls.append(previous, next);
  if (urls.length > 1) header.append(controls);

  const viewport = element('div', 'gallery-viewport');
  const track = element('div', 'content-gallery');
  const dialog = document.createElement('dialog');
  dialog.className = 'gallery-lightbox';
  dialog.setAttribute('aria-label', `${projectTitle} gallery image viewer`);
  const close = element('button', 'gallery-lightbox__close', '×');
  const lightboxPrevious = element('button', 'gallery-lightbox__arrow gallery-lightbox__arrow--previous', '←');
  const lightboxNext = element('button', 'gallery-lightbox__arrow gallery-lightbox__arrow--next', '→');
  const lightboxImage = element('img', 'gallery-lightbox__image');
  const counter = element('p', 'gallery-lightbox__counter');
  [close, lightboxPrevious, lightboxNext].forEach((button) => { button.type = 'button'; });
  close.setAttribute('aria-label', 'Close gallery');
  lightboxPrevious.setAttribute('aria-label', 'Previous image');
  lightboxNext.setAttribute('aria-label', 'Next image');
  let currentIndex = 0;

  const showImage = (index) => {
    currentIndex = (index + urls.length) % urls.length;
    lightboxImage.src = urls[currentIndex];
    lightboxImage.alt = `${projectTitle} gallery image ${currentIndex + 1}`;
    counter.textContent = `${currentIndex + 1} / ${urls.length}`;
  };

  urls.forEach((url, index) => {
    const imageButton = element('button', 'gallery-slide');
    imageButton.type = 'button';
    imageButton.setAttribute('aria-label', `Open gallery image ${index + 1}`);
    const image = element('img');
    image.src = url;
    image.alt = `${projectTitle} gallery image ${index + 1}`;
    image.loading = 'lazy';
    imageButton.append(image);
    imageButton.addEventListener('click', () => {
      showImage(index);
      dialog.showModal();
    });
    track.append(imageButton);
  });

  const scrollGallery = (direction) => {
    const slide = track.firstElementChild;
    if (!slide) return;
    viewport.scrollBy({ left: direction * (slide.getBoundingClientRect().width + 18), behavior: 'smooth' });
  };
  previous.addEventListener('click', () => scrollGallery(-1));
  next.addEventListener('click', () => scrollGallery(1));
  close.addEventListener('click', () => dialog.close());
  lightboxPrevious.addEventListener('click', () => showImage(currentIndex - 1));
  lightboxNext.addEventListener('click', () => showImage(currentIndex + 1));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') showImage(currentIndex - 1);
    if (event.key === 'ArrowRight') showImage(currentIndex + 1);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  if (urls.length === 1) {
    lightboxPrevious.hidden = true;
    lightboxNext.hidden = true;
  }
  dialog.append(close, lightboxPrevious, lightboxImage, lightboxNext, counter);
  viewport.append(track);
  section.append(header, viewport, dialog);
  return section;
}

async function renderProjectDetail(config, cachedData = null) {
  const container = document.getElementById('project-detail');
  const slug = contentSlug('projects');
  if (!slug) {
    container.replaceChildren(emptyState('Project not found', 'Return to the Projects page to browse published work.'));
    return;
  }
  let project = cachedData?.project || null;
  let coverUrl = cachedData?.coverUrl || '';
  let galleryUrls = cachedData?.galleryUrls || [];
  if (!cachedData) {
    const rows = await queryTable(config, 'projects', {
      select: 'id,title,slug,short_summary,cover_image_path,overview_html,challenge_html,what_we_did_html,status,project_groups(name),project_tags(tags(name)),project_gallery_images(storage_path,sort_order),news_projects(news_posts(title,slug,news_date))',
      slug: `eq.${slug}`,
      status: 'eq.published',
      limit: '1',
    });
    project = rows[0] || null;
  }
  if (!project) {
    container.replaceChildren(emptyState('Project not found', 'This Project does not exist or is not published.'));
    document.title = 'Project not found – Ripple Games';
    return null;
  }

  const gallery = [...(project.project_gallery_images || [])].sort((a, b) => a.sort_order - b.sort_order);
  if (!cachedData) {
    coverUrl = publicImageUrl(config, PROJECT_BUCKET, project.cover_image_path);
    galleryUrls = gallery.map((image) => publicImageUrl(config, PROJECT_BUCKET, image.storage_path));
  }
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
    container.append(galleryCarousel(validGallery, project.title));
  }
  const relatedNews = (project.news_projects || []).map((row) => row.news_posts).filter(Boolean);
  const related = relatedLinks('Related News', relatedNews, 'news');
  if (related) container.append(related);
  return { project, coverUrl, galleryUrls };
}

async function renderNewsDetail(config, cachedData = null) {
  const container = document.getElementById('news-detail');
  const slug = contentSlug('news');
  if (!slug) {
    container.replaceChildren(emptyState('News post not found', 'Return to the News page to browse published posts.'));
    return;
  }
  let post = cachedData?.post || null;
  let coverUrl = cachedData?.coverUrl || '';
  if (!cachedData) {
    const rows = await queryTable(config, 'news_posts', {
      select: 'id,title,slug,news_date,short_summary,cover_image_path,body_html,status,news_tags(tags(name)),news_projects(projects(title,slug))',
      slug: `eq.${slug}`,
      status: 'eq.published',
      limit: '1',
    });
    post = rows[0] || null;
  }
  if (!post) {
    container.replaceChildren(emptyState('News post not found', 'This News post does not exist or is not published.'));
    document.title = 'News post not found – Ripple Games';
    return null;
  }

  if (!cachedData) {
    coverUrl = publicImageUrl(config, NEWS_BUCKET, post.cover_image_path);
  }
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
  return { post, coverUrl };
}

function searchResultCard(item) {
  const card = element('div', 'image-card game-card');
  if (item.type === 'Project') card.classList.add('image-card--project', 'image-card--compact');
  if (item.image) card.style.backgroundImage = `url("${item.image.replaceAll('"', '%22')}")`;
  if (item.link) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => { window.location = item.link; });
  }
  const content = element('div', 'image-card__content card-content');
  if (item.type && item.type !== 'Project') content.append(element('span', 'listing-card__type', item.type));
  content.append(element('h2', 'image-card__title card-title', item.title));
  const tags = element('div', 'card-tags');
  item.tags.forEach((tagName) => {
    const link = element('a');
    link.href = `/search.html?q=${encodeURIComponent(tagName)}`;
    link.addEventListener('click', (event) => event.stopPropagation());
    link.append(element('span', 'tag', `#${tagName.toUpperCase()}`));
    tags.append(link);
  });
  content.append(tags);
  card.append(content);
  return card;
}

async function renderSearch(config, cachedData = null) {
  const grid = document.getElementById('resultsGrid');
  const noResults = document.getElementById('noResults');
  const display = document.getElementById('searchQueryDisplay');
  const query = new URLSearchParams(window.location.search).get('q')?.trim() || '';
  const needle = normalizeSearchValue(query);
  display.textContent = query ? `#${query.toLowerCase().replace(/ /g, '')}` : '#';

  let projects = cachedData?.projects || [];
  let posts = cachedData?.posts || [];
  if (!cachedData) {
    [projects, posts] = await Promise.all([
      queryTable(config, 'projects', {
        select: 'id,title,slug,cover_image_path,status,project_tags(tags(name))',
        status: 'eq.published',
        order: 'title.asc',
      }),
      queryTable(config, 'news_posts', {
        select: 'id,title,slug,cover_image_path,status,news_tags(tags(name))',
        status: 'eq.published',
        order: 'news_date.desc',
      }),
    ]);
    projects = projects.map((project) => ({
      ...project,
      image: publicImageUrl(config, PROJECT_BUCKET, project.cover_image_path),
    }));
    posts = posts.map((post) => ({
      ...post,
      image: publicImageUrl(config, NEWS_BUCKET, post.cover_image_path),
    }));
  }

  const games = (window.RIPPLE_GAMES_SEARCH_GAMES || []).map((game) => ({ ...game, type: '' }));
  const projectResults = projects.map((project) => ({
    title: project.title,
    image: project.image,
    link: `/projects/${encodeURIComponent(project.slug)}`,
    tags: (project.project_tags || []).map((row) => row.tags?.name).filter(Boolean),
    type: 'Project',
  }));
  const newsResults = posts.map((post) => ({
    title: post.title,
    image: post.image,
    link: `/news/${encodeURIComponent(post.slug)}`,
    tags: (post.news_tags || []).map((row) => row.tags?.name).filter(Boolean),
    type: 'News',
  }));
  const matches = [...games, ...projectResults, ...newsResults].filter((item) =>
    item.tags.some((tag) => normalizeSearchValue(tag).includes(needle))
    || normalizeSearchValue(item.title).includes(needle));

  grid.replaceChildren(...matches.map(searchResultCard));
  noResults.style.display = matches.length ? 'none' : '';
  return { projects, posts };
}

function pageCacheKey(page) {
  if (page === 'project-detail') return `${CACHE_PREFIX}project:${contentSlug('projects')}`;
  if (page === 'news-detail') return `${CACHE_PREFIX}news-post:${contentSlug('news')}`;
  return `${CACHE_PREFIX}${page}`;
}

function validCachedData(page, data) {
  if (!data || typeof data !== 'object') return false;
  if (page === 'projects') {
    return Array.isArray(data.groups)
      && Array.isArray(data.projects)
      && data.projects.every((project) => project?.status === 'published');
  }
  if (page === 'news') {
    return Array.isArray(data.posts) && data.posts.every((post) => post?.status === 'published');
  }
  if (page === 'project-detail') {
    return data.project?.status === 'published' && data.project.slug === contentSlug('projects');
  }
  if (page === 'news-detail') {
    return data.post?.status === 'published' && data.post.slug === contentSlug('news');
  }
  if (page === 'search') {
    return Array.isArray(data.projects)
      && Array.isArray(data.posts)
      && data.projects.every((project) => project?.status === 'published')
      && data.posts.every((post) => post?.status === 'published');
  }
  return false;
}

async function renderPage(page, config, cachedData = null) {
  if (page === 'projects') return renderProjects(config, cachedData);
  if (page === 'news') return renderNewsListing(config, cachedData);
  if (page === 'project-detail') return renderProjectDetail(config, cachedData);
  if (page === 'news-detail') return renderNewsDetail(config, cachedData);
  if (page === 'search') return renderSearch(config, cachedData);
  return null;
}

async function initialize() {
  const page = document.body.dataset.contentPage;
  const container = document.querySelector('[data-content-root]');
  const cacheKey = pageCacheKey(page);
  const cachedData = readCache(cacheKey, CONTENT_CACHE_MAX_AGE);
  const hasCache = validCachedData(page, cachedData);

  if (hasCache) await renderPage(page, null, cachedData);
  else if (page === 'search') await renderSearch(null, { projects: [], posts: [] });

  try {
    const config = await loadConfig();
    const freshData = await renderPage(page, config);
    if (freshData && validCachedData(page, freshData)) writeCache(cacheKey, freshData);
    else removeCache(cacheKey);
  } catch (error) {
    console.error(error);
    if (!hasCache && page !== 'search' && container) renderError(container);
  }
}

initialize();

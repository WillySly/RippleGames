import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const views = {
  loading: document.getElementById('loading-view'),
  login: document.getElementById('login-view'),
  dashboard: document.getElementById('dashboard-view'),
  configError: document.getElementById('config-error-view'),
};

const loginForm = document.getElementById('login-form');
const loginButton = document.getElementById('login-button');
const loginMessage = document.getElementById('login-message');
const logoutButton = document.getElementById('logout-button');
const dashboardMessage = document.getElementById('dashboard-message');
const adminUser = document.getElementById('admin-user');
const configErrorMessage = document.getElementById('config-error-message');

let supabase;

function showOnly(viewName) {
  Object.entries(views).forEach(([name, element]) => {
    element.hidden = name !== viewName;
  });
}

function setMessage(element, message = '') {
  element.textContent = message;
  element.hidden = !message;
}

function renderSession(session) {
  setMessage(loginMessage);
  setMessage(dashboardMessage);

  if (session?.user) {
    adminUser.textContent = session.user.email || 'Authenticated user';
    showOnly('dashboard');
    return;
  }

  adminUser.textContent = '';
  loginForm.reset();
  showOnly('login');
}

async function loadConfig() {
  const response = await fetch('/api/admin-config', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Missing or invalid Supabase environment variables.');
  }

  const config = await response.json();
  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    throw new Error('Missing or invalid Supabase environment variables.');
  }

  return config;
}

async function initializeAdmin() {
  try {
    const config = await loadConfig();
    supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    renderSession(data.session);

    supabase.auth.onAuthStateChange((_event, session) => {
      renderSession(session);
    });
  } catch (error) {
    configErrorMessage.textContent = error.message || 'The authentication service could not be configured.';
    showOnly('configError');
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(loginMessage);
  loginButton.disabled = true;
  loginButton.textContent = 'Logging in…';

  const formData = new FormData(loginForm);
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  } catch (error) {
    setMessage(loginMessage, error.message || 'Login failed. Check your email and password.');
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Log in';
  }
});

logoutButton.addEventListener('click', async () => {
  setMessage(dashboardMessage);
  logoutButton.disabled = true;
  logoutButton.textContent = 'Logging out…';

  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    setMessage(dashboardMessage, error.message || 'Logout failed. Please try again.');
  } finally {
    logoutButton.disabled = false;
    logoutButton.textContent = 'Logout';
  }
});

initializeAdmin();

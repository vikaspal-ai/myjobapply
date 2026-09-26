// Jobsapply Multi-User Authentication & Session Controller
// Handles User Sign Up, Login, Logout, and Auth Gate

import { api } from './api.js';
import { state, emit } from './state.js';

const STORAGE_KEY_TOKEN = 'myjobapply_token';
const STORAGE_KEY_USER = 'myjobapply_user';

export function initAuth() {
  setupAuthModalListeners();
  checkExistingSession();
}

export function checkExistingSession() {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN);
  const userJson = localStorage.getItem(STORAGE_KEY_USER);

  if (token && userJson) {
    try {
      const user = JSON.parse(userJson);
      setSession(token, user);
      return;
    } catch {
      clearSession();
    }
  }

  // Not authenticated
  updateAuthUI(false);
}

export function setSession(token, user) {
  state.authToken = token;
  state.currentUser = user;
  state.isAuthenticated = true;

  localStorage.setItem(STORAGE_KEY_TOKEN, token);
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));

  updateAuthUI(true, user);
  emit('auth:login', user);
}

export function clearSession() {
  state.authToken = null;
  state.currentUser = null;
  state.isAuthenticated = false;

  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_USER);

  updateAuthUI(false);
  emit('auth:logout', null);
}

export function openAuthModal(defaultTab = 'signin') {
  const modal = document.getElementById('authModal');
  if (!modal) return;

  switchAuthTab(defaultTab);
  modal.classList.add('active');
}

export function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('active');
}

export function switchAuthTab(tab) {
  const isSignIn = tab === 'signin';
  document.getElementById('authTabSignIn')?.classList.toggle('active', isSignIn);
  document.getElementById('authTabSignUp')?.classList.toggle('active', !isSignIn);

  document.getElementById('authFormSignIn')?.style.setProperty('display', isSignIn ? 'block' : 'none');
  document.getElementById('authFormSignUp')?.style.setProperty('display', !isSignIn ? 'block' : 'none');
  document.getElementById('authModalTitle').textContent = isSignIn ? 'Sign in to your Job Agent' : 'Create your Free Account';
  
  clearAuthErrors();
}

function clearAuthErrors() {
  const errEl = document.getElementById('authErrorMessage');
  if (errEl) {
    errEl.textContent = '';
    errEl.style.display = 'none';
  }
}

function showAuthError(msg) {
  const errEl = document.getElementById('authErrorMessage');
  if (errEl) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
}

export async function handleSignIn(email, password) {
  clearAuthErrors();
  const btn = document.getElementById('btnSubmitSignIn');
  if (btn) btn.disabled = true;

  try {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const user = res.data.user;
    const token = res.data.session?.access_token || 'session-token';
    setSession(token, {
      id: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name || user.email.split('@')[0],
    });

    closeAuthModal();
  } catch (err) {
    showAuthError(err.message || 'Invalid email or password');
  } finally {
    if (btn) btn.disabled = false;
  }
}

export async function handleSignUp(fullName, email, password) {
  clearAuthErrors();
  const btn = document.getElementById('btnSubmitSignUp');
  if (btn) btn.disabled = true;

  try {
    const res = await api('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password }),
    });

    const user = res.data.user;
    
    // Automatically log in
    await handleSignIn(email, password);
  } catch (err) {
    showAuthError(err.message || 'Failed to create account');
    if (btn) btn.disabled = false;
  }
}

export async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {}
  clearSession();
  window.location.reload();
}

function updateAuthUI(isLoggedIn, user = null) {
  const unauthNav = document.getElementById('unauthNavActions');
  const authNav = document.getElementById('authNavActions');
  const guestBanner = document.getElementById('guestWorkspaceBanner');
  const userWorkspace = document.getElementById('userWorkspaceContainer');
  const navUserName = document.getElementById('navUserName');

  if (isLoggedIn && user) {
    if (unauthNav) unauthNav.style.display = 'none';
    if (authNav) authNav.style.display = 'flex';
    if (guestBanner) guestBanner.style.display = 'none';
    if (userWorkspace) userWorkspace.style.display = 'block';
    if (navUserName) navUserName.textContent = user.fullName || user.email;
  } else {
    if (unauthNav) unauthNav.style.display = 'flex';
    if (authNav) authNav.style.display = 'none';
    if (guestBanner) guestBanner.style.display = 'block';
    if (userWorkspace) userWorkspace.style.display = 'none';
  }
}

function setupAuthModalListeners() {
  document.getElementById('formSignIn')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('signInEmail')?.value.trim();
    const pass = document.getElementById('signInPassword')?.value;
    if (email && pass) handleSignIn(email, pass);
  });

  document.getElementById('formSignUp')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('signUpName')?.value.trim();
    const email = document.getElementById('signUpEmail')?.value.trim();
    const pass = document.getElementById('signUpPassword')?.value;
    if (name && email && pass) handleSignUp(name, email, pass);
  });
}

import { readPasswordResetState, validateNewPassword } from './password-reset-helpers.js';

const form = document.getElementById('resetForm');
const message = document.getElementById('message');
const submit = document.getElementById('submit');
const state = readPasswordResetState(window.location.search);
let token = state.token;

function showMessage(value, isError = false) {
  message.textContent = value;
  message.setAttribute('role', 'status');
  message.dataset.state = isError ? 'error' : 'success';
}

if (token) {
  // Keep the one-time token out of the address bar and browser history.
  window.history.replaceState({}, document.title, window.location.pathname);
} else {
  showMessage('This password-reset link is missing or expired. Request a new link from the login page.', true);
  submit.disabled = true;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!token || submit.disabled) return;

  const password = document.getElementById('password').value;
  const confirmation = document.getElementById('confirmation').value;
  const validationError = validateNewPassword(password, confirmation);
  if (validationError) {
    showMessage(validationError, true);
    return;
  }

  submit.disabled = true;
  submit.textContent = 'Saving…';
  try {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: password }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      showMessage(result?.message || 'The reset link could not be used. Request a new password-reset email.', true);
      submit.disabled = false;
      submit.textContent = 'Set new password';
      return;
    }

    token = null;
    form.reset();
    showMessage('Your password has been updated. You can now sign in with your new password.');
    submit.textContent = 'Password updated';
    window.setTimeout(() => window.location.assign('/#login'), 1600);
  } catch {
    showMessage('Could not reach MAXWEB. Check your connection and try again.', true);
    submit.disabled = false;
    submit.textContent = 'Set new password';
  }
});

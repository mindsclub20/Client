import { supabase } from './supabase-client.js';
import { validateNewPassword } from './password-reset-helpers.js';

const form = document.getElementById('resetForm');
const message = document.getElementById('message');
const submit = document.getElementById('submit');
function showMessage(value, isError = false) {
  message.textContent = value;
  message.setAttribute('role', 'status');
  message.dataset.state = isError ? 'error' : 'success';
}

const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  showMessage('This password-reset link is missing or expired. Request a new link from the login page.', true);
  submit.disabled = true;
} else {
  window.history.replaceState({}, document.title, window.location.pathname);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  const password = document.getElementById('password').value;
  const confirmation = document.getElementById('confirmation').value;
  const validationError = validateNewPassword(password, confirmation);
  if (validationError) { showMessage(validationError, true); return; }
  submit.disabled = true;
  submit.textContent = 'Saving…';
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    await supabase.auth.signOut();
    form.reset();
    showMessage('Your password has been updated. You can now sign in with your new password.');
    submit.textContent = 'Password updated';
    window.setTimeout(() => window.location.assign('/#login'), 1600);
  } catch (error) {
    showMessage(error?.message || 'The reset link could not be used. Request a new password-reset email.', true);
    submit.disabled = false;
    submit.textContent = 'Set new password';
  }
});

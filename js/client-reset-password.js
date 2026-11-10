import { supabase } from './supabase-client.js';

const form = document.getElementById('resetForm');
const message = document.getElementById('message');
const submit = document.getElementById('submit');

const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  message.textContent = 'This password-reset link is invalid or expired. Request a new link from the login page.';
  submit.disabled = true;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  const password = document.getElementById('password').value;
  const confirmation = document.getElementById('confirmation').value;
  if (password.length < 8 || password.length > 128) {
    message.textContent = 'Use a password between 8 and 128 characters.';
    return;
  }
  if (password !== confirmation) {
    message.textContent = 'The passwords do not match.';
    return;
  }
  submit.disabled = true;
  submit.textContent = 'Updating…';
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    message.textContent = error.message || 'The password could not be updated.';
    submit.disabled = false;
    submit.textContent = 'Update password';
    return;
  }
  message.textContent = 'Password updated. Return to the login page.';
  form.reset();
  submit.textContent = 'Updated';
  await supabase.auth.signOut();
});

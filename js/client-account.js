import { supabase } from './supabase-client.js';

const status = document.getElementById('accountStatus');
const name = document.getElementById('accountName');
const email = document.getElementById('accountEmail');
const verification = document.getElementById('verificationStatus');

const { data: { session }, error } = await supabase.auth.getSession();
if (error || !session?.user) {
  window.location.replace('/#login');
} else {
  const user = session.user;
  status.textContent = 'You are signed in.';
  name.textContent = user.user_metadata?.full_name || '';
  email.textContent = user.email || '';
  verification.textContent = user.email_confirmed_at ? 'Email verified' : 'Email verification pending';
}

document.getElementById('signOut').addEventListener('click', async () => {
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    status.textContent = 'Could not log out. Please try again.';
    return;
  }
  window.location.replace('/');
});

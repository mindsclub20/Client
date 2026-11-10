import './dashboard-common.js';
(async () => {
  const message = document.getElementById('message');
  try {
    const result = await MW.api('/api/admin/bootstrap', { method: 'POST', body: {} });
    if (result.ready && result.role === 'super_admin') {
      location.replace('/admin.html');
      return;
    }
    message.textContent = 'This verified account is not authorised for initial administrator setup.';
  } catch (error) {
    message.textContent = error.message || 'Sign in with the verified initial administrator account first.';
  }
})();

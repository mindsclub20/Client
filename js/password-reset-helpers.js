export function readPasswordResetState(search) {
  const params = new URLSearchParams(search || '');
  const rawToken = params.get('token');
  const token = rawToken && rawToken.trim() ? rawToken : null;
  return { token, invalid: params.has('error') || !token };
}

export function validateNewPassword(password, confirmation) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Use a password of at least 8 characters.';
  }
  if (password.length > 128) {
    return 'Use a password no longer than 128 characters.';
  }
  if (password !== confirmation) {
    return 'The passwords do not match.';
  }
  return null;
}

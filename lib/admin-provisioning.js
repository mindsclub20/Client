const INITIAL_SUPER_ADMIN_EMAIL = 'maxweb.w@gmail.com';

export function isInitialSuperAdminEmail(email) {
  return typeof email === 'string' && email.trim().toLowerCase() === INITIAL_SUPER_ADMIN_EMAIL;
}

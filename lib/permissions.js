export const ROLES = Object.freeze({ SUPER_ADMIN: 'super_admin', ADMIN: 'admin', CLIENT: 'client' });
export const PROJECT_STATUSES = Object.freeze(['requested','quoted','approved','in_progress','review','completed','on_hold','cancelled']);
const SUPER_ADMIN_EMAILS = new Set(['bvshyam7777@gmail.com', 'saicharan8825@gmail.com']);
export function isSuperAdminEmail(value) { return typeof value === 'string' && SUPER_ADMIN_EMAILS.has(value.trim().toLowerCase()); }
export function isAdminRole(role) { return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN; }
export function canReadClientRecord(actor, ownerUserId) { if (!actor?.id) return false; return isAdminRole(actor.role) || actor.id === ownerUserId; }
export function signupRole() { return ROLES.CLIENT; }
export function isProjectStatus(value) { return PROJECT_STATUSES.includes(value); }
export function superAdminRoleForEmail(value, emailVerified) {
  if (emailVerified !== true || typeof value !== 'string') return null;
  return SUPER_ADMIN_EMAILS.has(value.trim().toLowerCase()) ? ROLES.SUPER_ADMIN : null;
}

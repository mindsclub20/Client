import { createHash } from 'node:crypto';

const INITIAL_SUPER_ADMIN_EMAIL = 'maxweb.w@gmail.com';

export function isInitialSuperAdminEmail(email) {
  return typeof email === 'string' && email.trim().toLowerCase() === INITIAL_SUPER_ADMIN_EMAIL;
}

export function hashInvitationToken(token) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 256) return null;
  return createHash('sha256').update(token).digest('hex');
}

export function canAcceptAdminInvitation(invitation, user, now = new Date()) {
  if (!invitation || !user || user.emailVerified !== true) return false;
  if (typeof invitation.email !== 'string' || typeof user.email !== 'string') return false;
  if (invitation.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) return false;
  if (invitation.accepted_at) return false;
  const expiry = new Date(invitation.expires_at);
  return Number.isFinite(expiry.getTime()) && expiry > now;
}

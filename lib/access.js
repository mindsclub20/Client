import { auth } from './auth.js';
import { pool } from './db.js';
import { isAdminRole, isSuperAdminEmail, superAdminRoleForEmail } from './permissions.js';
export function json(data, status = 200) { return Response.json(data, { status, headers: { 'cache-control': 'no-store' } }); }
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
export async function identity(request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return null;
  const user = session.user;
  const verifiedSuperAdminRole = superAdminRoleForEmail(user.email, user.emailVerified === true);
  if (verifiedSuperAdminRole) {
    await pool.query(
      `INSERT INTO public.maxweb_profiles (user_id, role, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET role = EXCLUDED.role, updated_at = now()`,
      [user.id, verifiedSuperAdminRole, user.name || null]
    );
  } else if (isSuperAdminEmail(user.email)) {
    await pool.query(
      `INSERT INTO public.maxweb_profiles (user_id, role, full_name)
       VALUES ($1, 'client', $2)
       ON CONFLICT (user_id) DO UPDATE
       SET role = 'client', updated_at = now()`,
      [user.id, user.name || null]
    );
  } else {
    await pool.query(
      `INSERT INTO public.maxweb_profiles (user_id, role, full_name)
       VALUES ($1, 'client', $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id, user.name || null]
    );
  }
  const { rows } = await pool.query('SELECT user_id, role, full_name, phone FROM public.maxweb_profiles WHERE user_id = $1', [user.id]);
  return { user, profile: rows[0] };
}
export async function requireUser(request) {
  if (!sameOrigin(request)) return { response: json({ error: 'invalid_origin' }, 403) };
  const current = await identity(request);
  return current || { response: json({ error: 'unauthenticated' }, 401) };
}
export async function requireAdmin(request) {
  const current = await requireUser(request);
  if (current.response) return current;
  return isAdminRole(current.profile?.role) ? current : { response: json({ error: 'forbidden' }, 403) };
}
export async function audit(actorId, action, entityType, entityId = null, details = {}) {
  await pool.query(`INSERT INTO public.maxweb_audit_logs (actor_user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5::jsonb)`, [actorId, action, entityType, entityId, JSON.stringify(details)]);
}

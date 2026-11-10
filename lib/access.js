import { pool } from './db.js';
import { getSupabaseUser } from './supabase-auth.js';
import { isAdminRole, nextAdminSlot } from './permissions.js';

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function identity(request) {
  const user = await getSupabaseUser(request);
  if (!user?.id) return null;
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(741920261)');
    await db.query(
      `INSERT INTO public.maxweb_profiles (user_id, email, role, full_name)
       VALUES ($1, $2, 'client', $3)
       ON CONFLICT (user_id) DO UPDATE
       SET email = EXCLUDED.email,
           updated_at = now()`,
      [user.id, user.email, user.name || null]
    );
    if (user.emailVerified) {
      const slots = await db.query('SELECT slot FROM public.maxweb_admin_slots ORDER BY slot');
      const slot = nextAdminSlot(slots.rows.map((row) => Number(row.slot)));
      if (slot !== null) {
        await db.query(
          'INSERT INTO public.maxweb_admin_slots (slot, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [slot, user.id]
        );
        await db.query(
          `UPDATE public.maxweb_profiles SET role = 'super_admin', updated_at = now()
           WHERE user_id = $1 AND EXISTS (SELECT 1 FROM public.maxweb_admin_slots WHERE user_id=$1)`,
          [user.id]
        );
      }
    }
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    db.release();
  }
  const { rows } = await pool.query(
    'SELECT user_id, role, full_name, phone, email FROM public.maxweb_profiles WHERE user_id = $1',
    [user.id]
  );
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
  await pool.query(
    `INSERT INTO public.maxweb_audit_logs (actor_user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [actorId, action, entityType, entityId, JSON.stringify(details)]
  );
}

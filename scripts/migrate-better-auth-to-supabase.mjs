#!/usr/bin/env node
/**
 * MAXWEB one-time Better Auth -> Supabase Auth migration.
 * Dry run: node scripts/migrate-better-auth-to-supabase.mjs
 * Apply: CONFIRM_MAXWEB_AUTH_MIGRATION=YES node scripts/migrate-better-auth-to-supabase.mjs --apply
 *
 * Required: DATABASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY.
 * Password hashes are not portable between providers. Migrated users receive
 * random passwords and must use Supabase email verification/password recovery.
 */
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const { Pool } = pg;
const apply = process.argv.includes('--apply');
if (!process.env.DATABASE_URL || !process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY || !process.env.SUPABASE_SECRET_KEY) {
  throw new Error('Set DATABASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY.');
}
if (apply && process.env.CONFIRM_MAXWEB_AUTH_MIGRATION !== 'YES') {
  throw new Error('Set CONFIRM_MAXWEB_AUTH_MIGRATION=YES to approve the guarded account-table migration.');
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: true } });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const publicAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const resetUrl = new URL('/reset-password.html', process.env.MAXWEB_SITE_URL || 'https://maxweb-one.vercel.app').toString();
const ident = (value) => '"' + String(value).replaceAll('"', '""') + '"';
const valuesSql = (rows) => rows.map((_, i) => `($${i * 2 + 1}::text,$${i * 2 + 2}::text)`).join(',');

async function getAllSupabaseUsers() {
  const users = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data?.users || []));
    if (!data?.users || data.users.length < 1000) break;
  }
  return users;
}

async function main() {
  const client = await pool.connect();
  try {
    const legacyTable = await client.query(`SELECT table_type FROM information_schema.tables WHERE table_schema='public' AND table_name='user'`);
    if (legacyTable.rows[0]?.table_type !== 'BASE TABLE') {
      throw new Error('Legacy public.user table not found. Check whether this migration has already run.');
    }
    const { rows: legacy } = await client.query(`SELECT id,email,name,"emailVerified" FROM public."user" ORDER BY "createdAt"`);
    if (!legacy.length) throw new Error('No legacy accounts found.');
    const duplicates = await client.query(`SELECT lower(email) FROM public."user" GROUP BY lower(email) HAVING count(*)>1`);
    if (duplicates.rows.length) throw new Error('Duplicate legacy email addresses need manual reconciliation.');

    const existing = await getAllSupabaseUsers();
    const byEmail = new Map(existing.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u]));
    const plan = [];
    for (const old of legacy) {
      const email = String(old.email || '').trim().toLowerCase();
      if (!email) throw new Error('A legacy account has no email address.');
      let user = byEmail.get(email);
      if (!user && apply) {
        if (old.emailVerified) {
          const { data, error } = await supabase.auth.admin.createUser({
            email,
            password: randomBytes(36).toString('base64url'),
            email_confirm: true,
            user_metadata: { full_name: old.name || '' },
          });
          if (error) throw new Error('Supabase account creation failed: ' + error.message);
          user = data.user;
          const recovery = await publicAuth.auth.resetPasswordForEmail(email, { redirectTo: resetUrl });
          if (recovery.error) throw new Error('Password recovery email could not be sent: ' + recovery.error.message);
        } else {
          const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
            data: { full_name: old.name || '' },
            redirectTo: resetUrl,
          });
          if (error) throw new Error('Supabase account invitation failed: ' + error.message);
          user = data.user;
        }
        byEmail.set(email, user);
      }
      plan.push({ oldId: old.id, newId: user?.id || null, email, name: old.name || '' });
    }
    console.log(`Legacy accounts: ${plan.length}; already matched in Supabase: ${plan.filter(x => x.newId).length}`);
    console.log('No passwords, hashes, or email addresses are printed.');
    if (!apply) {
      console.log('Dry run only. No data changed. Back up Neon before running with --apply.');
      return;
    }
    if (plan.some(x => !x.newId)) throw new Error('Some Supabase identities could not be resolved.');

    const businessTables = [
      'maxweb_admin_invitations','maxweb_admin_slots','maxweb_ai_conversations',
      'maxweb_ai_rate_limits','maxweb_audit_logs','maxweb_demos','maxweb_invoices',
      'maxweb_payments','maxweb_pricing_rules','maxweb_project_files',
      'maxweb_project_milestones','maxweb_project_updates','maxweb_projects',
      'maxweb_public_leads','maxweb_quotations','maxweb_service_requests',
      'maxweb_support_tickets',
    ];
    const countsBefore = new Map();
    for (const tableName of businessTables) {
      const exists = await client.query('SELECT to_regclass($1) IS NOT NULL AS present', ['public.' + tableName]);
      if (exists.rows[0].present) {
        const count = await client.query('SELECT count(*)::int AS count FROM public.' + ident(tableName));
        countsBefore.set(tableName, count.rows[0].count);
      }
    }

    await client.query('BEGIN');
    try {
      await client.query('ALTER TABLE public.maxweb_profiles ADD COLUMN IF NOT EXISTS email text');
      const mapParams = plan.flatMap(x => [x.oldId, x.newId]);
      const refs = await client.query(
        `SELECT tc.table_name,tc.constraint_name,kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
         WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
           AND ccu.table_name='user'`
      );
      // Drop all old-account FKs before inserting UUID keys that only exist in Supabase.
      for (const ref of refs.rows) {
        await client.query(`ALTER TABLE public.${ident(ref.table_name)} DROP CONSTRAINT ${ident(ref.constraint_name)}`);
      }

      await client.query(
        `INSERT INTO public.maxweb_profiles(user_id,email,role,full_name,phone,created_at,updated_at)
         SELECT m.new_id,u.email,COALESCE(p.role,'client'),
                COALESCE(NULLIF(p.full_name,''),u.name),p.phone,
                COALESCE(p.created_at,u."createdAt"),now()
         FROM public."user" u
         JOIN (VALUES ${valuesSql(plan)}) AS m(old_id,new_id) ON m.old_id=u.id
         LEFT JOIN public.maxweb_profiles p ON p.user_id=u.id
         ON CONFLICT(user_id) DO UPDATE SET
           email=EXCLUDED.email, role=EXCLUDED.role,
           full_name=COALESCE(NULLIF(EXCLUDED.full_name,''),public.maxweb_profiles.full_name),
           phone=COALESCE(EXCLUDED.phone,public.maxweb_profiles.phone), updated_at=now()`,
        mapParams
      );

      for (const ref of refs.rows) {
        if (ref.table_name === 'maxweb_profiles') continue;
        const table = ident(ref.table_name), column = ident(ref.column_name);
        await client.query(
          `UPDATE public.${table} AS target SET ${column}=mapping.new_id
           FROM (VALUES ${valuesSql(plan)}) AS mapping(old_id,new_id)
           WHERE target.${column}=mapping.old_id`,
          mapParams
        );
      }

      await client.query(
        `DELETE FROM public.maxweb_profiles WHERE user_id IN (${plan.map((_,i)=>`$${i+1}`).join(',')})`,
        plan.map(x=>x.oldId)
      );
      await client.query('DROP TABLE IF EXISTS public.account,public.session,public.verification,public."rateLimit"');
      await client.query('DROP TABLE public."user"');
      await client.query(
        `CREATE VIEW public."user" AS
         SELECT DISTINCT user_id AS id,COALESCE(full_name,'') AS name,email
         FROM public.maxweb_profiles`
      );
      for (const [tableName, expected] of countsBefore) {
        const actual = await client.query('SELECT count(*)::int AS count FROM public.' + ident(tableName));
        if (actual.rows[0].count !== expected) {
          throw new Error('Business row-count verification failed for ' + tableName + '; transaction rolled back.');
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    const result = await client.query('SELECT count(*)::int AS profiles FROM public.maxweb_profiles');
    console.log('Migration complete. Neon business records remain in Neon; Better Auth credential/session tables were removed.');
    console.log(`MAXWEB business profiles retained: ${result.rows[0].profiles}`);
    console.log('Users must verify their email and set a new password; legacy password hashes were not copied.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async (error) => {
  console.error(error?.message || 'MAXWEB account migration failed.');
  await pool.end().catch(() => {});
  process.exitCode = 1;
});

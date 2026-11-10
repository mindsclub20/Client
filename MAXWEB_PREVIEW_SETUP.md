# MAXWEB dual-system architecture and release checklist

## Target architecture

- Supabase project MAXWEB (lpplrraoanuxlojduswi, ap-south-1) is the only account provider. It owns account identities, password credentials, email confirmation, sessions, and password recovery.
- Neon project Maxxweb (lingering-lab-71539787) remains the only application-data database. Customers, business profiles/roles, leads, projects, quotations, invoices, payments, support, AI conversations, pricing, invitations, and audit history stay in Neon.
- Vercel project maxweb hosts the application and API.
- No Supabase application tables or duplicate business database are required.

The Neon maxweb_profiles table remains a business profile/authorization record. Its email and full_name fields are contact/profile data, not passwords or login credentials. A read-only public."user" compatibility view is created from those profiles so existing admin list queries can continue to work after the Better Auth account table is removed.

## Branch and production safety

- Git branch: feature/supabase-auth-neon-data
- Vercel project: maxweb
- Neon production branch: production
- Neon preview branch: maxweb-development
- The feature branch is isolated. No production deployment or Neon production migration is performed by this repository change.

## Vercel environment variables

Set these in Vercel Project Settings → Environment Variables:

| Variable | Purpose |
|---|---|
| SUPABASE_URL | MAXWEB Supabase project API URL |
| SUPABASE_PUBLISHABLE_KEY | Supabase publishable key; safe for browser use |
| DATABASE_URL | Neon connection string for the environment being deployed |
| MAXWEB_AI_API_KEY | Server-side AI provider key |
| MAXWEB_AI_MODEL | AI model identifier |
| MAXWEB_AI_BASE_URL | Gemini OpenAI-compatible endpoint; defaults to Google Gemini |\n| XAI_API_KEY | Optional server-side Grok fallback key |\n| XAI_MODEL | Grok model identifier (for example, grok-4.7) |\n| XAI_BASE_URL | xAI OpenAI-compatible endpoint; defaults to https://api.x.ai/v1 |

The assistant tries Gemini first using MAXWEB_AI_* and falls back to Grok when XAI_* is configured. Firecrawl is not required for authentication or AI chat and is not yet wired into this branch. Do not add SUPABASE_SECRET_KEY to browser code or Vercel production. It is required only for the one-time local account migration script. Never commit secrets or send them in chat.

Remove the obsolete BETTER_AUTH_SECRET and BETTER_AUTH_URL values after the cutover is complete. The old Better Auth verification/reset path is no longer used by the login UI.

## Supabase Auth dashboard configuration

1. Enable Email provider and password sign-in.
2. Keep email confirmations enabled.
3. Set the Site URL to the production MAXWEB URL: https://maxweb-one.vercel.app.
4. Add the production URL and each actual Vercel preview URL to the Auth redirect allowlist. Include /reset-password.html and the root confirmation redirect. Do not use a wildcard for unrelated domains.
5. Configure a custom SMTP sender for production verification and password-recovery email. The SMTP credentials belong in Supabase Auth SMTP settings, not in browser JavaScript.
6. Test signup confirmation, password recovery, expired links, and sign-out after environment variables are configured.

## Database setup paths

**Existing MAXWEB Neon database with Better Auth accounts:** back up Neon, configure Supabase Auth email delivery, then use the guarded one-time account migration below. It remaps existing account references and creates the read-only `public."user"` compatibility view used by existing admin queries. Do not run `db-migration-004-supabase-auth.sql` before this account migration on an existing database because the legacy `public."user"` table must still be present for the migration script.

**New Neon database:** apply `db-migration-001.sql`, `db-migration-002.sql`, and `db-migration-003-first-two-admins.sql`, then apply `db-migration-004-supabase-auth.sql`. Skip the Better Auth account migration script because there are no legacy accounts to migrate.

## One-time account migration

The migration script is guarded and defaults to dry-run:

    node scripts/migrate-better-auth-to-supabase.mjs

Before applying:
- Take a Neon backup/restore point.
- Confirm the Supabase project URL and secret key refer to the MAXWEB project.
- Review the dry-run account count.
- Ensure Supabase Auth email delivery is configured.

Then apply locally with:

    CONFIRM_MAXWEB_AUTH_MIGRATION=YES node scripts/migrate-better-auth-to-supabase.mjs --apply

The script:
- Creates or matches Supabase Auth identities for existing Neon users.
- Remaps Neon business-record identity references to the Supabase UUIDs.
- Preserves Neon business profiles, roles, and business records.
- Removes only Better Auth credential/session/verification tables after the remap succeeds.
- Creates a read-only compatibility view for existing MAXWEB profile joins.

Password hashes cannot be copied safely from Better Auth into Supabase Auth. Migrated users must verify their email and set a new password. The current production Neon inventory showed four legacy accounts, all unverified at inspection time. The script sends Supabase invitation emails to legacy unverified accounts and password-recovery emails to legacy verified accounts after SMTP is configured. The script does not print email addresses, passwords, or hashes.

The migration script requires local environment variables:
- DATABASE_URL — Neon production connection string
- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY — Supabase publishable key, also required locally
- SUPABASE_SECRET_KEY — Supabase secret key, local only
- MAXWEB_SITE_URL — optional base URL used for migration invitation and recovery redirects

Do not run it against a preview database unless that is the intended target. Do not run it twice after it reports completion.

## Authorization behavior

- The browser signs in through Supabase Auth and sends its access token as a Bearer token to MAXWEB APIs.
- The server validates each token with Supabase Auth before accessing Neon.
- Client-provided metadata cannot assign roles.
- Neon remains authoritative for MAXWEB roles and business permissions.
- Only the verified email address `maxweb.w@gmail.com` can claim the initial Super Admin slot. All other public signups remain clients; additional administrators must be invited by an existing administrator.

## Existing customer and quotation flow

1. Customers browse demos or contact MAXWEB through the assistant, phone, Instagram, or WhatsApp.
2. The assistant collects requirements and may create a provisional proposal only within active pricing rules.
3. An administrator reviews the conversation and approves, revises, or rejects the proposed price.
4. A formal quotation is issued to a signed-in client account.
5. The customer accepts the quotation in the client portal.
6. Only then can an administrator create the project and attach the accepted quotation.
7. The client portal tracks projects, quotations, invoices, support, and profile details; it does not create projects.

## Verification before production

- Run npm test and the GitHub Actions checks.
- Configure Supabase Auth and Vercel environment variables.
- Run the guarded migration against the intended Neon production database after taking a backup.
- Test the customer quote acceptance and project workflow.
- Confirm Neon business table row counts before and after migration.
- Configure durable file storage before enabling project file upload/download.
- The application records externally confirmed payments; it does not process transactions.
- Obtain explicit approval before merging or deploying the feature branch to production.

## Administrator access

MAXWEB does not create or invite administrator accounts in-app. Create the user in Supabase Auth, then assign `app_metadata.role` to `admin` or `super_admin` using a trusted Supabase administrator workflow. MAXWEB reads this server-managed metadata and synchronizes the role into the Neon `maxweb_profiles` record at the next authenticated request. Never use user-editable `user_metadata` for authorization.

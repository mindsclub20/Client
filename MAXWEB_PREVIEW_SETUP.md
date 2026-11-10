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
| MAXWEB_AI_BASE_URL | Optional OpenAI-compatible API base URL |

Do not add SUPABASE_SECRET_KEY to browser code or Vercel production. It is required only for the one-time local account migration script. Never commit secrets or send them in chat.

Remove the obsolete BETTER_AUTH_SECRET and BETTER_AUTH_URL values after the cutover is complete. The old Better Auth verification/reset path is no longer used by the login UI.

## Supabase Auth dashboard configuration

1. Enable Email provider and password sign-in.
2. Keep email confirmations enabled.
3. Set the Site URL to the production MAXWEB URL: https://maxweb-one.vercel.app.
4. Add the production URL and each actual Vercel preview URL to the Auth redirect allowlist. Include /reset-password.html and the root confirmation redirect. Do not use a wildcard for unrelated domains.
5. Configure a custom SMTP sender for production verification and password-recovery email. The SMTP credentials belong in Supabase Auth SMTP settings, not in browser JavaScript.
6. Test signup confirmation, password recovery, expired links, and sign-out after environment variables are configured.

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

Password hashes cannot be copied safely from Better Auth into Supabase Auth. Migrated users must verify their email and set a new password. The current production Neon inventory showed four legacy accounts, all unverified at inspection time. The script does not print email addresses, passwords, or hashes.

The migration script requires local environment variables:
- DATABASE_URL — Neon production connection string
- SUPABASE_URL
- SUPABASE_SECRET_KEY — Supabase secret key, local only

Do not run it against a preview database unless that is the intended target. Do not run it twice after it reports completion.

## Authorization behavior

- The browser signs in through Supabase Auth and sends its access token as a Bearer token to MAXWEB APIs.
- The server validates each token with Supabase Auth before accessing Neon.
- Client-provided metadata cannot assign roles.
- Neon remains authoritative for MAXWEB roles and business permissions.
- The first two verified accounts claim the two existing Super Admin slots; later public signups remain clients.
- Admin invitations continue to be stored and audited in Neon.

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
- Test signup, confirmation, login, session refresh, logout, password recovery, admin invitation, and role authorization.
- Test the customer quote acceptance and project workflow.
- Confirm Neon business table row counts before and after migration.
- Configure durable file storage before enabling project file upload/download.
- The application records externally confirmed payments; it does not process transactions.
- Obtain explicit approval before merging or deploying the feature branch to production.

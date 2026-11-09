# MAXWEB preview setup and release checklist

## Current development target

- Git branch: `feature/maxweb-non-ai-foundation`
- Vercel project: `maxweb`
- Database: Neon project `Maxxweb`, isolated `maxweb-development` branch
- Production database and production deployment are intentionally untouched.

## Required preview environment variables

Set these in Vercel Project Settings → Environment Variables, targeting Preview for the feature branch only:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled connection string for the isolated Neon development branch |
| `BETTER_AUTH_SECRET` | Strong random secret used by Better Auth |
| `BETTER_AUTH_URL` | The exact preview deployment URL used for authentication callbacks |
| `RESEND_API_KEY` | Server-side Resend API key for verification and password-reset email |
| `RESEND_FROM_EMAIL` | Sender address verified in Resend |
| `MAXWEB_AI_API_KEY` | Server-side key for the OpenAI-compatible AI provider |
| `MAXWEB_AI_MODEL` | Model identifier enabled for the selected provider |
| `MAXWEB_AI_BASE_URL` | Optional provider API base URL; defaults to the Groq OpenAI-compatible endpoint |

Never place provider keys in browser JavaScript, public HTML, or Git. Do not send secrets in chat. Use the Vercel environment-variable interface.

## Database

- Apply `db-migration-001.sql` only to the development branch if the existing base tables are absent.
- Apply `db-migration-002.sql` only to the development branch for AI conversations, pricing rules, demos, and AI rate limiting.
- The development branch has been inspected and the new tables are present.
- Do not run these migrations against production without a separate approved release plan.

## Super Admin provisioning

The server allowlists exactly:
- `bvshyam7777@gmail.com`
- `saicharan8825@gmail.com`

A verified sign-in provisions the matching account as `super_admin`. An unverified allowlisted account is kept as a client until verification succeeds. Public signup cannot assign an administrative role. No password or verification state is changed by this repository workflow.

## Customer and quotation flow

1. Customers browse demos or contact MAXWEB through the assistant, phone, Instagram, or WhatsApp.
2. The assistant collects requirements and may create a provisional proposal only within active pricing rules.
3. An administrator reviews the conversation and approves, revises, or rejects the proposed price.
4. A formal quotation is issued to a signed-in client account.
5. The customer accepts the quotation in the client portal.
6. Only then can an administrator create the project and attach the accepted quotation.
7. The client portal is for tracking projects, quotations, invoices, support, and profile details; it does not create projects.

## Verification still required before production

- Configure and verify Resend sender credentials and test verification/reset delivery.
- Configure an AI provider key and model; test real AI conversations and provider error handling.
- Verify both allowlisted accounts have registered and verified email addresses before expecting Super Admin access.
- Complete authenticated end-to-end tests for client signup, quote acceptance, project creation, invoices, support, and both Super Admin dashboards.
- Configure a durable file-storage provider before enabling project file upload/download.
- Review payment records with an authorized adult/business owner; the app records externally confirmed payments and does not process transactions.
- Review the homepage hero copy difference against the public baseline before release. The homepage HTML and design were not redesigned in this branch.
- Obtain explicit approval before merging or deploying to production.

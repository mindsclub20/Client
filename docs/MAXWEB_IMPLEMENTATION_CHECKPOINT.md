# MAXWEB AI Agency Platform — Audit & Continuity Checkpoint

**Checkpoint date:** 2026-11-11  
**Repository:** `mindsclub20/Client`  
**Production Vercel project:** `maxweb-new`  
**Supabase project ref:** `lpplrraoanuxlojduswi`  
**Branch:** `feature/maxweb-ai-platform-audit`

This file is the durable handoff for scheduled MAXWEB implementation runs. Each run must read this file and the latest Git history first, update the status/checkpoint, and commit each cohesive verified stage so work resumes from evidence rather than repeating the audit.

## 1. Verified baseline

### Application and deployment
- Next.js 15 App Router, TypeScript, React 19, Vercel deployment.
- Supabase Auth uses `@supabase/ssr` cookie-backed server sessions.
- Production Vercel project is `maxweb-new`; its latest inspected production deployment was READY and linked to `mindsclub20/Client`, branch `main`, commit `d0f31f76e5c8426b633568d9f5be790349b6c538`.
- Production aliases reported by Vercel: `maxweb-new.vercel.app` and `maxweb-one.vercel.app`.
- README identifies `https://maxweb-new.vercel.app` as the current production origin. Do not confuse it with the older `https://maxweb-rho.vercel.app` public marketing URL, which appears to be an older/legacy site and has a different client journey.

### Authentication — already implemented; preserve it
- Email signup route: `POST /api/auth/sign-up/email`.
- Email/password login route: `POST /api/auth/sign-in/email`.
- Logout route: `POST /api/auth/sign-out`.
- Server session route: `GET /api/me`, which calls Supabase `auth.getUser()`.
- PKCE callback: `/auth/callback`; compatibility callback: `/client.html`.
- Client auth UI is wired through `public/js/auth.js`.
- Admin authorization is server-side in `lib/admin-auth.ts`, using trusted `user.app_metadata.role === "admin"`; do not replace this with client-side checks or user-editable metadata.
- Existing admin page: `app/admin/page.tsx`. It is authenticated and role-gated, but its six business modules currently display “not connected yet”.
- Existing validation tests: `tests/auth-validation.test.mjs`.
- Do not rebuild login or create a duplicate auth system. Extend the existing auth/session/role model.

### Database and security baseline
- The inspected Supabase project currently has no application tables in the `public` schema. The inspected non-system table inventory contained Supabase-managed `auth`, `storage`, `realtime`, `extensions`, and `vault` tables only.
- No business data schema was found in the inspected project at audit time. Re-check before every migration; do not assume this remains unchanged.
- Supabase security advisor reported one warning: leaked-password protection is disabled. This is a configuration finding; do not change production Auth settings without the normal configuration/change-control path.
- Performance advisor returned no findings at audit time.
- Do not create duplicate tables. Design an additive, minimal schema after confirming no new application tables have appeared.
- RLS, server-side authorization, customer tenant isolation, and private document access are mandatory before exposing business records.

### Public website observation
- A read-only inspection of the older `maxweb-rho.vercel.app` marketing page showed services, pricing, demo and contact sections, plus a login preview. This observation is not proof of the current `maxweb-new.vercel.app` live experience.
- Browser inspection of the current production domain was blocked by the Browser Use project credit limit. Do not claim current production UI or E2E browser verification until it can be inspected.
- An advertised Grocery Shop demo URL returned a loading wrapper during the older-site inspection; its actual contents were not independently verified.

## 2. Immediate product gap

The current system has working authentication foundations and a server-gated admin landing page, but the actual agency operations platform is not implemented yet. The admin page contains placeholder module cards for Enquiries, Customers, Projects, Quotations, Invoices & payments, and After-sales support.

No AI chat API route was found at the expected `app/api/ai/chat/route.ts` path during this targeted inspection. Re-check the full repository before concluding there is no AI implementation elsewhere.

## 3. Implementation order

1. **Repository and production audit:** inspect all routes, components, tests, integrations, Vercel environment-variable names (presence only; never reveal values), Supabase schema/RLS/policies, and current production aliases. Verify current live site rather than relying on the legacy alias.
2. **Architecture and authorization:** map current auth/session/admin role; define customer ownership model, role/permission matrix, lifecycle state machine, audit trail, data retention, and API boundaries.
3. **Additive database foundation:** only after a fresh schema inspection, add the smallest necessary tables and constraints for profiles/customers, enquiries, conversations/messages, structured requirements, quotation drafts/versions/approvals, projects/milestones, deliverables, knowledge/services/pricing, notifications and activity events. Keep migrations additive/backwards-compatible and validate against a non-production database before production.
4. **AI consultation:** implement a server-side, MAXWEB-knowledge-grounded assistant; progressive conversational intake; structured requirement extraction; safe session/customer context; admin escalation; bounded inputs/outputs; prompt-injection protections; provider fallback and usage/rate controls. AI may draft, never approve or bind.
5. **Quotation approval:** admin-configured price rules and discount limits; versioned draft proposals; explicit admin approval/edit/reject/request-info actions; customer acceptance only for an approved official quote.
6. **Client portal:** authenticated, customer-scoped consultations, approved quotes, project status/milestones, payments/invoice status, documents, support and delivery information.
7. **Admin operations:** real-data dashboard, conversation inbox/takeover, quotation review, CRM, project/milestone operations, knowledge/configuration management, audit timeline and analytics.
8. **Automation and analytics:** idempotent event-driven notifications; metrics calculated from actual stored data; honest empty states.
9. **Release verification:** unit/integration/E2E tests, tenant-isolation and privilege tests, mobile/desktop verification, build/lint/type checks, Vercel preview inspection, then merge/deploy production only if all gates pass. Smoke-test the live production deployment and inspect deployment logs/events.

## 4. Provider constraints

- Follow the latest owner-approved MAXWEB automation instructions for provider scope and key names.
- Keep AI credentials server-side only. Never print, log, expose, commit, or return secret values.
- Firecrawl is optional research/retrieval, not an AI model provider.
- If live provider credentials are unavailable, implement mock-tested behavior and report it as mock-tested, not live-verified.
- Never invent services, prices, discounts, timelines, integrations, demo functionality, or completed work.

## 5. Release and safety rules

- User explicitly authorizes direct production deployment for this MAXWEB mission, without routine per-release approval.
- Authorization does not waive quality gates. Never deploy failing, insecure, destructive, or unverified changes.
- Do not delete or bulk-modify customer/auth/payment records, move money, alter payment-provider configuration, expose secrets, weaken auth/RLS, or make binding customer commitments.
- Do not run destructive SQL. Do not make production schema changes without additive/backwards-compatible design and a safe validation path.
- Keep each feature on a focused branch and create/update its PR. Merge only the specific PR whose tests, build, security review, preview and critical-flow checks pass.
- If browser access, credentials, preview access or non-production DB validation is blocked, record the limitation and continue with safe independent work.

## 6. Run log

| Date | Commit / PR | Work completed | Tests / deployment evidence | Next checkpoint |
|---|---|---|---|---|
| 2026-11-11 | Audit branch created from `d0f31f7` | Initial repository/auth/deployment/Supabase audit; durable roadmap established | Read-only inspection only; no code behavior changed; current-domain browser inspection blocked by Browser Use credits | Complete route and API inventory, verify production app, then implement first tested business-data foundation |

## 7. Scheduled-run protocol

At the beginning of each scheduled run:
1. Read this checkpoint and the latest commit/PR/deployment state.
2. Inspect the live code and schema again; do not trust stale assumptions.
3. Select the highest-value safe next task from the implementation order.
4. Add tests before behavior changes where practical; run the relevant suite and production build.
5. Commit a cohesive verified stage with a descriptive message and update this file's Run log and next checkpoint.
6. Continue the next stage only when the current stage is verified; deploy production only after all release gates pass.
7. Report exact commit SHA, PR, tests, deployment ID/URL, and any blockers. Never claim an unperformed check.

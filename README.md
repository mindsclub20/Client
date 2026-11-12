# MAXWEB

MAXWEB uses a native Next.js App Router architecture on Vercel.

## Architecture
- Next.js 15 App Router + TypeScript.
- Vercel native Next.js deployment and serverless route handlers.
- Supabase Auth with `@supabase/ssr` cookie-based sessions.
- `GET /api/me` verifies the user on the server with `auth.getUser()`.
- Auth endpoints: `POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email`, `POST /api/auth/sign-out`.
- Email confirmation follows the same PKCE callback flow used by Skilldrem: Supabase's standard Confirm signup email template sends the user through Supabase Auth, which redirects to `/auth/callback?code=...`; the route exchanges the code for a cookie-backed session.
- `GET /client.html` is a compatibility callback for old confirmation emails created by the retired `maxweb-one.vercel.app` site. It exchanges the same PKCE code and redirects to the portal.
- The current production origin is `https://maxweb-new.vercel.app`. The signup API derives the callback origin from the incoming request, so production and preview deployments use their own host.
- Keep the Supabase redirect allow-list updated for the production and preview URLs you use. The standard Confirm signup template can remain unchanged; no token-hash template customization is required for this flow.

## AI-integrated dashboards
- **Client** (`/client`): AI chat (xAI Grok) that analyses website needs and bargains price (start ₹15,000, floor ₹7,000). Also offers contact options for human admin.
- **Admin** (`/admin`): AI interaction summaries, agreed/current prices by client, and quick links to GitHub, Supabase, Vercel, Hostinger, Authgear, Resend.
- After login, clients are redirected to `/client`; admins to `/admin`.
- Tables: `ai_conversations`, `ai_messages` (RLS enabled). Migration already applied on the MAXWEB Supabase project.

## Vercel environment variables
- `SUPABASE_URL`: MAXWEB Supabase project URL (Production and Preview).
- `SUPABASE_ANON_KEY`: Supabase publishable key or legacy anon key (Production and Preview).
- `MAXWEB_AI_API_KEY` or `MAXWEB_AI_API_KEY2`: xAI Grok API key (server-only). Never use a `NEXT_PUBLIC_` prefix.

Do not expose a service-role/secret key in browser code or a `NEXT_PUBLIC_` variable. The existing Vercel variable names are supported.

## Local development
The Vercel build extracts the original site assets from `MAXWEB.zip` into `public/`, then builds the Next.js application and API routes.

```bash
npm install
npm run dev
npm test
npm run build
```

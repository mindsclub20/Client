# MAXWEB

MAXWEB is a Next.js 15 App Router app deployed on **Cloudflare Workers** via **OpenNext** (`@opennextjs/cloudflare`).

Vercel remains optional; the default path is Cloudflare.

## Architecture
- Next.js 15 App Router + TypeScript
- Cloudflare Workers + OpenNext adapter (`npm run cf:deploy`)
- Authgear OIDC (primary login) + Supabase Auth (legacy email)
- Supabase Postgres for AI conversations / messages / quotes
- Gemini AI (`MAXWEB_AI_API_KEY2`) server-side only

## Cloudflare deploy

```bash
npm install
npm run cf:preview   # local OpenNext + wrangler
npm run cf:deploy    # production Worker
```

Or connect the GitHub repo in **Cloudflare Dashboard → Workers & Pages → Create → Connect to Git**, build command:

```bash
npm run cf:build
```

Build output is produced under `.open-next/` (handled by OpenNext / Wrangler).

### Environment variables (Cloudflare)

Set these as **Worker secrets** (`wrangler secret put NAME`) or in the dashboard **Settings → Variables and Secrets**:

| Name | Required | Notes |
|------|----------|--------|
| `SUPABASE_URL` | yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_URL` | recommended | Same as above if client code reads it |
| `SUPABASE_ANON_KEY` | yes | Anon / publishable key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | recommended | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Authgear AI + admin chats |
| `MAXWEB_AI_API_KEY2` | yes | Gemini API key |
| `MAXWEB_GEMINI_MODEL` | no | Default `gemini-3.8-flash` |
| `AUTHGEAR_CLIENT_ID` | yes | Authgear app client id |
| `AUTHGEAR_SESSION_SECRET` | yes | ≥ 32 random chars |
| `AUTHGEAR_ADMIN_EMAILS` | yes | Comma-separated, verified emails |
| `AUTHGEAR_REDIRECT_URI` | yes | `https://YOUR_DOMAIN/authgear/callback` |
| `AUTHGEAR_POST_LOGOUT_REDIRECT_URI` | yes | `https://YOUR_DOMAIN/` |
| `AUTHGEAR_ISSUER` | no | Default Authgear issuer |
| `CRON_SECRET` | no | If using scheduled summary jobs |

### Authgear Portal
Add the Cloudflare callback to **Allowed redirect URIs**:
`https://YOUR_CLOUDFLARE_DOMAIN/authgear/callback`

## Local development

```bash
npm install
npm run dev
npm test
npm run build
```

`prebuild` extracts homepage assets from `MAXWEB.zip` into `public/`.

## Features
- **Client** (`/client`): intake, Gemini chat, demo request, profile photo
- **Admin** (`/admin`): chats grouped by Gmail, quotes, integrations
- Login redirects to Authgear

# Cloudflare deployment runbook

## One-time setup

1. Install deps: `npm install`
2. Login: `npx wrangler login`
3. Create Worker secrets (repeat for each name below):

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put MAXWEB_AI_API_KEY2
npx wrangler secret put AUTHGEAR_CLIENT_ID
npx wrangler secret put AUTHGEAR_SESSION_SECRET
npx wrangler secret put AUTHGEAR_ADMIN_EMAILS
npx wrangler secret put AUTHGEAR_REDIRECT_URI
npx wrangler secret put AUTHGEAR_POST_LOGOUT_REDIRECT_URI
```

Optional:

```bash
npx wrangler secret put AUTHGEAR_ISSUER
npx wrangler secret put MAXWEB_GEMINI_MODEL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx wrangler secret put CRON_SECRET
```

4. Deploy: `npm run cf:deploy`
5. In Authgear Portal, allow:
   - `https://<your-worker-or-custom-domain>/authgear/callback`

## Git-connected builds (Cloudflare Dashboard)

- **Build command:** `npm run cf:build`
- **Deploy command:** `npx wrangler deploy`
- **Root directory:** `/`
- **Node version:** 20+

## Env var names (copy list)

```
SUPABASE_URL
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
MAXWEB_AI_API_KEY2
MAXWEB_GEMINI_MODEL
AUTHGEAR_CLIENT_ID
AUTHGEAR_SESSION_SECRET
AUTHGEAR_ADMIN_EMAILS
AUTHGEAR_REDIRECT_URI
AUTHGEAR_POST_LOGOUT_REDIRECT_URI
AUTHGEAR_ISSUER
CRON_SECRET
```

## Notes

- Authgear admin list is comma-separated, e.g. `a@gmail.com,b@gmail.com`.
- Users must **log out and log in again** after being added to `AUTHGEAR_ADMIN_EMAILS`.
- `__Host-` session cookies require HTTPS (Cloudflare provides this).

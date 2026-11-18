# MAXWEB

MAXWEB uses a native Next.js App Router architecture on Vercel.

## Authentication

- Authgear is an additional hosted OIDC login using Authorization Code Flow with PKCE (S256).
- Authgear sessions are encrypted, HTTP-only cookies. Tokens are not exposed to browser JavaScript or local storage.
- The callback verifies the ID-token signature against Authgear JWKS and validates issuer, audience, nonce, and expiry.
- Only a verified email matching the normalized server-side `AUTHGEAR_ADMIN_EMAILS` allowlist receives admin access. All other Authgear users receive client access.
- Existing Supabase Auth registration, sign-in, confirmation callback, sessions, and trusted `app_metadata` admin authorization remain supported.

## Vercel environment variables

Configure these in both Production and Preview:
- `AUTHGEAR_CLIENT_ID`: Authgear Public Client ID.
- `AUTHGEAR_SESSION_SECRET`: random secret of at least 32 characters. Generate privately; never commit it or share it in chat.
- `AUTHGEAR_ADMIN_EMAILS`: comma-separated admin allowlist. Initially only `bvshyam7777@gmail.com`.
- `AUTHGEAR_ISSUER`: `https://lyrics-6xahba.authgear.cloud` (optional; default).

Configure these two variables in **Production only**:
- `AUTHGEAR_REDIRECT_URI`: `https://maxweb-new.vercel.app/authgear/callback`.
- `AUTHGEAR_POST_LOGOUT_REDIRECT_URI`: `https://maxweb-new.vercel.app/`.

For Preview deployments, leave those URL variables unset. The application derives callback and logout URLs from the current deployment origin. Register the exact Preview callback URL and root URL as allowed redirect URIs in Authgear before testing Preview authentication.

Keep matching Production redirect URIs registered in Authgear. For localhost development, use local redirect URIs and a separate local session secret.

Existing Supabase variables remain required:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## CI verification

GitHub Actions runs `npm test` and `npm run build` for pull requests targeting main and pushes to `feature/maxweb-authgear-auth`.

## Local development

The Vercel build extracts the original site assets from `MAXWEB.zip` into `public/`, then builds the Next.js application and API routes.

```bash
npm install
npm run dev
npm test
npm run build
```

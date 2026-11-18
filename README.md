# MAXWEB

MAXWEB uses a native Next.js App Router architecture on Vercel.

## Authentication

- Authgear is available as an additional hosted OIDC login using Authorization Code Flow with PKCE (S256).
- Authgear sessions are encrypted, HTTP-only cookies. Access and ID tokens are not exposed to browser JavaScript or local storage.
- The callback verifies the ID-token signature against Authgear JWKS and validates issuer, audience, nonce, and expiry.
- Only an email with \`email_verified: true\` that exactly matches the normalized server-side \`AUTHGEAR_ADMIN_EMAILS\` allowlist receives admin access. All other Authgear users receive client access.
- Existing Supabase Auth sign-up, sign-in, confirmation callback, and sessions remain supported as a fallback. Existing Supabase admin authorization continues to use trusted \`app_metadata\`.

## Required Vercel environment variables

Configure these for Production and Preview as appropriate:

- \`AUTHGEAR_CLIENT_ID\`: Authgear Public Client ID.
- \`AUTHGEAR_SESSION_SECRET\`: a randomly generated secret with at least 32 characters. Generate it privately; do not commit it or send it in chat.
- \`AUTHGEAR_ADMIN_EMAILS\`: comma-separated admin email allowlist. Initially set only to \`bvshyam7777@gmail.com\`.
- \`AUTHGEAR_REDIRECT_URI\`: \`https://maxweb-new.vercel.app/authgear/callback\`.
- \`AUTHGEAR_POST_LOGOUT_REDIRECT_URI\`: \`https://maxweb-new.vercel.app/\`.
- \`AUTHGEAR_ISSUER\`: \`https://lyrics-6xahba.authgear.cloud\` (optional; this is the default).

Keep the matching login and post-logout redirect URIs registered in Authgear. For localhost development, use local redirect URIs and a separate local session secret.

Existing Supabase variables remain required for users who continue using Supabase:
- \`SUPABASE_URL\`
- \`SUPABASE_ANON_KEY\`

## Local development

The Vercel build extracts the original site assets from \`MAXWEB.zip\` into \`public/\`, then builds the Next.js application and API routes.

\`\`\`bash
npm install
npm run dev
npm test
npm run build
\`\`\`

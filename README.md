# MAXWEB

MAXWEB now uses a native Next.js App Router architecture on Vercel. The Vercel project framework preset is set to Next.js so App Router pages and route handlers are deployed as serverless functions. The existing website design and public assets are preserved from the original archive; the archive is unpacked only for static frontend assets, while authentication and session endpoints are compiled as Next.js server routes.

## Architecture
- Next.js 15 App Router + TypeScript.
- Vercel native Next.js deployment and serverless route handlers.
- Supabase Auth with `@supabase/ssr` cookie-based sessions.
- `GET /api/me` verifies the user on the server with `auth.getUser()`.
- Auth endpoints: `POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email`, `POST /api/auth/sign-out`.
- Email confirmation endpoint: `GET /auth/confirm` verifies Supabase's token hash with `verifyOtp` and writes the cookie-backed session. Configure the Supabase **Confirm signup** email template to use `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`. The signup route sets `emailRedirectTo` to `/auth/confirm`. Keep the redirect allow-list updated for the production and preview URLs you use.
- Supabase Postgres remains available for future business data. No application tables are created by this migration.

## Vercel environment variables
- `SUPABASE_URL`: MAXWEB Supabase project URL (Production and Preview).
- `SUPABASE_ANON_KEY`: Supabase publishable key or legacy anon key (Production and Preview).

Do not expose a service-role/secret key in browser code or a `NEXT_PUBLIC_` variable. The existing Vercel variable names are supported.

## Local development
The Vercel build extracts only the original `index.html` as `public/site-source.html`, plus CSS, the existing site behavior script, and images from `MAXWEB.zip` into `public/`. It then builds the Next.js application and API routes.

```bash
npm install
npm run dev
npm test
npm run build
```

Signup respects the Supabase project's email-confirmation setting. If confirmation is enabled, the client is told to check email before logging in. In Supabase Dashboard → Authentication → Email Templates → Confirm signup, set the message link to:\n\n`{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`\n\nThe confirmation endpoint accepts only the email verification type, verifies the token hash once, and redirects to the portal. The old `/auth/callback` route remains for legacy confirmation links.

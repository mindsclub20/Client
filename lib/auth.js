import { betterAuth } from 'better-auth';
import { pool } from './db.js';

const deploymentOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
const productionOrigin = process.env.BETTER_AUTH_URL;
const baseURL = process.env.VERCEL_ENV === 'production'
  ? productionOrigin || deploymentOrigin
  : deploymentOrigin || productionOrigin;
const origins = [
  productionOrigin,
  deploymentOrigin,
  'https://maxweb-one.vercel.app',
  'https://maxweb-rho.vercel.app',
  'https://maxweb-maxweb2.vercel.app',
].filter(Boolean);

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: Array.from(new Set(origins)),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 60,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 5 },
    },
  },
  advanced: { useSecureCookies: !!process.env.VERCEL },
});

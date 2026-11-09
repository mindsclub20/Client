import { betterAuth } from 'better-auth';
import { pool } from './db.js';
import { sendTransactionalEmail } from './email.js';

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
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: false,
    sendResetPassword: async ({ user, url }) => {
      await sendTransactionalEmail({
        to: user.email,
        subject: 'Reset your MAXWEB password',
        text: `Use this secure link to reset your password: ${url}`,
        url,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendTransactionalEmail({
        to: user.email,
        subject: 'Verify your MAXWEB email address',
        text: `Verify your email address to activate your MAXWEB account: ${url}`,
        url,
      });
    },
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

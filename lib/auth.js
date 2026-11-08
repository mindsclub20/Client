import { betterAuth } from "better-auth";
import pg from "pg";

const { Pool } = pg;

// One small pool per serverless instance. DATABASE_URL comes from Vercel env vars and never reaches the browser.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 8000,
  ssl: { rejectUnauthorized: true }
});

const onVercel = !!process.env.VERCEL;
const origins = [
  process.env.BETTER_AUTH_URL,
  "https://maxweb-rho.vercel.app",
  "https://maxweb-maxweb2.vercel.app",
  process.env.VERCEL_PROJECT_PRODUCTION_URL && "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_URL && "https://" + process.env.VERCEL_URL
].filter(Boolean);

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || undefined,
  trustedOrigins: Array.from(new Set(origins)),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 }
    }
  },
  advanced: {
    useSecureCookies: onVercel
  }
});

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { EncryptJWT, jwtDecrypt } from "jose";

export const AUTHGEAR_SESSION_COOKIE = "__Host-maxweb-authgear-session";
export const AUTHGEAR_ISSUER = process.env.AUTHGEAR_ISSUER || "https://lyrics-6xahba.authgear.cloud";
const SESSION_AUDIENCE = "maxweb";

export type AuthgearSession = {
  sub: string;
  email: string;
  name: string | null;
  role: "admin" | "client";
};

export function getAuthgearConfig() {
  const clientId = process.env.AUTHGEAR_CLIENT_ID;
  const sessionSecret = process.env.AUTHGEAR_SESSION_SECRET;
  if (!clientId) throw new Error("AUTHGEAR_CLIENT_ID is not configured.");
  if (!sessionSecret || sessionSecret.length < 32) throw new Error("AUTHGEAR_SESSION_SECRET must contain at least 32 characters.");
  return { clientId, sessionSecret };
}

export function getAuthgearRedirectUri(origin: string) {
  return process.env.AUTHGEAR_REDIRECT_URI || new URL("/authgear/callback", origin).toString();
}

function sessionKey(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest();
}

export async function createAuthgearSessionToken(session: AuthgearSession) {
  const { sessionSecret } = getAuthgearConfig();
  return new EncryptJWT(session)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuer(AUTHGEAR_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("8h")
    .encrypt(sessionKey(sessionSecret));
}

export async function readAuthgearSessionToken(token: string): Promise<AuthgearSession | null> {
  try {
    const { sessionSecret } = getAuthgearConfig();
    const { payload } = await jwtDecrypt(token, sessionKey(sessionSecret), {
      issuer: AUTHGEAR_ISSUER,
      audience: SESSION_AUDIENCE
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    if (payload.role !== "admin" && payload.role !== "client") return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : null,
      role: payload.role
    };
  } catch {
    return null;
  }
}

export async function getAuthgearSession(): Promise<AuthgearSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTHGEAR_SESSION_COOKIE)?.value;
  return token ? readAuthgearSessionToken(token) : null;
}

export function isAllowedAuthgearAdmin(email: string, emailVerified: unknown) {
  if (emailVerified !== true) return false;
  const allowlist = (process.env.AUTHGEAR_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}

export function authgearCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 8
  };
}

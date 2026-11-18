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

export type AuthgearProfileResolution =
  | {
      ok: true;
      sub: string;
      email: string;
      emailVerified: boolean;
      name: string | null;
      source: "id_token" | "userinfo";
    }
  | {
      ok: false;
      reason:
        | "missing_subject"
        | "userinfo_failed"
        | "subject_mismatch"
        | "missing_email"
        | "invalid_userinfo";
    };

export function getAuthgearConfig() {
  const clientId = process.env.AUTHGEAR_CLIENT_ID;
  const sessionSecret = process.env.AUTHGEAR_SESSION_SECRET;
  if (!clientId) throw new Error("AUTHGEAR_CLIENT_ID is not configured.");
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("AUTHGEAR_SESSION_SECRET must contain at least 32 characters.");
  }
  return { clientId, sessionSecret };
}

export function getAuthgearRedirectUri(origin: string) {
  return process.env.AUTHGEAR_REDIRECT_URI || new URL("/authgear/callback", origin).toString();
}

function sessionKey(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest();
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readDisplayName(claims: Record<string, unknown>): string | null {
  return (
    asNonEmptyString(claims.name) ||
    asNonEmptyString(claims.preferred_username) ||
    asNonEmptyString(claims.given_name) ||
    null
  );
}

export function resolveAuthgearProfileFromClaims(
  idTokenClaims: Record<string, unknown>,
  userInfo: Record<string, unknown> | null
): AuthgearProfileResolution {
  const idSub = asNonEmptyString(idTokenClaims.sub);
  if (!idSub) return { ok: false, reason: "missing_subject" };

  const idEmail = asNonEmptyString(idTokenClaims.email);
  if (idEmail) {
    return {
      ok: true,
      sub: idSub,
      email: idEmail,
      emailVerified: idTokenClaims.email_verified === true,
      name: readDisplayName(idTokenClaims),
      source: "id_token",
    };
  }

  if (!userInfo) return { ok: false, reason: "userinfo_failed" };

  const userInfoSub = asNonEmptyString(userInfo.sub);
  if (!userInfoSub) return { ok: false, reason: "invalid_userinfo" };
  if (userInfoSub !== idSub) return { ok: false, reason: "subject_mismatch" };

  const email = asNonEmptyString(userInfo.email);
  if (!email) return { ok: false, reason: "missing_email" };

  return {
    ok: true,
    sub: idSub,
    email,
    emailVerified: userInfo.email_verified === true,
    name: readDisplayName(userInfo) || readDisplayName(idTokenClaims),
    source: "userinfo",
  };
}

export async function fetchAuthgearUserInfo(
  accessToken: string
): Promise<Record<string, unknown> | null> {
  if (!accessToken || typeof accessToken !== "string") return null;
  try {
    const response = await fetch(`${AUTHGEAR_ISSUER}/oauth2/userinfo`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("Authgear UserInfo request failed", { status: response.status });
      return null;
    }
    const data = (await response.json()) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    return data as Record<string, unknown>;
  } catch (error) {
    console.error(
      "Authgear UserInfo request error",
      error instanceof Error ? error.message : "unknown error"
    );
    return null;
  }
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
      audience: SESSION_AUDIENCE,
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    if (payload.role !== "admin" && payload.role !== "client") return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : null,
      role: payload.role,
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
    maxAge: 60 * 60 * 8,
  };
}

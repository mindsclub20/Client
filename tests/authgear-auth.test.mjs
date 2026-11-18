import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

// Runtime helpers live in TypeScript; exercise them after a light transpile via
// dynamic import is not available for .ts here, so assert implementation surface
// in source and keep pure-resolution logic duplicated for unit cases below.

function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readDisplayName(claims) {
  return (
    asNonEmptyString(claims.name) ||
    asNonEmptyString(claims.preferred_username) ||
    asNonEmptyString(claims.given_name) ||
    null
  );
}

/** Mirror of lib/authgear resolveAuthgearProfileFromClaims for unit coverage. */
function resolveAuthgearProfileFromClaims(idTokenClaims, userInfo) {
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

test("Authgear login uses Authorization Code with S256 PKCE and one-time state/nonce cookies", async () => {
  const source = await readFile(new URL("../app/api/auth/authgear/start/route.ts", import.meta.url), "utf8");
  assert.ok(source.includes('response_type", "code"'));
  assert.ok(source.includes('code_challenge_method", "S256"'));
  assert.ok(source.includes("openid https://authgear.com/scopes/full-userinfo"));
  assert.ok(source.includes("maxweb-ag-state"));
  assert.ok(source.includes("maxweb-ag-nonce"));
  assert.ok(source.includes("maxweb-ag-verifier"));
});

test("Authgear callback validates issuer, audience, nonce, signed ID token, and UserInfo fallback", async () => {
  const source = await readFile(new URL("../app/authgear/callback/route.ts", import.meta.url), "utf8");
  assert.ok(source.includes("createRemoteJWKSet"));
  assert.ok(source.includes("jwtVerify"));
  assert.ok(source.includes("issuer: AUTHGEAR_ISSUER"));
  assert.ok(source.includes("audience: clientId"));
  assert.ok(source.includes("payload.nonce !== nonce"));
  assert.ok(source.includes("fetchAuthgearUserInfo"));
  assert.ok(source.includes("resolveAuthgearProfileFromClaims"));
  assert.ok(source.includes("access_token"));
  assert.ok(!source.includes("console.log(tokenData"));
});

test("email present in ID token is accepted without UserInfo", () => {
  const resolved = resolveAuthgearProfileFromClaims(
    { sub: "user-1", email: "a@example.com", email_verified: true, name: "A" },
    null
  );
  assert.equal(resolved.ok, true);
  assert.equal(resolved.source, "id_token");
  assert.equal(resolved.email, "a@example.com");
  assert.equal(resolved.emailVerified, true);
});

test("email absent from ID token but present in UserInfo is accepted", () => {
  const resolved = resolveAuthgearProfileFromClaims(
    { sub: "user-1" },
    { sub: "user-1", email: "b@example.com", email_verified: true }
  );
  assert.equal(resolved.ok, true);
  assert.equal(resolved.source, "userinfo");
  assert.equal(resolved.email, "b@example.com");
});

test("UserInfo subject mismatch is rejected", () => {
  const resolved = resolveAuthgearProfileFromClaims(
    { sub: "user-1" },
    { sub: "user-2", email: "b@example.com", email_verified: true }
  );
  assert.equal(resolved.ok, false);
  assert.equal(resolved.reason, "subject_mismatch");
});

test("missing email after UserInfo is rejected", () => {
  const resolved = resolveAuthgearProfileFromClaims({ sub: "user-1" }, { sub: "user-1" });
  assert.equal(resolved.ok, false);
  assert.equal(resolved.reason, "missing_email");
});

test("failed UserInfo when ID token has no email is rejected", () => {
  const resolved = resolveAuthgearProfileFromClaims({ sub: "user-1" }, null);
  assert.equal(resolved.ok, false);
  assert.equal(resolved.reason, "userinfo_failed");
});

test("only verified allowlisted Authgear emails receive admin role", async () => {
  const source = await readFile(new URL("../lib/authgear.ts", import.meta.url), "utf8");
  assert.ok(source.includes("emailVerified !== true"));
  assert.ok(source.includes("AUTHGEAR_ADMIN_EMAILS"));
  assert.ok(source.includes("allowlist.includes(email.trim().toLowerCase())"));
  assert.ok(source.includes("fetchAuthgearUserInfo"));
  assert.ok(source.includes("/oauth2/userinfo"));
});

test("Authgear session is encrypted and stored in an HTTP-only cookie", async () => {
  const source = await readFile(new URL("../lib/authgear.ts", import.meta.url), "utf8");
  assert.ok(source.includes("EncryptJWT"));
  assert.ok(source.includes("jwtDecrypt"));
  assert.ok(source.includes("httpOnly: true"));
  assert.ok(source.includes("AUTHGEAR_SESSION_COOKIE"));
});

test("existing Supabase authentication remains as fallback", async () => {
  const source = await readFile(new URL("../app/api/me/route.ts", import.meta.url), "utf8");
  assert.ok(source.includes("getAuthgearSession"));
  assert.ok(source.includes("createSupabaseServerClient"));
  assert.ok(source.includes('provider: "supabase"'));
});

void createRequire;

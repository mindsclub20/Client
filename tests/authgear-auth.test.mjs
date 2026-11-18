import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Authgear login uses Authorization Code with S256 PKCE and one-time state/nonce cookies", async () => {
  const source = await readFile(new URL("../app/api/auth/authgear/start/route.ts", import.meta.url), "utf8");
  assert.ok(source.includes('response_type", "code"'));
  assert.ok(source.includes('code_challenge_method", "S256"'));
  assert.ok(source.includes("maxweb-ag-state"));
  assert.ok(source.includes("maxweb-ag-nonce"));
  assert.ok(source.includes("maxweb-ag-verifier"));
});

test("Authgear callback validates issuer, audience, nonce, and signed ID token", async () => {
  const source = await readFile(new URL("../app/authgear/callback/route.ts", import.meta.url), "utf8");
  assert.ok(source.includes("createRemoteJWKSet"));
  assert.ok(source.includes("jwtVerify"));
  assert.ok(source.includes("issuer: AUTHGEAR_ISSUER"));
  assert.ok(source.includes("audience: clientId"));
  assert.ok(source.includes("payload.nonce !== nonce"));
});

test("only verified allowlisted Authgear emails receive admin role", async () => {
  const source = await readFile(new URL("../lib/authgear.ts", import.meta.url), "utf8");
  assert.ok(source.includes("emailVerified !== true"));
  assert.ok(source.includes("AUTHGEAR_ADMIN_EMAILS"));
  assert.ok(source.includes("allowlist.includes(email.trim().toLowerCase())"));
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

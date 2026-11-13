import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { safeAuthNextPath } from "../lib/auth-redirect.js";

test("accepts same-origin app paths for OAuth return navigation", () => {
  assert.equal(safeAuthNextPath("/#portal"), "/#portal");
  assert.equal(safeAuthNextPath("/client?tab=projects"), "/client?tab=projects");
});

test("rejects external and protocol-relative OAuth return destinations", () => {
  assert.equal(safeAuthNextPath("https://example.com"), "/#login");
  assert.equal(safeAuthNextPath("//example.com"), "/#login");
  assert.equal(safeAuthNextPath("javascript:alert(1)"), "/#login");
  assert.equal(safeAuthNextPath(""), "/#login");
});

test("Google OAuth route uses Supabase PKCE callback and safe local return path", async () => {
  const route = await readFile(new URL("../app/api/auth/sign-in/google/route.ts", import.meta.url), "utf8");
  assert.match(route, /provider:\s*"google"/);
  assert.match(route, /\/auth\/callback/);
  assert.match(route, /safeAuthNextPath/);
  assert.match(route, /NextResponse\.redirect/);
  assert.doesNotMatch(route, /SERVICE_ROLE|service_role/i);
});

test("login script adds a separate Google sign-in action without submitting the password form", async () => {
  const script = await readFile(new URL("../public/js/auth.js", import.meta.url), "utf8");
  assert.match(script, /googleSignIn/);
  assert.match(script, /\/api\/auth\/sign-in\/google/);
  assert.match(script, /insertAdjacentElement/);
});

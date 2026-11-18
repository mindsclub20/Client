import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const authScript = await readFile(new URL("../public/js/auth.js", import.meta.url), "utf8");
const clientDashboard = await readFile(new URL("../app/client/client-dashboard.tsx", import.meta.url), "utf8");
const adminPage = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
const profile = await readFile(new URL("../app/components/account-profile.tsx", import.meta.url), "utf8");

test("unauthenticated Login navigation goes directly to the Authgear hosted flow", () => {
  assert.match(authScript, /window\.location\.replace\(["']\/api\/auth\/authgear\/start["']\)/);
  assert.match(authScript, /setAttribute\(["']href["'],\s*user\s*\?/);
  assert.doesNotMatch(authScript, /: "#login"/);
});

test("client dashboard renders a bottom-left default profile avatar and account email", () => {
  assert.match(clientDashboard, /<AccountProfile\s+email=\{userEmail\}/);
  assert.match(clientDashboard, /import AccountProfile from ["']@\/app\/components\/account-profile["']/);
  assert.match(profile, /position:\s*["']fixed["']/);
  assert.match(profile, /bottom:/);
  assert.match(profile, /Default profile picture/);
  assert.match(profile, /email/);
  assert.match(adminPage, /<AccountProfile\s+email=\{user\.email/);
});

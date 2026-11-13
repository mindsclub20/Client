import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin authorization reads only trusted Supabase app_metadata", async () => {
  const source = await readFile(new URL("../lib/admin-auth.ts", import.meta.url), "utf8");
  assert.ok(source.includes("auth.getUser()"));
  assert.ok(source.includes('user.app_metadata?.role === "admin"'));
  assert.ok(!source.includes("user_metadata"));
});

test("admin dashboard is server-gated and redirects non-admin users", async () => {
  const page = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("getCurrentAdminContext"));
  assert.ok(page.includes('redirect("/#login")'));
  assert.ok(page.includes('redirect("/client")'));
});

test("admin status endpoint distinguishes unauthenticated and forbidden users", async () => {
  const route = await readFile(new URL("../app/api/admin/me/route.ts", import.meta.url), "utf8");
  assert.ok(route.includes("getCurrentAdminContext"));
  assert.ok(route.includes("status: 401"));
  assert.ok(route.includes("status: 403"));
});

test("admin login and portal navigation route admins to the protected dashboard", async () => {
  const source = await readFile(new URL("../public/js/auth.js", import.meta.url), "utf8");
  assert.ok(source.includes('user && user.role === "admin"'));
  assert.ok(source.includes('window.location.replace("/admin")'));
  assert.ok(source.includes('user.role === "admin" ? "/admin" : "/client"'));
});


test("admin dashboard exposes a logout control wired to the server sign-out endpoint", async () => {
  const page = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const control = await readFile(new URL("../app/admin/admin-logout-button.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("AdminLogoutButton"));
  assert.ok(control.includes('fetch("/api/auth/sign-out"'));
  assert.ok(control.includes('window.location.replace("/#login")'));
});

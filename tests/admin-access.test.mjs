import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin authorization reads only trusted Supabase app_metadata", async () => {
  const source = await readFile(new URL("../lib/admin-auth.ts", import.meta.url), "utf8");
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /user\.app_metadata\?\.role\s*===\s*["']admin["']/);
  assert.doesNotMatch(source, /user_metadata|raw_user_meta_data/);
});

test("admin dashboard is server-gated and redirects non-admin users", async () => {
  const page = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  assert.match(page, /getCurrentAdminContext/);
  assert.match(page, /redirect\(["']\/#login["']\)/);
  assert.match(page, /redirect\(["']\/#portal["']\)/);
});

test("admin status endpoint distinguishes unauthenticated and forbidden users", async () => {
  const route = await readFile(new URL("../app/api/admin/me/route.ts", import.meta.url), "utf8");
  assert.match(route, /getCurrentAdminContext/);
  assert.match(route, /status:\s*401/);
  assert.match(route, /status:\s*403/);
});

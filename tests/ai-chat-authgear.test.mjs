import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { authgearSubjectToUserId } from "../lib/ai/authgear-user-id.mjs";

const route = await readFile(new URL("../app/api/ai/chat/route.ts", import.meta.url), "utf8");
const context = await readFile(new URL("../lib/ai/auth-context.ts", import.meta.url), "utf8");
const adminPage = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");

test("Authgear subjects map deterministically to valid UUIDs for the UUID user_id column", () => {
  const first = authgearSubjectToUserId("https://issuer.example", "authgear-subject-123");
  const second = authgearSubjectToUserId("https://issuer.example", "authgear-subject-123");
  const other = authgearSubjectToUserId("https://issuer.example", "different-subject");

  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(first, other);
});

test("AI chat resolves Authgear and Supabase users through a shared ownership context", () => {
  assert.match(context, /getAuthgearSession/);
  assert.match(context, /authgearSubjectToUserId/);
  assert.match(context, /createSupabaseAdminClient/);
  assert.match(context, /createSupabaseServerClient/);
  assert.match(route, /getCurrentAIUserContext/);
  assert.match(route, /conversation\.user_id !== user\.id/);
  assert.match(route, /status: 403/);
});

test("admin dashboard mounts the AI summary monitor after its admin authorization guard", () => {
  const authIndex = adminPage.indexOf('if (!isAdmin) redirect("/client")');
  const monitorIndex = adminPage.indexOf("<AdminAISummaryMonitor");
  assert.ok(authIndex >= 0);
  assert.ok(monitorIndex > authIndex);
  assert.match(adminPage, /import AdminAISummaryMonitor from ".\/ai-summary-monitor"/);
});

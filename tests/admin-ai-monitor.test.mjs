import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const adminPage = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
const monitor = await readFile(new URL("../app/admin/ai-summary-monitor.tsx", import.meta.url), "utf8");

test("admin dashboard mounts the monitor only after the admin authorization guard", () => {
  const authIndex = adminPage.indexOf('if (!isAdmin) redirect("/client")');
  const renderIndex = adminPage.indexOf("<AdminAISummaryMonitor />");
  assert.ok(authIndex >= 0, "admin authorization guard exists");
  assert.ok(renderIndex > authIndex, "monitor is rendered after the admin guard");
  assert.match(adminPage, /import AdminAISummaryMonitor from ".\/ai-summary-monitor"/);
});

test("admin monitor reads protected summary jobs through the server-only admin client", () => {
  assert.match(monitor, /createSupabaseAdminClient/);
  assert.match(monitor, /\.from\("ai_summary_jobs"\)/);
  assert.match(monitor, /\.from\("ai_conversations"\)/);
  assert.match(monitor, /\.from\("ai_messages"\)/);
  assert.match(monitor, /Latest customer message/);
});

test("admin monitor exposes pending, processing, completed, and failed retry states", () => {
  assert.match(monitor, /Pending/);
  assert.match(monitor, /Processing/);
  assert.match(monitor, /Completed/);
  assert.match(monitor, /Failed \/ retrying/);
});

test("admin monitor shows retry count, next retry, last error, and generated summary", () => {
  assert.match(monitor, /attempts/);
  assert.match(monitor, /next_attempt_at/);
  assert.match(monitor, /last_error/);
  assert.match(monitor, /summary/);
});

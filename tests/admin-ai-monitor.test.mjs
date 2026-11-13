import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const adminPage = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");

test("admin AI monitor reads summary jobs only after admin authentication", () => {
  const authIndex = adminPage.indexOf("if (!isAdmin) redirect(\"/client\")");
  const jobsIndex = adminPage.indexOf('.from("ai_summary_jobs")');
  assert.ok(authIndex >= 0, "admin authorization guard exists");
  assert.ok(jobsIndex > authIndex, "summary queue query follows the admin guard");
  assert.match(adminPage, /createSupabaseAdminClient/);
});

test("admin AI monitor exposes pending, processing, completed, and failed job states", () => {
  assert.match(adminPage, /Summary job monitor/);
  assert.match(adminPage, /Pending/);
  assert.match(adminPage, /Processing/);
  assert.match(adminPage, /Completed/);
  assert.match(adminPage, /Failed/);
});

test("admin AI monitor shows retries, next retry, last error, and conversation summary", () => {
  assert.match(adminPage, /attempts/);
  assert.match(adminPage, /next_attempt_at/);
  assert.match(adminPage, /last_error/);
  assert.match(adminPage, /summary/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile(
  new URL("../app/api/cron/summarize-conversations/route.ts", import.meta.url),
  "utf8"
);
const admin = await readFile(
  new URL("../lib/supabase/admin.ts", import.meta.url),
  "utf8"
);
const migration = await readFile(
  new URL("../supabase/migrations/202611130002_ai_summary_job_queue.sql", import.meta.url),
  "utf8"
);

test("cron requires a configured bearer secret and rejects the Vercel header as authentication", () => {
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /authorization\.slice\("Bearer "\.length\)/);
  assert.doesNotMatch(route, /x-vercel-cron/);
  assert.match(route, /if \(!expected \|\| !authorization\.startsWith\("Bearer "\)\) return false/);
});

test("summary history uses the newest messages and restores chronological order", () => {
  assert.match(route, /order\("created_at",\s*\{\s*ascending:\s*false\s*\}\)/);
  assert.match(route, /history\.reverse\(\)/);
});

test("cron delegates fair candidate selection and atomic leases to database RPC", () => {
  assert.match(route, /rpc\("claim_ai_summary_jobs"/);
  assert.match(route, /rpc\("finish_ai_summary_job"/);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /lease_until/);
  assert.match(migration, /next_attempt_at/);
});

test("summary writes are conditional on the exact source updated_at snapshot", () => {
  assert.match(migration, /updated_at = p_source_updated_at/);
  assert.match(migration, /conversation_changed_during_summary/);
});

test("failed summary jobs use bounded exponential retry backoff", () => {
  assert.match(migration, /power\(2/);
  assert.match(migration, /3600/);
  assert.match(migration, /last_error/);
});

test("service-role Supabase client is explicitly server-only", () => {
  assert.match(admin, /^import ["']server-only["'];/);
});

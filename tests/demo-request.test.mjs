import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const client = await readFile(new URL("../app/client/client-dashboard.tsx", import.meta.url), "utf8");
const demoApi = await readFile(
  new URL("../app/api/client/demo-request/route.ts", import.meta.url),
  "utf8"
);
const adminPanel = await readFile(
  new URL("../app/admin/ai-conversations-panel.tsx", import.meta.url),
  "utf8"
);
const adminPage = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
const vercel = await readFile(new URL("../vercel.json", import.meta.url), "utf8");

test("client can request a demo via dedicated API", () => {
  assert.match(client, /requestDemo/);
  assert.match(client, /\/api\/client\/demo-request/);
  assert.match(client, /Request demo/);
  assert.match(demoApi, /demo_requested_at/);
  assert.match(demoApi, /\[DEMO REQUEST\]/);
});

test("admin shows full transcripts and the summary monitor as separate modules", () => {
  assert.match(adminPanel, /full[\\s\\S]{0,40}transcript/i);
  assert.match(adminPanel, /messagesByConversation/);
  assert.doesNotMatch(adminPanel, /Needs summary/);
  const authIndex = adminPage.indexOf('if (!isAdmin) redirect("/client")');
  const monitorIndex = adminPage.indexOf("<AdminAISummaryMonitor />");
  assert.ok(monitorIndex > authIndex);
});

test("summary cron is configured for daily 05:30 IST", () => {
  const parsed = JSON.parse(vercel);
  assert.deepEqual(parsed.crons, [
    { path: "/api/cron/summarize-conversations", schedule: "0 0 * * *" },
  ]);
});

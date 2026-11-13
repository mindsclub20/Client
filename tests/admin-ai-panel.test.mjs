import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const adminPage = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
const statusCard = await readFile(
  new URL("../app/admin/ai-status-card.tsx", import.meta.url),
  "utf8"
);
const conversationsPanel = await readFile(
  new URL("../app/admin/ai-conversations-panel.tsx", import.meta.url),
  "utf8"
);
const health = await readFile(new URL("../app/api/ai/health/route.ts", import.meta.url), "utf8");

test("admin page mounts AI status, summary monitor, and conversations panel after admin guard", () => {
  const authIndex = adminPage.indexOf('if (!isAdmin) redirect("/client")');
  const statusIndex = adminPage.indexOf("<AdminAIStatusCard");
  const monitorIndex = adminPage.indexOf("<AdminAISummaryMonitor");
  const panelIndex = adminPage.indexOf("<AdminAIConversationsPanel");
  assert.ok(authIndex >= 0);
  assert.ok(statusIndex > authIndex);
  assert.ok(monitorIndex > authIndex);
  assert.ok(panelIndex > authIndex);
});

test("AI status card probes Gemini without logging or returning the API key", () => {
  assert.match(statusCard, /MAXWEB_AI_API_KEY2/);
  assert.match(statusCard, /models\/\$\{encodeURIComponent\(model\)\}/);
  assert.doesNotMatch(statusCard, /console\.(?:log|error|warn)\([^)]*apiKey/);
  assert.doesNotMatch(statusCard, /return[\s\S]*apiKey/);
});

test("conversations panel surfaces last customer and assistant messages plus summary state", () => {
  assert.match(conversationsPanel, /lastUserMessageById/);
  assert.match(conversationsPanel, /lastAssistantMessageById/);
  assert.match(conversationsPanel, /Needs summary/);
  assert.match(conversationsPanel, /Summarized/);
  assert.match(conversationsPanel, /Avg current price/);
});

test("AI health endpoint is administrator-only", () => {
  assert.match(health, /getCurrentAdminContext/);
  assert.match(health, /forbidden/);
  assert.match(health, /isAdmin/);
});

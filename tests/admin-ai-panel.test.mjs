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

test("AI status card keeps the Gemini API key server-side and describes metadata-only checks accurately", () => {
  assert.match(statusCard, /MAXWEB_AI_API_KEY2/);
  assert.match(statusCard, /models\/\$\{encodeURIComponent\(model\)\}/);
  assert.match(statusCard, /headers:\s*\{\s*"x-goog-api-key":\s*apiKey\s*\}/);
  assert.doesNotMatch(statusCard, /console\.(?:log|error|warn)\([^)]*apiKey/);
  assert.doesNotMatch(statusCard, /\{\s*apiKey\s*\}/);
  assert.doesNotMatch(statusCard, /(?:JSON\.stringify|NextResponse\.json|Response\.json)[\s\S]{0,160}\bapiKey\b/);
  assert.match(statusCard, /Gemini model metadata is reachable\. GenerateContent has not been verified\./);
  assert.doesNotMatch(statusCard, /Chat and summaries can run/);
});

test("conversations panel groups clients and renders full chronological transcripts", () => {
  assert.ok(conversationsPanel.includes("messagesByConversation"));
  assert.ok(conversationsPanel.toLowerCase().includes("full"));
  assert.ok(conversationsPanel.toLowerCase().includes("transcript"));
  assert.ok(conversationsPanel.includes("thread.map((m, index)"));
  assert.ok(conversationsPanel.includes("m.content"));
  assert.ok(conversationsPanel.includes("createVerifiedAdminDataClient"));
  assert.doesNotMatch(conversationsPanel, /Needs summary|Summarized/);
});

test("AI health endpoint is administrator-only", () => {
  assert.match(health, /getCurrentAdminContext/);
  assert.match(health, /forbidden/);
  assert.match(health, /isAdmin/);
});

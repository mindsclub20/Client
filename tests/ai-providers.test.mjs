import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/ai/chat/route.ts", import.meta.url), "utf8");
const client = await readFile(new URL("../app/client/client-dashboard.tsx", import.meta.url), "utf8");
const cron = await readFile(
  new URL("../app/api/cron/summarize-conversations/route.ts", import.meta.url),
  "utf8"
);

test("MAXWEB uses only MAXWEB_AI_API_KEY2 for Gemini", () => {
  assert.match(source, /process\.env\.MAXWEB_AI_API_KEY2/);
  assert.doesNotMatch(source, /process\.env\.MAXWEB_AI_API_KEY(?:\?|\s|\.)/);
  assert.match(source, /callGemini\(geminiKey/);
  assert.doesNotMatch(source, /callGlm\(/);
});

test("Gemini prefers fast lite model with fallbacks", () => {
  assert.match(source, /DEFAULT_GEMINI_MODEL\s*=\s*"gemini-3\.5-flash-lite"/);
  assert.match(source, /GEMINI_MODEL_FALLBACKS/);
  assert.match(source, /maxOutputTokens/);
  assert.match(source, /MAXWEB_GEMINI_MODEL/);
});

test("Gemini retries only transient failures with bounded attempts", () => {
  assert.match(source, /GEMINI_MAX_ATTEMPTS\s*=\s*3/);
  assert.match(source, /backoffMs/);
  assert.match(source, /Gemini transient failure; retrying/);
});

test("chat route uses shorter history and fast options", () => {
  assert.match(route, /HISTORY_LIMIT\s*=\s*12/);
  assert.match(route, /maxOutputTokens:\s*280/);
});

test("scheduled summary cron uses same Gemini key path", () => {
  assert.match(cron, /claim_ai_summary_jobs/);
  assert.match(cron, /SUMMARY_SYSTEM_PROMPT/);
  assert.match(cron, /completeAI/);
  assert.match(cron, /CRON_SECRET/);
  assert.doesNotMatch(cron, /x-vercel-cron/);
});

test("client identifies the consultant as Gemini only", () => {
  assert.match(client, /AI CONSULTANT · GEMINI/);
});

test("failed AI calls do not insert an assistant message", () => {
  const assistantInsert = route.indexOf('role: "assistant"');
  const geminiCall = route.indexOf("await completeAI");
  assert.ok(geminiCall > 0 && assistantInsert > geminiCall);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/ai/chat/route.ts", import.meta.url), "utf8");
const client = await readFile(new URL("../app/client/client-dashboard.tsx", import.meta.url), "utf8");

test("MAXWEB uses only MAXWEB_AI_API_KEY2 for Gemini", () => {
  assert.match(source, /process\.env\.MAXWEB_AI_API_KEY2/);
  assert.doesNotMatch(source, /process\.env\.MAXWEB_AI_API_KEY(?:\?|\s|\.)/);
  assert.match(source, /callGemini\(geminiKey/);
  assert.doesNotMatch(source, /callGlm\(/);
});

test("Gemini uses the configured current model default", () => {
  assert.match(source, /DEFAULT_GEMINI_MODEL\s*=\s*"gemini-3\.8-flash"/);
  assert.match(source, /MAXWEB_GEMINI_MODEL/);
  assert.match(source, /generativelanguage\.googleapis\.com\/v1beta\/models/);
  assert.match(source, /"x-goog-api-key": apiKey/);
});

test("Gemini retries only transient failures with bounded attempts", () => {
  assert.match(source, /GEMINI_MAX_ATTEMPTS\s*=\s*3/);
  assert.match(source, /backoffMs/);
  assert.match(source, /Gemini transient failure; retrying/);
  assert.match(source, /httpStatus === 401/);
});

test("chat route requires only the Gemini key", () => {
  assert.match(route, /process\.env\.MAXWEB_AI_API_KEY2/);
  assert.doesNotMatch(route, /process\.env\.MAXWEB_AI_API_KEY(?:\?|\s|\.)/);
  assert.match(route, /MAXWEB_AI_API_KEY2 \(Gemini\)/);
});

test("client identifies the consultant as Gemini only", () => {
  assert.match(client, /AI CONSULTANT · GEMINI/);
  assert.doesNotMatch(client, /GLM\s*\/\s*GEMINI/i);
});

test("credentials never appear in logs", () => {
  assert.doesNotMatch(source, /console\.(?:log|error|warn)\([^\n]*(?:apiKey|Authorization|x-goog-api-key|MAXWEB_AI_API_KEY)/);
});

test("failed AI calls do not insert an assistant message", () => {
  const assistantInsert = route.indexOf('role: "assistant"');
  const geminiCall = route.indexOf("await completeAI");
  assert.ok(geminiCall > 0 && assistantInsert > geminiCall);
});

test("quote approval rules remain unchanged", () => {
  assert.doesNotMatch(route, /updates\.agreed_price\s*=/);
  assert.doesNotMatch(route, /updates\.status\s*=\s*["']completed["']/);
});

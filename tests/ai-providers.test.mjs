import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
const route = await readFile(
  new URL("../app/api/ai/chat/route.ts", import.meta.url),
  "utf8"
);

test("GLM primary uses MAXWEB_AI_API_KEY and Gemini fallback uses MAXWEB_AI_API_KEY2", () => {
  assert.match(source, /const glmKey = process\.env\.MAXWEB_AI_API_KEY/);
  assert.match(source, /const geminiKey = process\.env\.MAXWEB_AI_API_KEY2/);
  assert.match(source, /callGlm\(glmKey/);
  assert.match(source, /callGemini\(geminiKey/);
});

test("GLM success path is attempted before Gemini", () => {
  const glmIdx = source.indexOf("if (glmKey)");
  const geminiIdx = source.indexOf("if (geminiKey)");
  assert.ok(glmIdx > 0 && geminiIdx > glmIdx);
  assert.match(source, /GLM primary failed; trying Gemini fallback/);
});

test("GLM auth failures are classified and not treated as timeouts", () => {
  assert.match(source, /glm_auth_failed/);
  assert.match(source, /status === 401 \|\| status === 403/);
  assert.match(source, /retryable: false/);
});

test("Gemini retries only transient failures with bounded attempts", () => {
  assert.match(source, /GEMINI_MAX_ATTEMPTS\s*=\s*3/);
  assert.match(source, /backoffMs/);
  assert.match(source, /Gemini transient failure; retrying/);
  assert.match(source, /pe\.code === "gemini_auth_failed"/);
  assert.match(source, /httpStatus === 401/);
});

test("both providers failing returns providers_unavailable", () => {
  assert.match(source, /providers_unavailable/);
  assert.match(source, /AI providers unavailable\. GLM:/);
});

test("credentials never appear in logs or thrown messages", () => {
  assert.doesNotMatch(
    source,
    /console\.(?:log|error|warn)\([^\n]*(?:apiKey|Authorization|x-goog-api-key|MAXWEB_AI_API_KEY)/
  );
  assert.doesNotMatch(route, /console\.(?:log|error)\([^\n]*MAXWEB_AI_API_KEY/);
});

test("failed AI calls do not insert an assistant message", () => {
  // Assistant insert happens only after grokChat resolves.
  const assistantInsert = route.indexOf('role: "assistant"');
  const grokCall = route.indexOf("await grokChat");
  assert.ok(grokCall > 0 && assistantInsert > grokCall);
  assert.match(route, /Never write a fake assistant reply on failure/);
});

test("chat route maps ProviderError codes to client-safe responses", () => {
  assert.match(route, /err\.code/);
  assert.match(route, /glm_auth_failed/);
  assert.match(route, /providers_unavailable/);
  assert.match(route, /conversationId/);
});

test("quote approval rules remain unchanged", () => {
  assert.doesNotMatch(route, /updates\.agreed_price\s*=/);
  assert.doesNotMatch(route, /updates\.status\s*=\s*["']completed["']/);
});

test("timeouts use AbortSignal and shorter provider budgets", () => {
  assert.match(source, /AbortSignal\.timeout\(GLM_TIMEOUT_MS\)/);
  assert.match(source, /AbortSignal\.timeout\(GEMINI_TIMEOUT_MS\)/);
  assert.match(source, /provider_timeout/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("MAXWEB routes API key 1 to GLM and API key 2 to Gemini", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /const glmKey = process\.env\.MAXWEB_AI_API_KEY/);
  assert.match(source, /const geminiKey = process\.env\.MAXWEB_AI_API_KEY2/);
  assert.match(source, /callGlm\(glmKey/);
  assert.match(source, /callGemini\(geminiKey/);
  assert.doesNotMatch(source, /api\.x\.ai/);
});

test("MAXWEB sends key 1 to the GLM OpenAI-compatible chat completions API", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /https:\/\/api\.z\.ai\/api\/paas\/v4\/chat\/completions/);
  assert.match(source, /Authorization:\s*`Bearer \$\{apiKey\}`/);
  assert.match(source, /DEFAULT_GLM_MODEL\s*=\s*"glm-5\.3-flash"/);
  assert.match(source, /choices\?\.\[0\]\?\.message/);
  assert.match(source, /MAXWEB_GLM_MODEL/);
});

test("MAXWEB sends key 2 to Gemini GenerateContent as fallback", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /generativelanguage\.googleapis\.com\/v1beta\/models/);
  assert.match(source, /"x-goog-api-key": apiKey/);
  assert.match(source, /candidates/);
  assert.match(source, /MAXWEB_GEMINI_MODEL/);
});

test("MAXWEB logs safe provider rejection details without logging credentials", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /GLM chat completion request rejected/);
  assert.match(source, /Gemini GenerateContent request rejected/);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:apiKey|Authorization|x-goog-api-key)/);
});

test("client only shows missing-key guidance for the explicit configuration error code", async () => {
  const source = await readFile(new URL("../app/client/client-dashboard.tsx", import.meta.url), "utf8");
  assert.match(source, /data\?\.error\s*===\s*"ai_not_configured"/);
  assert.doesNotMatch(source, /data\?\.message\?\.includes\(["']API key["']\)/);
});

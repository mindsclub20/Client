import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("MAXWEB reads only the Gemini API key from server environment", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /const geminiKey = process\.env\.MAXWEB_AI_API_KEY2/);
  assert.doesNotMatch(source, /process\.env\.MAXWEB_AI_API_KEY(?:\?|\s|\.)/);
  assert.match(source, /callGemini\(geminiKey/);
  assert.doesNotMatch(source, /callGlm\(/);
});

test("MAXWEB uses Gemini GenerateContent and the configured default model", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /GEMINI_BASE\s*=\s*"https:\/\/generativelanguage\.googleapis\.com\/v1beta"/);
  assert.match(source, /models\/\$\{encodeURIComponent\(model\)\}:generateContent/);
  assert.match(source, /"x-goog-api-key": apiKey/);
  assert.match(source, /DEFAULT_GEMINI_MODEL\s*=\s*"gemini-3\.8-flash"/);
  assert.match(source, /MAXWEB_GEMINI_MODEL/);
  assert.match(source, /candidates/);
});

test("MAXWEB logs safe Gemini rejection details without logging credentials", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /Gemini GenerateContent request rejected/);
  assert.doesNotMatch(source, /console\.(?:log|error|warn)\([^
]*(?:apiKey|Authorization|x-goog-api-key)/);
});

test("client only shows missing-key guidance for the explicit configuration error code", async () => {
  const source = await readFile(new URL("../app/client/client-dashboard.tsx", import.meta.url), "utf8");
  assert.match(source, /code === "ai_not_configured"/);
  assert.doesNotMatch(source, /data\?\.message\?\.includes\(["']API key["']\)/);
});

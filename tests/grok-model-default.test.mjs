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

test("MAXWEB uses fast Gemini defaults and fallbacks", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /DEFAULT_GEMINI_MODEL\s*=\s*"gemini-3\.5-flash-lite"/);
  assert.match(source, /gemini-3\.6-flash/);
  assert.match(source, /gemini-3\.8-flash/);
  assert.match(source, /maxOutputTokens/);
  assert.match(source, /generationConfig/);
});

test("MAXWEB logs safe Gemini rejection details without logging credentials", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /Gemini GenerateContent request rejected/);
  assert.doesNotMatch(source, /console\.(?:log|error|warn)\([^)]*apiKey/);
});

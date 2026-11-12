import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("MAXWEB keeps the xAI key separate from the Gemini fallback key", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /process\.env\.MAXWEB_AI_API_KEY\b/);
  assert.doesNotMatch(source, /process\.env\.MAXWEB_AI_API_KEY2/);
  assert.match(source, /process\.env\.MAXWEB_AI_API_KEY2/);
});

test("MAXWEB sends the secondary key to Gemini GenerateContent, not xAI", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /generativelanguage\.googleapis\.com\/v1beta\/models/);
  assert.match(source, /x-goog-api-key/);
  assert.match(source, /candidates/);
  assert.match(source, /MAXWEB_GEMINI_MODEL/);
});

test("MAXWEB keeps Grok on the xAI Responses API", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /DEFAULT_GROK_MODEL\s*=\s*"grok-4\.7"/);
  assert.match(source, /api\.x\.ai\/v1/);
  assert.match(source, /\/responses/);
  assert.match(source, /input:\s*messages/);
  assert.doesNotMatch(source, /\/chat\/completions/);
});

test("MAXWEB records safe provider rejection details without logging credentials", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /await response\.text\(\)/);
  assert.match(source, /xAI Responses request rejected/);
  assert.match(source, /Gemini GenerateContent request rejected/);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:apiKeys|Authorization|x-goog-api-key)/);
});

test("client only shows missing-key guidance for the explicit configuration error code", async () => {
  const source = await readFile(new URL("../app/client/client-dashboard.tsx", import.meta.url), "utf8");
  assert.match(source, /data\?\.error\s*===\s*"ai_not_configured"/);
  assert.doesNotMatch(source, /data\?\.message\?\.includes\(["']API key["']\)/);
});

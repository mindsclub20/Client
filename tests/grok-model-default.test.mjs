import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("MAXWEB reads only the Gemini API key from server environment", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /const geminiKey = process\.env\.MAXWEB_AI_API_KEY2/);
  assert.doesNotMatch(source, /process\.env\.MAXWEB_AI_API_KEY(?:\?|\s|\.)/);
  assert.match(source, /callGemini\(geminiKey/);
  assert.doesNotMatch(source, /callGlm\(/);
  assert.doesNotMatch(source, /api\.x\.ai/);
  assert.doesNotMatch(source, /api\.z\.ai/);
});

test("MAXWEB uses Gemini GenerateContent with documented defaults and fallbacks", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /GEMINI_BASE\s*=\s*"https:\/\/generativelanguage\.googleapis\.com\/v1beta"/);
  assert.match(source, /models\/\$\{encodeURIComponent\(model\)\}:generateContent/);
  assert.match(source, /"x-goog-api-key": apiKey/);
  assert.match(source, /DEFAULT_GEMINI_MODEL\s*=\s*"gemini-3\.8-flash"/);
  assert.match(source, /gemini-3\.6-flash/);
  assert.match(source, /gemini-3\.5-flash-lite/);
  assert.match(source, /GEMINI_MODEL_FALLBACKS/);
  assert.match(source, /MAXWEB_GEMINI_MODEL/);
  assert.match(source, /generationConfig/);
  assert.match(source, /candidates/);
});

test("MAXWEB retries transient Gemini failures and does not retry auth errors", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /GEMINI_MAX_ATTEMPTS\s*=\s*4/);
  assert.match(source, /Gemini transient failure; retrying/);
  assert.match(source, /gemini_auth_failed/);
  assert.match(source, /httpStatus === 401/);
});

test("MAXWEB logs safe Gemini rejection details without logging credentials", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /Gemini GenerateContent request rejected/);
  assert.doesNotMatch(source, /console\.(?:log|error|warn)\([^)]*apiKey/);
});

test("client only shows missing-key guidance for the explicit configuration error code", async () => {
  const source = await readFile(
    new URL("../app/client/client-dashboard.tsx", import.meta.url),
    "utf8"
  );
  assert.match(source, /code === "ai_not_configured"/);
  assert.doesNotMatch(source, /data\?\.message\?\.includes\(["']API key["']\)/);
});

test("quote status degrades on PGRST205 missing relation", async () => {
  const source = await readFile(
    new URL("../app/api/ai/quote/status/route.ts", import.meta.url),
    "utf8"
  );
  assert.match(source, /PGRST205/);
  assert.match(source, /isMissingRelation/);
  assert.match(source, /ai_conversations/);
});

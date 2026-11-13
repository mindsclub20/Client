import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const provider = await readFile(new URL("../lib/ai/provider.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/ai/chat/route.ts", import.meta.url), "utf8");

test("MAXWEB central AI registry exposes Gemini only and reports missing configuration safely", () => {
  assert.match(provider, /MAXWEB_AI_API_KEY2/);
  assert.match(provider, /llm/);
  assert.match(provider, /gemini/);
  assert.doesNotMatch(provider, /GROQ_API_KEY|GLM_API_KEY|FIRECRAWL_API_KEY/);
});

test("MAXWEB chat route calls the central provider workflow", () => {
  assert.match(route, /from ["']@\/lib\/ai\/provider["']/);
  assert.match(route, /completeAI\(/);
  assert.doesNotMatch(route, /grokChat\(/);
});

test("provider registry never returns or logs credentials", () => {
  assert.doesNotMatch(provider, /return[^\n]*(?:apiKey|MAXWEB_AI_API_KEY2)/);
  assert.doesNotMatch(provider, /console\.(?:log|error|warn)/);
});

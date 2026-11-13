import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("MAXWEB AI health checks the Gemini model without exposing the API key", async () => {
  const route = await readFile(new URL("../app/api/ai/health/route.ts", import.meta.url), "utf8");
  assert.match(route, /createSupabaseServerClient/);
  assert.match(route, /supabase\.auth\.getUser/);
  assert.match(route, /MAXWEB_AI_API_KEY2/);
  assert.match(route, /generativelanguage\.googleapis\.com\/v1beta\/models/);
  assert.match(route, /x-goog-api-key/);
  assert.doesNotMatch(route, /return NextResponse\.json\([^\n]*(?:apiKey|MAXWEB_AI_API_KEY2)/);
});

test("MAXWEB chat route validates request size and preserves authenticated ownership", async () => {
  const route = await readFile(new URL("../app/api/ai/chat/route.ts", import.meta.url), "utf8");
  assert.match(route, /MAX_MESSAGE_LENGTH/);
  assert.match(route, /message\.length\s*>\s*MAX_MESSAGE_LENGTH/);
  assert.match(route, /conversation\.user_id !== user\.id/);
  assert.match(route, /conversationId/);
});


test("chat history query loads the newest configured history window and restores chronological order", async () => {
  const route = await readFile(new URL("../app/api/ai/chat/route.ts", import.meta.url), "utf8");
  assert.match(route, /\.order\("created_at", \{ ascending: false \}\)\s*\.limit\(HISTORY_LIMIT\)/);
  assert.match(route, /\[\.\.\.\(history \|\| \[\]\)\]\.reverse\(\)\.map/);
});

test("chat route rejects inactive conversations before persisting a new message", async () => {
  const route = await readFile(new URL("../app/api/ai/chat/route.ts", import.meta.url), "utf8");
  const inactiveCheck = route.indexOf('conversation.status !== "active"');
  const userInsert = route.indexOf('role: "user"');
  assert.ok(inactiveCheck >= 0 && userInsert > inactiveCheck);
});

test("chat route returns generic server errors and verifies conversation updates", async () => {
  const route = await readFile(new URL("../app/api/ai/chat/route.ts", import.meta.url), "utf8");
  assert.match(route, /message: "An unexpected server error occurred\."/);
  assert.match(route, /const \{ error: conversationUpdateError \} = await supabase/);
  assert.match(route, /if \(conversationUpdateError\)/);
});


test("chat route applies a persistent per-user message rate limit before creating conversations", async () => {
  const route = await readFile(new URL("../app/api/ai/chat/route.ts", import.meta.url), "utf8");
  assert.match(route, /AI_RATE_LIMIT_WINDOW_MS\s*=\s*10\s*\*\s*60\s*\*\s*1000/);
  assert.match(route, /AI_RATE_LIMIT_MAX_MESSAGES\s*=\s*10/);
  assert.match(route, /\.eq\("user_id", user\.id\)/);
  assert.match(route, /\.eq\("role", "user"\)/);
  assert.match(route, /status: 429/);
  assert.ok(route.indexOf("AI_RATE_LIMIT_MAX_MESSAGES") < route.indexOf('if (!conversationId)'));
});

test("Gemini model configuration normalizes models prefix and rejects unsafe path values", async () => {
  const provider = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  const health = await readFile(new URL("../app/api/ai/health/route.ts", import.meta.url), "utf8");
  assert.match(provider, /normalizeGeminiModel/);
  assert.match(provider, /startsWith\("models\/"\)/);
  assert.match(provider, /options\?\.model/);
  assert.match(health, /normalizeGeminiModel/);
});

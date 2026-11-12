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

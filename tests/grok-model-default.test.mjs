import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("MAXWEB uses the current Grok Responses API contract", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /DEFAULT_GROK_MODEL\s*=\s*"grok-4\.7"/);
  assert.match(source, /\/responses/);
  assert.match(source, /input:\s*messages/);
  assert.match(source, /output_text/);
  assert.doesNotMatch(source, /\/chat\/completions/);
  assert.doesNotMatch(source, /grok-4-0709/);
});

test("MAXWEB records safe provider rejection details without logging credentials", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /response\.json\(\)\.catch/);
  assert.match(source, /xAI Responses request rejected/);
  assert.match(source, /providerMessage\.slice\(0,\s*300\)/);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:apiKeys|Authorization)/);
});

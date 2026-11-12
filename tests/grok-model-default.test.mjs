import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("MAXWEB defaults to the currently supported Grok chat model", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /export const DEFAULT_GROK_MODEL\s*=\s*"grok-4\.7"/);
  assert.match(source, /options\?\.model\s*\|\|\s*DEFAULT_GROK_MODEL/);
  assert.doesNotMatch(source, /grok-4-0709/);
});

test("MAXWEB records safe xAI rejection details without logging API credentials", async () => {
  const source = await readFile(new URL("../lib/ai/grok.ts", import.meta.url), "utf8");
  assert.match(source, /response\.json\(\)\.catch/);
  assert.match(source, /xAI chat completion rejected request/);
  assert.match(source, /providerError\?\.message/);
  assert.match(source, /providerMessage\.slice\(0,\s*300\)/);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:apiKeys|Authorization)/);
});

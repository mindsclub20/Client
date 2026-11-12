import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile(
  new URL("../app/api/ai/chat/route.ts", import.meta.url),
  "utf8"
);

test("AI-generated wording cannot approve or complete a client quotation", () => {
  assert.doesNotMatch(route, /updates\.agreed_price\s*=/);
  assert.doesNotMatch(route, /updates\.status\s*=\s*["']completed["']/);
  assert.doesNotMatch(route, /const agreed\s*=/);
});

test("chat response does not represent an AI reply as customer approval", () => {
  assert.match(route, /agreedPrice:\s*conversation\.agreed_price/);
  assert.match(route, /status:\s*conversation\.status/);
});

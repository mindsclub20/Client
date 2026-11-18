import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../public/js/auth.js", import.meta.url), "utf8");

test("client login presents Authgear as the only visible authentication option", () => {
  assert.match(source, /\$\("af"\)\.hidden\s*=\s*true/);
  assert.match(source, /\$\("sw"\)\.hidden\s*=\s*true/);
  assert.match(source, /authgearButton\.href\s*=\s*"\/api\/auth\/authgear\/start"/);
  assert.match(source, /\$\("login"\)\.appendChild\(authgearButton\)/);
  assert.match(source, /Continue with Authgear/);
});

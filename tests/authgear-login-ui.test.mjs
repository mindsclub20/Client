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


test("Authgear requests the documented scope that includes email in the ID token", async () => {
  const startRoute = await readFile(new URL("../app/api/auth/authgear/start/route.ts", import.meta.url), "utf8");
  assert.match(startRoute, /scope.*https:\/\/authgear\.com\/scopes\/full-userinfo/);
});

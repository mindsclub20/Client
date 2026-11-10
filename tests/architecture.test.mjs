import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("Shyam is listed as a MAXWEB co-founder", () => {
  assert.match(page, /B\.V\. Shyam Sundar/);
  assert.match(page, /Co-founder/);
});
test("application uses the Next.js App Router", () => {
  assert.equal(packageJson.dependencies.next, "15.5.6");
  assert.match(page, /public.*index\.html/);
});
test("server auth uses Supabase SSR without a service-role key", async () => {
  const source = await readFile(new URL("../lib/supabase/server.ts", import.meta.url), "utf8");
  assert.match(source, /createServerClient/);
  assert.doesNotMatch(source, /SERVICE_ROLE|service_role/i);
});

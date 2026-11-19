import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeFirstCofounderCard } from "../lib/homepage-content.mjs";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("homepage normalizes founder content before extracting the rendered body", () => {
  assert.match(page, /normalizeFirstCofounderCard\(source\)/);
});

test("replaces only the first co-founder placeholder with the existing named founder", () => {
  const source = [
    "<section>",
    '<div><b>Unverified placeholder</b><span>Co-founder</span></div>',
    '<div><b>Second Co-founder</b><span>Co-founder</span></div>',
    "</section>",
  ].join("");

  const result = normalizeFirstCofounderCard(source);

  assert.doesNotMatch(result, /Unverified placeholder/);
  assert.match(result, /<b>B\.V\. Shyam Sundar<\/b><span>Co-founder<\/span>/);
  assert.match(result, /<b>Second Co-founder<\/b><span>Co-founder<\/span>/);
});

test("leaves source unchanged when no co-founder card exists", () => {
  const source = "<section><p>About MAXWEB</p></section>";
  assert.equal(normalizeFirstCofounderCard(source), source);
});

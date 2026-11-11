import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const homepage = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

const demos = [
  ["Restaurant Website", "/demos/restaurant"],
  ["Business Landing Page", "/demos/business"],
  ["Creative Portfolio", "/demos/portfolio"],
];

test("homepage showcases three working demo destinations", async () => {
  for (const [label, href] of demos) {
    assert.ok(homepage.includes(label), `homepage should show ${label}`);
    assert.ok(homepage.includes(href), `homepage should link to ${href}`);
    const route = await readFile(new URL(`../app${href}/page.tsx`, import.meta.url), "utf8");
    assert.ok(route.includes("DemoPage"), `${href} should render the shared demo page`);
  }
});

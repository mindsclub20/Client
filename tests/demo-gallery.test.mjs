import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const homepage = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("demo gallery preserves the grocery demo and corrects the next two identities", () => {
  assert.ok(homepage.includes("Grocery Shop Demo"));
  assert.ok(homepage.includes("/demos/grocery"));
  assert.ok(homepage.includes("MAXWEB Website &amp; Game") || homepage.includes("MAXWEB Website & Game"));
  assert.ok(homepage.includes("/demos/business"));
  assert.ok(homepage.includes("Second Live Demo"));
  assert.ok(homepage.includes("/demos/portfolio"));
  assert.ok(!homepage.includes("grocery-shop-demo-1.preview.emergentagent.com"));
  assert.ok(!homepage.includes("maxweb-website-and-game--charan4950ch.replit.app"));
  assert.ok(!homepage.includes("12103977-76b7-4e76-b153-b637d396fe70"));
});

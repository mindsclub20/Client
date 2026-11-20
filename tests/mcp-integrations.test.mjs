import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const providers = await readFile(new URL("../lib/mcp/providers.ts", import.meta.url), "utf8");
const status = await readFile(new URL("../lib/mcp/status.ts", import.meta.url), "utf8");
const statusRoute = await readFile(
  new URL("../app/api/admin/integrations/status/route.ts", import.meta.url),
  "utf8"
);
const inspectRoute = await readFile(
  new URL("../app/api/admin/integrations/inspect/route.ts", import.meta.url),
  "utf8"
);
const page = await readFile(
  new URL("../app/admin/integrations/page.tsx", import.meta.url),
  "utf8"
);
const adminPage = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");

test("MCP catalog exposes only GitHub and Supabase", () => {
  assert.ok(providers.includes('MCP_PROVIDERS = ["github", "supabase"]'));
  assert.ok(providers.includes("https://api.githubcopilot.com/mcp/"));
  assert.ok(providers.includes("https://mcp.supabase.com/mcp"));
  const start = providers.indexOf("MCP_PROVIDERS = [");
  const end = providers.indexOf("] as const", start);
  const providerList = providers.slice(start, end);
  const providerIds = providerList.match(/"[^"]+"/g)?.map((value) => value.slice(1, -1)) || [];
  assert.deepEqual(providerIds, ["github", "supabase"]);
});

test("status probes never return token values", () => {
  assert.ok(status.includes("server-only"));
  assert.ok(status.includes("GITHUB_TOKEN"));
  assert.ok(status.includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert.ok(status.includes('mode: "token"'));
  assert.ok(!status.includes("token: token"));
  assert.ok(!status.includes("access_token:"));
  assert.ok(!status.includes("refresh_token:"));
});

test("integration APIs are admin-gated and read-only by default", () => {
  assert.match(statusRoute, /getCurrentAdminContext/);
  assert.match(statusRoute, /forbidden/);
  assert.match(inspectRoute, /getCurrentAdminContext/);
  assert.match(inspectRoute, /action_not_allowed/);
  assert.match(inspectRoute, /approvalRequiredForWrites/);
});

test("admin integrations page is admin-only and linked from dashboard", () => {
  assert.match(page, /if \(!isAdmin\) redirect\("\/client"\)/);
  assert.match(page, /GitHub & Supabase MCP/);
  assert.match(adminPage, /\/admin\/integrations/);
});

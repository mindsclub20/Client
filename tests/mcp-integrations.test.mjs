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
  assert.match(providers, /MCP_PROVIDERS = \\["github", "supabase"\\]/);
  assert.match(providers, /api\\.githubcopilot\\.com\\/mcp/);
  assert.match(providers, /mcp\\.supabase\\.com\\/mcp/);
  const providerIds = [...providers.matchAll(/\\bid:\\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(providerIds, ["github", "supabase"]);
});

test("status probes never return token values", () => {
  assert.match(status, /server-only/);
  assert.match(status, /GITHUB_TOKEN/);
  assert.match(status, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(status, /mode:\\s*"token"/);
  assert.doesNotMatch(status, /^\\s*(?:token|access_token|refresh_token)\\s*:/m);
  assert.doesNotMatch(status, /(?:access_token|refresh_token)\\s*:/i);
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

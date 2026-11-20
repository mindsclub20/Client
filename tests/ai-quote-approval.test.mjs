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
  assert.doesNotMatch(route, /agreedPrice:\s*conversation\.agreed_price/);
  assert.match(route, /status:\s*conversation\.status/);
});


test("quote submission is customer-authenticated and delegated to the ownership-checking RPC", async () => {
  const route = await readFile(new URL("../app/api/ai/quote/accept/route.ts", import.meta.url), "utf8");
  assert.match(route, /supabase\.auth\.getUser/);
  assert.match(route, /rpc\("submit_ai_quote"/);
  assert.match(route, /status: 401/);
});

test("quote status uses the resolved session and scopes every read to its owner", async () => {
  const route = await readFile(new URL("../app/api/ai/quote/status/route.ts", import.meta.url), "utf8");
  assert.ok(route.includes("getAppUser()"));
  assert.ok(route.includes("createUserDataClient(user)"));
  const ownerFilter = '.eq("user_id", user.id)';
  assert.equal(route.split(ownerFilter).length - 1, 2);
});

test("admin approval is server-gated and uses the atomic admin RPC", async () => {
  const route = await readFile(new URL("../app/api/admin/quotes/approve/route.ts", import.meta.url), "utf8");
  assert.match(route, /getCurrentAdminContext/);
  assert.match(route, /!isAdmin/);
  assert.match(route, /rpc\("admin_approve_ai_quote"/);
});

test("quotation schema prevents customer-side approval and restricts approval to admins", async () => {
  const migration = await readFile(new URL("../supabase/migrations/202611130001_ai_quote_approval.sql", import.meta.url), "utf8");
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /auth\.uid\(\) = user_id/);
  assert.match(migration, /is distinct from 'admin'/);
  assert.match(migration, /protect_ai_conversation_approval_fields/);
  assert.match(migration, /status in \('pending_admin', 'approved', 'rejected'\)/);
});

test("payment details are revealed only after an admin-approved quote", async () => {
  const client = await readFile(new URL("../app/client/client-dashboard.tsx", import.meta.url), "utf8");
  assert.ok(client.includes('quoteStatus === "approved" && agreedPrice'));
  assert.ok(client.includes("FAMPAY_UPI"));
  assert.ok(client.includes("navigator.clipboard.writeText(FAMPAY_UPI)"));
  assert.ok(client.includes("/api/ai/quote/accept"));
  assert.ok(client.includes("Payment unlocks after admin approval."));
});

test("admin dashboard exposes pending quotes and an approval action", async () => {
  const admin = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  assert.match(admin, /ai_quotes/);
  assert.match(admin, /AdminQuoteApprovalButton/);
});

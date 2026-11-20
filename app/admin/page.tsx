import { redirect } from "next/navigation";
import {
  createVerifiedAdminDataClient,
  getCurrentAdminContext,
} from "@/lib/admin-auth";
import AdminLogoutButton from "./admin-logout-button";
import AdminQuoteApprovalButton from "./admin-quote-approval-button";
import DashboardShell, { dash } from "@/app/components/dashboard-shell";
import AdminAIStatusCard from "./ai-status-card";
import AdminAISummaryMonitor from "./ai-summary-monitor";
import AdminAIConversationsPanel from "./ai-conversations-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARD = dash.card;

const SERVICE_LINKS = [
  { name: "GitHub", url: "https://github.com/mindsclub20/Client", desc: "Source code" },
  {
    name: "Supabase",
    url: "https://supabase.com/dashboard/project/lpplrraoanuxlojduswi",
    desc: "Auth & database",
  },
  { name: "Vercel", url: "https://vercel.com", desc: "Hosting & deploys" },
  { name: "Hostinger", url: "https://hpanel.hostinger.com", desc: "Domain / hosting" },
  { name: "Authgear", url: "https://portal.authgear.com", desc: "Auth (if used)" },
  { name: "Resend", url: "https://resend.com", desc: "Transactional email" },
];

export default async function AdminPage() {
  const { user, isAdmin, provider } = await getCurrentAdminContext();

  if (!user) redirect("/#login");
  if (!isAdmin) redirect("/client");

  let list: { id: string; status: string; demo_requested_at: string | null }[] = [];
  let pendingQuotes:
    | {
        id: string;
        conversation_id: string;
        user_id: string;
        proposed_price: number;
        scope_summary: string | null;
        created_at: string;
      }[]
    | null = [];
  let approvedQuotes: { conversation_id: string; proposed_price: number }[] | null = [];
  let quoteError: { code?: string } | null = null;

  try {
    const supabase = await createVerifiedAdminDataClient();
    const { data: conversations } = await supabase
      .from("ai_conversations")
      .select("id, status, demo_requested_at")
      .order("updated_at", { ascending: false })
      .limit(40);
    list = conversations || [];

    const pending = await supabase
      .from("ai_quotes")
      .select("id, conversation_id, user_id, proposed_price, scope_summary, created_at")
      .eq("status", "pending_admin")
      .order("created_at", { ascending: true })
      .limit(50);
    pendingQuotes = pending.data;
    quoteError = pending.error;
    if (pending.error) console.error("pending quote lookup failed", { code: pending.error.code });

    const approved = await supabase
      .from("ai_quotes")
      .select("conversation_id, proposed_price")
      .eq("status", "approved")
      .limit(1000);
    approvedQuotes = approved.data;
    if (approved.error) console.error("approved quote lookup failed", { code: approved.error.code });
  } catch (error) {
    console.error(
      "admin page data client failed",
      error instanceof Error ? error.message : "unknown error"
    );
  }

  const approvedPriceByConversation = new Map(
    (approvedQuotes || []).map((quote) => [quote.conversation_id, quote.proposed_price])
  );
  const approvedPrices = (approvedQuotes || []).map((quote) => quote.proposed_price);
  const approvedQuoteCount = approvedPrices.length;
  const activeCount = list.filter((c) => c.status === "active").length;
  const demoCount = list.filter((c) => c.demo_requested_at).length;
  const avgAgreed =
    approvedPrices.length > 0
      ? Math.round(approvedPrices.reduce((a, b) => a + b, 0) / approvedPrices.length)
      : null;

  const topNav = (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "14px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: dash.teal,
            boxShadow: "0 0 12px rgba(47,181,174,0.7)",
          }}
        />
        <strong style={{ letterSpacing: 1.5, fontSize: 13 }}>MAXWEB</strong>
        <span style={{ color: dash.mutedColor, fontSize: 12 }}>Admin</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <a href="/admin/integrations" style={{ color: dash.text, textDecoration: "none", fontSize: 14 }}>
          Integrations
        </a>
        <a href="/" style={{ color: dash.text, textDecoration: "none", fontSize: 14 }}>
          Website
        </a>
        <a href="/client" style={{ color: dash.text, textDecoration: "none", fontSize: 14 }}>
          Client view
        </a>
        <AdminLogoutButton />
      </div>
    </div>
  );

  return (
    <DashboardShell topNav={topNav}>
      <main style={{ padding: "32px 24px 72px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <header style={{ marginBottom: 8 }}>
            <p style={dash.label}>Control panel</p>
            <h1 style={dash.h1}>Admin dashboard</h1>
            <p style={{ ...dash.muted, marginTop: 10 }}>
              Full client chats and AI summary status are available here. Demo requests are flagged.
            </p>
          </header>

          <section style={{ ...CARD, marginTop: 22 }}>
            <p style={{ color: dash.mutedColor, marginTop: 0, fontSize: 13 }}>Signed in</p>
            <h2 style={{ fontSize: 20, margin: "6px 0" }}>{user.email}</h2>
            <p style={{ color: dash.mutedColor, marginBottom: 0, fontSize: 13 }}>
              Role verified via{" "}
              {provider === "authgear"
                ? "Authgear allowlist + verified email"
                : "Supabase app_metadata"}
              .
            </p>
          </section>

          <section
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
            }}
          >
            {[
              { label: "Client chats", value: String(list.length) },
              { label: "Active", value: String(activeCount) },
              { label: "Demo requests", value: String(demoCount) },
              { label: "Approved quotes", value: String(approvedQuoteCount) },
              {
                label: "Avg agreed",
                value: avgAgreed ? `₹${avgAgreed.toLocaleString("en-IN")}` : "—",
              },
            ].map((stat) => (
              <div key={stat.label} style={{ ...dash.cardSoft, padding: 16 }}>
                <p style={{ ...dash.label, fontSize: 10 }}>{stat.label}</p>
                <p style={{ fontSize: 22, margin: "8px 0 0", fontWeight: 700 }}>{stat.value}</p>
              </div>
            ))}
          </section>

          <AdminAIStatusCard />

          <AdminAISummaryMonitor />

          <section style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 20, marginBottom: 14 }}>Quotation approval queue</h2>
            {quoteError ? (
              <div style={{ ...CARD, color: "#ffb6a9" }}>
                Quote queue is unavailable. Check database access and SUPABASE_SERVICE_ROLE_KEY.
              </div>
            ) : !pendingQuotes?.length ? (
              <div style={{ ...CARD, color: dash.mutedColor }}>
                No quotations are waiting for admin approval.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendingQuotes.map((quote) => (
                  <article key={quote.id} style={{ ...CARD, padding: 18 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <div>
                        <strong>Customer quotation request</strong>
                        <p style={{ color: dash.mutedColor, fontSize: 12, margin: "6px 0" }}>
                          Customer ID: {quote.user_id}
                        </p>
                        <p style={{ color: dash.mutedColor, fontSize: 13, margin: 0 }}>
                          {quote.scope_summary}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong style={{ color: dash.gold, display: "block", marginBottom: 10 }}>
                          ₹{Number(quote.proposed_price).toLocaleString("en-IN")}
                        </strong>
                        <AdminQuoteApprovalButton quoteId={quote.id} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <AdminAIConversationsPanel
            approvedPriceByConversation={approvedPriceByConversation}
          />

          <section style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 20, marginBottom: 14 }}>Infrastructure links</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              {SERVICE_LINKS.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...CARD,
                    padding: 18,
                    color: dash.text,
                    textDecoration: "none",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: 4 }}>{link.name}</strong>
                  <span style={{ color: dash.mutedColor, fontSize: 13 }}>{link.desc}</span>
                </a>
              ))}
            </div>
          </section>

          <section
            style={{
              marginTop: 28,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {[
              "Enquiries",
              "Customers",
              "Projects",
              "Quotations",
              "Invoices & payments",
              "After-sales support",
            ].map((item) => (
              <article key={item} style={{ ...dash.cardSoft, padding: 20 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>{item}</h3>
                <p style={{ color: dash.mutedColor, fontSize: 13, marginBottom: 0 }}>
                  Coming soon
                </p>
              </article>
            ))}
          </section>
        </div>
      </main>
    </DashboardShell>
  );
}

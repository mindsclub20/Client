import { redirect } from "next/navigation";
import { getCurrentAdminContext } from "@/lib/admin-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminLogoutButton from "./admin-logout-button";
import AdminQuoteApprovalButton from "./admin-quote-approval-button";
import DashboardShell from "@/app/components/dashboard-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARD = {
  border: "1px solid #ffffff1f",
  borderRadius: 16,
  padding: 24,
  background: "linear-gradient(160deg, #143a72, #0e2d5c)",
} as const;

const SERVICE_LINKS = [
  { name: "GitHub", url: "https://github.com/mindsclub20/Client", desc: "Source code" },
  { name: "Supabase", url: "https://supabase.com/dashboard/project/lpplrraoanuxlojduswi", desc: "Auth & database" },
  { name: "Vercel", url: "https://vercel.com", desc: "Hosting & deploys" },
  { name: "Hostinger", url: "https://hpanel.hostinger.com", desc: "Domain / hosting" },
  { name: "Authgear", url: "https://portal.authgear.com", desc: "Auth (if used)" },
  { name: "Resend", url: "https://resend.com", desc: "Transactional email" },
];

export default async function AdminPage() {
  const { user, isAdmin } = await getCurrentAdminContext();

  if (!user) redirect("/#login");
  if (!isAdmin) redirect("/client");

  const supabase = await createSupabaseServerClient();
  const { data: conversations } = await supabase
    .from("ai_conversations")
    .select(
      "id, user_id, title, status, website_type, starting_price, current_price, agreed_price, summary, created_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(30);

  const { data: pendingQuotes, error: quoteError } = await supabase
    .from("ai_quotes")
    .select("id, conversation_id, user_id, proposed_price, scope_summary, created_at")
    .eq("status", "pending_admin")
    .order("created_at", { ascending: true })
    .limit(50);
  if (quoteError) console.error("pending quote lookup failed", { code: quoteError.code });

  const list = conversations || [];
  const approvedQuoteCount = list.filter((c) => typeof c.agreed_price === "number" && c.agreed_price > 0).length;
  const activeCount = list.filter((c) => c.status === "active").length;
  const agreedPrices = list
    .map((c) => c.agreed_price)
    .filter((p): p is number => typeof p === "number" && p > 0);
  const avgAgreed =
    agreedPrices.length > 0
      ? Math.round(agreedPrices.reduce((a, b) => a + b, 0) / agreedPrices.length)
      : null;

  return (
    <DashboardShell>
      <main style={{ padding: "40px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              borderBottom: "1px solid #ffffff1f",
              paddingBottom: 24,
            }}
          >
            <div>
              <p style={{ color: "#9fb3cf", letterSpacing: 2, fontSize: 12, margin: 0 }}>
                MAXWEB CONTROL PANEL
              </p>
              <h1
                style={{
                  fontFamily: "Instrument Serif, Georgia, serif",
                  fontWeight: 400,
                  fontSize: 32,
                  margin: "10px 0 0",
                }}
              >
                Admin dashboard
              </h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <a href="/" style={{ color: "#eaf1fb" }}>
                View website
              </a>
              <a href="/client" style={{ color: "#eaf1fb" }}>
                Client view
              </a>
              <AdminLogoutButton />
            </div>
          </header>

          <section style={{ ...CARD, marginTop: 28 }}>
            <p style={{ color: "#9fb3cf", marginTop: 0 }}>Authenticated administrator</p>
            <h2 style={{ fontSize: 20, margin: "8px 0" }}>{user.email}</h2>
            <p style={{ color: "#9fb3cf", marginBottom: 0 }}>
              Role verified via Supabase app_metadata.
            </p>
          </section>

          <section
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            {[
              { label: "AI chats", value: String(list.length) },
              { label: "Active", value: String(activeCount) },
              { label: "Approved quotes", value: String(approvedQuoteCount) },
              {
                label: "Avg agreed price",
                value: avgAgreed ? `₹${avgAgreed.toLocaleString("en-IN")}` : "—",
              },
            ].map((stat) => (
              <div key={stat.label} style={{ ...CARD, borderRadius: 14, padding: 18 }}>
                <p style={{ color: "#9fb3cf", fontSize: 12, margin: 0, letterSpacing: 1 }}>
                  {stat.label.toUpperCase()}
                </p>
                <p style={{ fontSize: 22, margin: "8px 0 0", fontWeight: 700 }}>{stat.value}</p>
              </div>
            ))}
          </section>

          <section style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 20, marginBottom: 14 }}>Quotation approval queue</h2>
            {quoteError ? (
              <div style={{ ...CARD, color: "#ffb6a9" }}>Quote queue is unavailable. Apply the quote approval database migration before using this module.</div>
            ) : !pendingQuotes?.length ? (
              <div style={{ ...CARD, color: "#9fb3cf" }}>No quotations are waiting for admin approval.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendingQuotes.map((quote) => (
                  <article key={quote.id} style={{ ...CARD, borderRadius: 14, padding: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                      <div>
                        <strong>Customer quotation request</strong>
                        <p style={{ color: "#9fb3cf", fontSize: 12, margin: "6px 0" }}>Customer ID: {quote.user_id}</p>
                        <p style={{ color: "#9fb3cf", fontSize: 13, margin: 0 }}>{quote.scope_summary}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong style={{ color: "#d29a68", display: "block", marginBottom: 10 }}>
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

          <section style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 20, marginBottom: 14 }}>AI client interactions & bargains</h2>
            {list.length === 0 ? (
              <div
                style={{
                  ...CARD,
                  borderStyle: "dashed",
                  color: "#9fb3cf",
                  textAlign: "center",
                  padding: 28,
                }}
              >
                <p style={{ margin: "0 0 8px", fontSize: 16, color: "#eaf1fb" }}>
                  No AI conversations yet
                </p>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                  When clients use the AI consultant on <strong>/client</strong>, their
                  website-type analysis, price negotiation (₹15,000 → floor ₹7,000), and
                  agreed prices will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {list.map((c) => (
                  <article key={c.id} style={{ ...CARD, borderRadius: 14, padding: 18 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 15 }}>
                          {c.website_type
                            ? c.website_type.charAt(0).toUpperCase() +
                              c.website_type.slice(1)
                            : c.title || "Consultation"}
                        </strong>
                        <span
                          style={{
                            marginLeft: 10,
                            fontSize: 12,
                            color:
                              c.status === "completed"
                                ? "#2fb5ae"
                                : c.status === "active"
                                  ? "#9fb3cf"
                                  : "#9fb3cf",
                          }}
                        >
                          {c.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, color: "#d29a68" }}>
                        {c.agreed_price
                          ? `Agreed ₹${Number(c.agreed_price).toLocaleString("en-IN")}`
                          : `Current ₹${Number(c.current_price || 15000).toLocaleString("en-IN")}`}
                      </div>
                    </div>
                    {c.summary ? (
                      <p
                        style={{
                          color: "#9fb3cf",
                          fontSize: 13,
                          margin: "10px 0 0",
                          lineHeight: 1.4,
                        }}
                      >
                        {c.summary}
                      </p>
                    ) : (
                      <p
                        style={{
                          color: "#9fb3cf",
                          fontSize: 13,
                          margin: "10px 0 0",
                          fontStyle: "italic",
                        }}
                      >
                        No summary yet — conversation still active.
                      </p>
                    )}
                    <p style={{ color: "#9fb3cf", fontSize: 12, margin: "8px 0 0" }}>
                      Updated {new Date(c.updated_at).toLocaleString("en-IN")}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

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
                    borderRadius: 14,
                    padding: 18,
                    color: "#eaf1fb",
                    textDecoration: "none",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: 4 }}>{link.name}</strong>
                  <span style={{ color: "#9fb3cf", fontSize: 13 }}>{link.desc}</span>
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
            {["Enquiries", "Customers", "Projects", "Quotations", "Invoices & payments", "After-sales support"].map(
              (item) => (
                <article key={item} style={{ ...CARD, borderRadius: 14, padding: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{item}</h3>
                  <p style={{ color: "#9fb3cf", fontSize: 13, marginBottom: 0 }}>
                    Placeholder module — not connected yet
                  </p>
                </article>
              )
            )}
          </section>
        </div>
      </main>
    </DashboardShell>
  );
}

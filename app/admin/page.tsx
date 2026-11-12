import { redirect } from "next/navigation";
import { getCurrentAdminContext } from "@/lib/admin-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminLogoutButton from "./admin-logout-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080d1c",
        color: "#eef2ff",
        padding: "40px 24px",
        fontFamily: "Manrope, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            borderBottom: "1px solid #27314b",
            paddingBottom: 24,
          }}
        >
          <div>
            <p style={{ color: "#8ba4d8", letterSpacing: 2, fontSize: 12, margin: 0 }}>
              MAXWEB CONTROL PANEL
            </p>
            <h1 style={{ fontSize: 32, margin: "10px 0 0" }}>Admin dashboard</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <a href="/" style={{ color: "#a9c4ff" }}>
              View website
            </a>
            <a href="/client" style={{ color: "#a9c4ff" }}>
              Client view
            </a>
            <AdminLogoutButton />
          </div>
        </header>

        <section
          style={{
            marginTop: 28,
            border: "1px solid #27314b",
            borderRadius: 16,
            padding: 24,
            background: "#10182b",
          }}
        >
          <p style={{ color: "#8ba4d8", marginTop: 0 }}>Authenticated administrator</p>
          <h2 style={{ fontSize: 20, margin: "8px 0" }}>{user.email}</h2>
          <p style={{ color: "#a8b5d1", marginBottom: 0 }}>
            Role verified via Supabase app_metadata.
          </p>
        </section>

        {/* AI interaction summary */}
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 20, marginBottom: 14 }}>AI client interactions</h2>
          {!conversations || conversations.length === 0 ? (
            <div
              style={{
                border: "1px solid #27314b",
                borderRadius: 14,
                padding: 20,
                background: "#10182b",
                color: "#8e9bb7",
              }}
            >
              No AI conversations yet. Clients will appear here after they chat on /client.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {conversations.map((c) => (
                <article
                  key={c.id}
                  style={{
                    border: "1px solid #27314b",
                    borderRadius: 14,
                    padding: 18,
                    background: "#10182b",
                  }}
                >
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
                              ? "#7ddea8"
                              : c.status === "active"
                                ? "#8ba4d8"
                                : "#8e9bb7",
                        }}
                      >
                        {c.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: "#a9c4ff" }}>
                      {c.agreed_price
                        ? `Agreed ₹${Number(c.agreed_price).toLocaleString("en-IN")}`
                        : `Current ₹${Number(c.current_price || 15000).toLocaleString("en-IN")}`}
                    </div>
                  </div>
                  {c.summary ? (
                    <p
                      style={{
                        color: "#a8b5d1",
                        fontSize: 13,
                        margin: "10px 0 0",
                        lineHeight: 1.4,
                      }}
                    >
                      {c.summary}
                    </p>
                  ) : null}
                  <p style={{ color: "#6b7a9a", fontSize: 12, margin: "8px 0 0" }}>
                    Updated {new Date(c.updated_at).toLocaleString("en-IN")}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Service links */}
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
                  border: "1px solid #27314b",
                  borderRadius: 14,
                  padding: 18,
                  background: "#10182b",
                  color: "#eef2ff",
                  textDecoration: "none",
                }}
              >
                <strong style={{ display: "block", marginBottom: 4 }}>{link.name}</strong>
                <span style={{ color: "#8e9bb7", fontSize: 13 }}>{link.desc}</span>
              </a>
            ))}
          </div>
        </section>

        {/* Placeholder modules */}
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
              <article
                key={item}
                style={{
                  border: "1px solid #27314b",
                  borderRadius: 14,
                  padding: 20,
                  background: "#10182b",
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16 }}>{item}</h3>
                <p style={{ color: "#8e9bb7", fontSize: 13, marginBottom: 0 }}>
                  Admin workspace module — not connected yet
                </p>
              </article>
            )
          )}
        </section>
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { getCurrentAdminContext } from "@/lib/admin-auth";
import AdminLogoutButton from "./admin-logout-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user, isAdmin } = await getCurrentAdminContext();

  if (!user) redirect("/#login");
  if (!isAdmin) redirect("/#portal");

  return (
    <main style={{ minHeight: "100vh", background: "#080d1c", color: "#eef2ff", padding: "40px 24px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", borderBottom: "1px solid #27314b", paddingBottom: 24 }}>
          <div>
            <p style={{ color: "#8ba4d8", letterSpacing: 2, fontSize: 12, margin: 0 }}>MAXWEB CONTROL PANEL</p>
            <h1 style={{ fontSize: 32, margin: "10px 0 0" }}>Admin dashboard</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <a href="/" style={{ color: "#a9c4ff" }}>View website</a>
            <AdminLogoutButton />
          </div>
        </header>
        <section style={{ marginTop: 32, border: "1px solid #27314b", borderRadius: 16, padding: 24, background: "#10182b" }}>
          <p style={{ color: "#8ba4d8", marginTop: 0 }}>Authenticated administrator</p>
          <h2 style={{ fontSize: 20, margin: "8px 0" }}>{user.email}</h2>
          <p style={{ color: "#a8b5d1", marginBottom: 0 }}>Your admin role has been verified by the server using Supabase app_metadata.</p>
        </section>
        <section style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {["Enquiries", "Customers", "Projects", "Quotations", "Invoices & payments", "After-sales support"].map((item) => (
            <article key={item} style={{ border: "1px solid #27314b", borderRadius: 14, padding: 20, background: "#10182b" }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{item}</h3>
              <p style={{ color: "#8e9bb7", fontSize: 13, marginBottom: 0 }}>Admin workspace module — not connected yet</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

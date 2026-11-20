import { redirect } from "next/navigation";
import { getCurrentAdminContext } from "@/lib/admin-auth";
import DashboardShell from "@/app/components/dashboard-shell";
import { listProviders } from "@/lib/mcp/providers";
import { probeAllIntegrations } from "@/lib/mcp/status";
import IntegrationsClient from "./integrations-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminIntegrationsPage() {
  const { user, isAdmin } = await getCurrentAdminContext();
  if (!user) redirect("/#login");
  if (!isAdmin) redirect("/client");

  const catalog = listProviders();
  const status = await probeAllIntegrations();

  return (
    <DashboardShell>
      <main style={{ padding: "40px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <header style={{ marginBottom: 28, borderBottom: "1px solid #ffffff1f", paddingBottom: 20 }}>
            <p style={{ color: "#9fb3cf", letterSpacing: 2, fontSize: 12, margin: 0 }}>
              DEVELOPER INTEGRATIONS
            </p>
            <h1
              style={{
                fontFamily: "Instrument Serif, Georgia, serif",
                fontWeight: 400,
                fontSize: 32,
                margin: "10px 0 8px",
              }}
            >
              GitHub & Supabase MCP
            </h1>
            <p style={{ color: "#9fb3cf", margin: 0, maxWidth: 640, lineHeight: 1.5 }}>
              Central workspace for repository and database tooling. Only two providers are
              supported. Credentials stay on the server. Destructive actions require explicit
              approval.
            </p>
            <p style={{ marginTop: 12 }}>
              <a href="/admin" style={{ color: "#eaf1fb" }}>
                ← Back to admin dashboard
              </a>
            </p>
          </header>

          <IntegrationsClient
            catalog={catalog}
            initialStatus={status}
            adminEmail={user.email || ""}
          />
        </div>
      </main>
    </DashboardShell>
  );
}

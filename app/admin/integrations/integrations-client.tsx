"use client";

import { useState } from "react";
import type { McpProviderDefinition } from "@/lib/mcp/providers";
import type { IntegrationStatus } from "@/lib/mcp/status";

const PANEL: React.CSSProperties = {
  border: "1px solid #ffffff1f",
  borderRadius: 14,
  padding: 18,
  background: "linear-gradient(160deg, #143a72, #0e2d5c)",
};

type Props = {
  catalog: McpProviderDefinition[];
  initialStatus: {
    github: IntegrationStatus;
    supabase: IntegrationStatus;
  };
  adminEmail: string;
};

export default function IntegrationsClient({ catalog, initialStatus, adminEmail }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshStatus() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/integrations/status", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "status_failed");
      setStatus(data.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "status_failed");
    } finally {
      setBusy(false);
    }
  }

  async function runSchemaCompare() {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/admin/integrations/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "schema_compare" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "inspect_failed");
      setReport(data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "inspect_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p style={{ color: "#9fb3cf", fontSize: 13, marginTop: 0 }}>
        Signed in as {adminEmail}. Providers locked to GitHub and Supabase only.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          marginTop: 16,
        }}
      >
        {catalog.map((provider) => {
          const st = status[provider.id];
          return (
            <article key={provider.id} style={PANEL}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  alignItems: "baseline",
                }}
              >
                <h2 style={{ margin: 0, fontSize: 20 }}>{provider.label}</h2>
                <strong style={{ color: st?.connected ? "#55d6ad" : "#ffb6a9", fontSize: 13 }}>
                  {st?.connected ? "Connected" : "Not connected"}
                </strong>
              </div>

              <p style={{ color: "#9fb3cf", fontSize: 13, lineHeight: 1.45 }}>
                {st?.detail || "Status unknown."}
              </p>

              <p style={{ color: "#d4dfef", fontSize: 12, margin: "8px 0" }}>
                <strong>Account / project:</strong> {st?.accountOrProject || "—"}
                <br />
                <strong>Mode:</strong> {st?.mode || "—"}
                <br />
                <strong>Checked:</strong>{" "}
                {st?.checkedAt ? new Date(st.checkedAt).toLocaleString("en-IN") : "—"}
              </p>

              <p style={{ color: "#9fb3cf", fontSize: 12, marginBottom: 6 }}>
                <strong style={{ color: "#eaf1fb" }}>Official MCP URL</strong>
                <br />
                <code style={{ fontSize: 11, wordBreak: "break-all" }}>
                  {provider.officialMcpUrl}
                </code>
              </p>

              <p style={{ color: "#9fb3cf", fontSize: 12, marginBottom: 4 }}>
                <strong style={{ color: "#eaf1fb" }}>Auth</strong>
              </p>
              <ul style={{ margin: "0 0 10px", paddingLeft: 18, color: "#9fb3cf", fontSize: 12 }}>
                {provider.authModes.map((mode) => (
                  <li key={mode}>{mode}</li>
                ))}
              </ul>

              <p style={{ color: "#9fb3cf", fontSize: 12, marginBottom: 4 }}>
                <strong style={{ color: "#eaf1fb" }}>Permissions</strong>
              </p>
              <ul style={{ margin: "0 0 10px", paddingLeft: 18, color: "#9fb3cf", fontSize: 12 }}>
                {provider.permissions.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>

              <p style={{ color: "#9fb3cf", fontSize: 12, marginBottom: 4 }}>
                <strong style={{ color: "#eaf1fb" }}>Available tools</strong>
              </p>
              <ul style={{ margin: "0 0 10px", paddingLeft: 18, color: "#9fb3cf", fontSize: 12 }}>
                {provider.tools.map((tool) => (
                  <li key={tool.id}>
                    {tool.name}{" "}
                    <span style={{ opacity: 0.7 }}>({tool.risk})</span>
                  </li>
                ))}
              </ul>

              {st?.diagnostics?.length ? (
                <p style={{ color: "#ffb6a9", fontSize: 12, margin: 0 }}>
                  Diagnostics: {st.diagnostics.join(", ")}
                </p>
              ) : null}

              <p style={{ color: "#9fb3cf", fontSize: 11, margin: "12px 0 0" }}>
                Connect/disconnect is managed via server environment variables and official MCP
                host OAuth — tokens are never shown in the browser.
              </p>
            </article>
          );
        })}
      </div>

      <section style={{ ...PANEL, marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>Cross-platform inspect</h3>
        <p style={{ color: "#9fb3cf", fontSize: 13, lineHeight: 1.45 }}>
          Compare GitHub migration files with live Supabase tables. Read-only. Writes and schema
          changes are blocked until an approval workflow is enabled.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => refreshStatus()}
            style={{
              background: "#1b4f91",
              color: "#eaf1fb",
              border: "1px solid #ffffff33",
              borderRadius: 10,
              padding: "10px 14px",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            Refresh status
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => runSchemaCompare()}
            style={{
              background: "#d29a68",
              color: "#0a2147",
              border: "none",
              borderRadius: 10,
              padding: "10px 14px",
              fontWeight: 700,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            Run schema compare
          </button>
        </div>
        {error ? (
          <p style={{ color: "#ffb6a9", marginTop: 12, fontSize: 13 }}>{error}</p>
        ) : null}
        {report ? (
          <pre
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 10,
              background: "#0a2147",
              color: "#d4dfef",
              fontSize: 11,
              overflow: "auto",
              maxHeight: 360,
            }}
          >
            {JSON.stringify(report, null, 2)}
          </pre>
        ) : null}
      </section>

      <section style={{ ...PANEL, marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Execution history</h3>
        <p style={{ color: "#9fb3cf", fontSize: 13, marginBottom: 0 }}>
          v1 records inspect results in-session above. Persistent audit logging can be added with
          an admin-only table in a follow-up migration (approval required).
        </p>
      </section>
    </div>
  );
}

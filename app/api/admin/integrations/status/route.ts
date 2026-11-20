import { NextResponse } from "next/server";
import { getCurrentAdminContext } from "@/lib/admin-auth";
import { listProviders } from "@/lib/mcp/providers";
import { probeAllIntegrations } from "@/lib/mcp/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET() {
  const { user, isAdmin } = await getCurrentAdminContext();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const status = await probeAllIntegrations();
  const catalog = listProviders().map((provider) => ({
    id: provider.id,
    label: provider.label,
    officialMcpUrl: provider.officialMcpUrl,
    authModes: provider.authModes,
    permissions: provider.permissions,
    tools: provider.tools,
    envHints: provider.envHints,
  }));

  return NextResponse.json(
    {
      ok: true,
      providersOnly: ["github", "supabase"],
      catalog,
      status,
    },
    { headers: { "cache-control": "no-store" } }
  );
}

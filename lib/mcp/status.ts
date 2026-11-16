import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { McpProviderId } from "./providers";

export type IntegrationStatus = {
  provider: McpProviderId;
  connected: boolean;
  mode: string;
  accountOrProject: string | null;
  detail: string;
  diagnostics: string[];
  checkedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

export async function probeGitHubStatus(): Promise<IntegrationStatus> {
  const token =
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GH_TOKEN?.trim() ||
    process.env.MAXWEB_GITHUB_TOKEN?.trim() ||
    "";

  if (!token) {
    return {
      provider: "github",
      connected: false,
      mode: "not_configured",
      accountOrProject: null,
      detail:
        "No server-side GitHub token. Set GITHUB_TOKEN for API probes, or connect official MCP at api.githubcopilot.com/mcp/ from an MCP host.",
      diagnostics: ["Missing GITHUB_TOKEN / GH_TOKEN"],
      checkedAt: nowIso(),
    };
  }

  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "MAXWEB-MCP-Status",
      },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        provider: "github",
        connected: false,
        mode: "token",
        accountOrProject: null,
        detail: `GitHub API rejected the token (HTTP ${response.status}).`,
        diagnostics: [`http_${response.status}`],
        checkedAt: nowIso(),
      };
    }

    const user = (await response.json()) as { login?: string };
    return {
      provider: "github",
      connected: true,
      mode: "token",
      accountOrProject: user.login || "authenticated",
      detail: `Authenticated as ${user.login || "user"}. Repo default: mindsclub20/Client.`,
      diagnostics: [],
      checkedAt: nowIso(),
    };
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      provider: "github",
      connected: false,
      mode: "token",
      accountOrProject: null,
      detail: timedOut ? "GitHub probe timed out." : "GitHub network error.",
      diagnostics: [timedOut ? "timeout" : "network_error"],
      checkedAt: nowIso(),
    };
  }
}

export async function probeSupabaseStatus(): Promise<IntegrationStatus> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  const diagnostics: string[] = [];
  if (!url) diagnostics.push("Missing SUPABASE_URL");
  if (!anon) diagnostics.push("Missing anon/publishable key");
  if (!service) diagnostics.push("Missing SUPABASE_SERVICE_ROLE_KEY (admin/MCP server ops)");

  if (!url || !anon) {
    return {
      provider: "supabase",
      connected: false,
      mode: "not_configured",
      accountOrProject: null,
      detail: "Supabase URL or anon key is not configured on the server.",
      diagnostics,
      checkedAt: nowIso(),
    };
  }

  let projectRef: string | null = null;
  try {
    projectRef = new URL(url).hostname.split(".")[0] || null;
  } catch {
    projectRef = null;
  }

  try {
    const key = service || anon;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.from("ai_conversations").select("id", { head: true, count: "exact" }).limit(1);

    if (error && error.code === "PGRST301") {
      return {
        provider: "supabase",
        connected: false,
        mode: service ? "service_role" : "anon",
        accountOrProject: projectRef,
        detail: "JWT rejected by PostgREST.",
        diagnostics: [...diagnostics, error.code],
        checkedAt: nowIso(),
      };
    }

    // Missing table is still connectivity success for project reachability.
    return {
      provider: "supabase",
      connected: true,
      mode: service ? "service_role" : "anon",
      accountOrProject: projectRef || "configured",
      detail: service
        ? `Reachable project ${projectRef || "(url configured)"} with service role (server-only).`
        : `Reachable project ${projectRef || "(url configured)"} with anon key. Add service role for admin queue tools.`,
      diagnostics,
      checkedAt: nowIso(),
    };
  } catch (error) {
    return {
      provider: "supabase",
      connected: false,
      mode: service ? "service_role" : "anon",
      accountOrProject: projectRef,
      detail: error instanceof Error ? error.message.slice(0, 200) : "Supabase probe failed.",
      diagnostics: [...diagnostics, "probe_exception"],
      checkedAt: nowIso(),
    };
  }
}

export async function probeAllIntegrations() {
  const [github, supabase] = await Promise.all([
    probeGitHubStatus(),
    probeSupabaseStatus(),
  ]);
  return { github, supabase, providers: ["github", "supabase"] as const };
}

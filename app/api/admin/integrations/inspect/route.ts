import { NextResponse } from "next/server";
import { getCurrentAdminContext } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const REPO_OWNER = "mindsclub20";
const REPO_NAME = "Client";
const EXPECTED_TABLES = ["ai_conversations", "ai_messages", "ai_quotes", "ai_summary_jobs"];

async function githubHeaders() {
  const token =
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GH_TOKEN?.trim() ||
    process.env.MAXWEB_GITHUB_TOKEN?.trim() ||
    "";
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "MAXWEB-MCP-Inspect",
  } as const;
}

export async function POST(request: Request) {
  const { user, isAdmin } = await getCurrentAdminContext();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "schema_compare";

  // Only safe read actions in v1. Destructive ops require a future approval flow.
  if (action !== "schema_compare" && action !== "repo_snapshot") {
    return NextResponse.json(
      {
        error: "action_not_allowed",
        message: "Only read-only inspect actions are enabled without explicit approval workflow.",
      },
      { status: 400 }
    );
  }

  const report: Record<string, unknown> = {
    action,
    at: new Date().toISOString(),
    github: null as unknown,
    supabase: null as unknown,
    inconsistencies: [] as string[],
  };

  // --- Supabase side ---
  try {
    const admin = createSupabaseAdminClient();
    const tables: { name: string; present: boolean }[] = [];
    for (const name of EXPECTED_TABLES) {
      const { error } = await admin.from(name).select("*", { head: true, count: "exact" }).limit(1);
      tables.push({
        name,
        present: !error || error.code === "PGRST116",
      });
      if (error && error.code !== "PGRST116" && error.message?.includes("does not exist")) {
        tables[tables.length - 1].present = false;
      }
      if (error && (error.code === "42P01" || error.code === "PGRST205")) {
        tables[tables.length - 1].present = false;
      }
    }
    report.supabase = {
      projectHint:
        process.env.SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        null,
      tables,
    };
  } catch (error) {
    report.supabase = {
      error:
        error instanceof Error
          ? error.message.slice(0, 200)
          : "supabase_admin_unavailable",
    };
    (report.inconsistencies as string[]).push(
      "Supabase admin client unavailable — set SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  // --- GitHub side ---
  const headers = await githubHeaders();
  if (!headers) {
    report.github = {
      error: "github_token_missing",
      note: "Set GITHUB_TOKEN for live repo inspection, or use official MCP host OAuth.",
    };
    (report.inconsistencies as string[]).push(
      "GitHub token not configured on server; skipped live repository inspection."
    );
  } else {
    try {
      const repoRes = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`,
        { headers, signal: AbortSignal.timeout(10_000), cache: "no-store" }
      );
      const repo = repoRes.ok ? await repoRes.json() : null;

      const migRes = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/supabase/migrations?ref=feature/admin-ai-conversation-monitor`,
        { headers, signal: AbortSignal.timeout(10_000), cache: "no-store" }
      );
      const migrations = migRes.ok ? await migRes.json() : [];

      report.github = {
        repository: `${REPO_OWNER}/${REPO_NAME}`,
        defaultBranch: repo?.default_branch ?? null,
        private: repo?.private ?? null,
        migrationFiles: Array.isArray(migrations)
          ? migrations.map((f: { name?: string }) => f.name).filter(Boolean)
          : [],
      };
    } catch (error) {
      report.github = {
        error: error instanceof Error ? error.message.slice(0, 200) : "github_fetch_failed",
      };
    }
  }

  const supabaseTables = (report.supabase as { tables?: { name: string; present: boolean }[] })
    ?.tables;
  if (supabaseTables) {
    for (const t of supabaseTables) {
      if (!t.present) {
        (report.inconsistencies as string[]).push(
          `Expected table public.${t.name} is missing or not visible via service role.`
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    approvalRequiredForWrites: true,
    report,
  });
}

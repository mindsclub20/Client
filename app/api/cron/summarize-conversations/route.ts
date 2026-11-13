import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  completeAI,
  ProviderError,
  type ChatMessage,
} from "@/lib/ai/provider";
import { SUMMARY_SYSTEM_PROMPT } from "@/lib/ai/grok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_LIMIT = 8;
const HISTORY_LIMIT = 16;

function authorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") || "";
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";

  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  // Vercel Cron injects this header on scheduled invocations.
  if (isVercelCron) return true;
  return false;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.MAXWEB_AI_API_KEY2?.trim()) {
    return NextResponse.json({ error: "ai_not_configured", summarized: 0 }, { status: 503 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (err) {
    console.error("summarize cron: admin client unavailable", {
      message: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    });
    return NextResponse.json(
      {
        error: "admin_client_unavailable",
        message:
          "Set SUPABASE_SERVICE_ROLE_KEY on the server for scheduled summaries.",
        summarized: 0,
      },
      { status: 503 }
    );
  }

  // Conversations that need a first summary, or were updated after the last summary.
  const { data: candidates, error: listError } = await admin
    .from("ai_conversations")
    .select("id, website_type, current_price, summary, summary_generated_at, updated_at, status")
    .order("updated_at", { ascending: false })
    .limit(40);

  if (listError) {
    console.error("summarize cron list failed", { code: listError.code });
    return NextResponse.json({ error: "list_failed", summarized: 0 }, { status: 500 });
  }

  const needsSummary = (candidates || []).filter((c) => {
    if (!c.summary || !c.summary_generated_at) return true;
    return new Date(c.updated_at).getTime() > new Date(c.summary_generated_at).getTime();
  }).slice(0, BATCH_LIMIT);

  const results: { id: string; ok: boolean; reason?: string }[] = [];

  for (const conv of needsSummary) {
    try {
      const { data: history, error: histError } = await admin
        .from("ai_messages")
        .select("role, content")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true })
        .limit(HISTORY_LIMIT);

      if (histError || !history || history.length === 0) {
        results.push({ id: conv.id, ok: false, reason: "no_messages" });
        continue;
      }

      const transcript = history
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n")
        .slice(0, 6_000);

      const messages: ChatMessage[] = [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Website type field: ${conv.website_type || "unknown"}\nCurrent price field: ₹${conv.current_price ?? 15000}\nStatus: ${conv.status}\n\nTranscript:\n${transcript}`,
        },
      ];

      const result = await completeAI(messages, {
        temperature: 0.3,
        maxOutputTokens: 160,
      });

      const summary = result.content.trim().slice(0, 800);
      const now = new Date().toISOString();

      const { error: updateError } = await admin
        .from("ai_conversations")
        .update({
          summary,
          summary_generated_at: now,
          // Do not bump updated_at via client default if trigger exists;
          // explicit touch is fine for admin visibility.
          updated_at: conv.updated_at,
        })
        .eq("id", conv.id);

      if (updateError) {
        results.push({ id: conv.id, ok: false, reason: updateError.code || "update_failed" });
        continue;
      }

      results.push({ id: conv.id, ok: true });
    } catch (err) {
      const reason =
        err instanceof ProviderError
          ? err.code
          : err instanceof Error
            ? err.message.slice(0, 80)
            : "unknown";
      console.error("summarize cron item failed", { id: conv.id, reason });
      results.push({ id: conv.id, ok: false, reason });
    }
  }

  const summarized = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: true,
    scanned: (candidates || []).length,
    attempted: needsSummary.length,
    summarized,
    results,
  });
}

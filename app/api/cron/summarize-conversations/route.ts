import { timingSafeEqual } from "node:crypto";
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

const BATCH_LIMIT = 3;
const HISTORY_LIMIT = 16;

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") || "";

  if (!expected || !authorization.startsWith("Bearer ")) return false;

  const supplied = authorization.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);

  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.MAXWEB_AI_API_KEY2?.trim()) {
    return NextResponse.json(
      { error: "ai_not_configured", summarized: 0 },
      { status: 503 }
    );
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (err) {
    console.error("summarize cron: admin client unavailable", {
      message: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    });
    return NextResponse.json(
      { error: "admin_client_unavailable", summarized: 0 },
      { status: 503 }
    );
  }

  const { data: jobs, error: claimError } = await admin.rpc(
    "claim_ai_summary_jobs",
    { p_limit: BATCH_LIMIT, p_lease_seconds: 180 }
  );

  if (claimError) {
    console.error("summarize cron claim failed", { code: claimError.code });
    return NextResponse.json(
      { error: "claim_failed", summarized: 0 },
      { status: 500 }
    );
  }

  const results: { id: string; ok: boolean; reason?: string }[] = [];

  for (const job of jobs || []) {
    const finish = async (summary: string | null, error: string | null) => {
      const { data, error: finishError } = await admin.rpc(
        "finish_ai_summary_job",
        {
          p_conversation_id: job.conversation_id,
          p_source_updated_at: job.source_updated_at,
          p_claim_token: job.claim_token,
          p_summary: summary,
          p_error: error,
        }
      );

      if (finishError) {
        console.error("summarize cron finish failed", {
          id: job.conversation_id,
          code: finishError.code,
        });
        return { status: "finish_failed", failed: true };
      }

      return { status: data as string, failed: data !== "completed" };
    };

    try {
      // Fetch newest messages first to bound the query, then restore transcript order.
      const { data: history, error: historyError } = await admin
        .from("ai_messages")
        .select("role, content")
        .eq("conversation_id", job.conversation_id)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);

      if (historyError || !history || history.length === 0) {
        const reason = historyError?.code
          ? `history_fetch_failed:${historyError.code}`
          : "no_messages";
        const completion = await finish(null, reason);
        results.push({
          id: job.conversation_id,
          ok: false,
          reason: completion.status,
        });
        continue;
      }

      const transcript = [...history]
        .reverse()
        .map((message) => `${String(message.role).toUpperCase()}: ${message.content}`)
        .join("\n")
        .slice(0, 6_000);

      const messages: ChatMessage[] = [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `Website type field: ${job.website_type || "unknown"}\n` +
            `Current price field: ₹${job.current_price ?? 15000}\n` +
            `Status: ${job.status || "unknown"}\n\nTranscript:\n${transcript}`,
        },
      ];

      const generated = await completeAI(messages, {
        temperature: 0.3,
        maxOutputTokens: 160,
      });

      const summary = generated.content.trim().slice(0, 800);
      if (!summary) {
        const completion = await finish(null, "empty_summary");
        results.push({
          id: job.conversation_id,
          ok: false,
          reason: completion.status,
        });
        continue;
      }

      const completion = await finish(summary, null);
      results.push({
        id: job.conversation_id,
        ok: completion.status === "completed",
        reason: completion.failed ? completion.status : undefined,
      });
    } catch (err) {
      const reason =
        err instanceof ProviderError
          ? err.code
          : err instanceof Error
            ? err.message.slice(0, 120)
            : "unknown";
      console.error("summarize cron item failed", {
        id: job.conversation_id,
        reason,
      });

      const completion = await finish(null, reason);
      results.push({
        id: job.conversation_id,
        ok: false,
        reason: completion.status,
      });
    }
  }

  const summarized = results.filter((result) => result.ok).length;
  return NextResponse.json({
    ok: true,
    attempted: (jobs || []).length,
    summarized,
    failed: results.length - summarized,
    results,
  });
}

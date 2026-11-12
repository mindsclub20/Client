import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * Authenticated readiness check. This calls Gemini's model metadata endpoint,
 * not generateContent, so it verifies the configured key/model without using
 * tokens for a chat completion. The key is never returned to the client.
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }

    const apiKey = process.env.MAXWEB_AI_API_KEY2?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, provider: "gemini", error: "ai_not_configured" },
        { status: 503 }
      );
    }

    const model = (process.env.MAXWEB_GEMINI_MODEL?.trim() || "gemini-3.8-flash")
      .replace(/^models\//, "");
    const controller = AbortSignal.timeout(8_000);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,
      {
        method: "GET",
        headers: { "x-goog-api-key": apiKey },
        signal: controller,
        cache: "no-store",
      }
    );

    if (response.ok) {
      return NextResponse.json({
        ok: true,
        provider: "gemini",
        model,
        check: "authenticated_model_access",
      });
    }

    if (response.status === 401 || response.status === 403) {
      return NextResponse.json(
        { ok: false, provider: "gemini", error: "gemini_auth_failed", model },
        { status: 502 }
      );
    }
    if (response.status === 404) {
      return NextResponse.json(
        { ok: false, provider: "gemini", error: "gemini_model_not_found", model },
        { status: 502 }
      );
    }
    if (response.status === 429) {
      return NextResponse.json(
        { ok: false, provider: "gemini", error: "provider_rate_limit", model },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { ok: false, provider: "gemini", error: "provider_unavailable", model },
      { status: 503 }
    );
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json(
      {
        ok: false,
        provider: "gemini",
        error: timedOut ? "provider_timeout" : "provider_unavailable",
      },
      { status: 503 }
    );
  }
}

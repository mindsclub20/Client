import { NextResponse } from "next/server";
import { getCurrentAdminContext } from "@/lib/admin-auth";
import { listConfiguredProviders } from "@/lib/ai/provider";
import { normalizeGeminiModel } from "@/lib/ai/grok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * Administrator-only readiness check.
 * Calls Gemini model metadata (not generateContent) so it verifies the key
 * without spending chat tokens. The key is never returned.
 */
export async function GET() {
  try {
    const { user, isAdmin } = await getCurrentAdminContext();

    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const apiKey = process.env.MAXWEB_AI_API_KEY2?.trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          provider: "gemini",
          configured: listConfiguredProviders(),
          error: "ai_not_configured",
        },
        { status: 503 }
      );
    }

    const model = normalizeGeminiModel(process.env.MAXWEB_GEMINI_MODEL);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,
      {
        method: "GET",
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      }
    );

    if (response.ok) {
      return NextResponse.json({
        ok: true,
        provider: "gemini",
        configured: listConfiguredProviders(),
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

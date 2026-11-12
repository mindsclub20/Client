import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  grokChat,
  BARGAIN_SYSTEM_PROMPT,
  ProviderError,
  type ChatMessage,
} from "@/lib/ai/grok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function statusForCode(code: string): number {
  switch (code) {
    case "ai_not_configured":
      return 503;
    case "glm_auth_failed":
    case "gemini_auth_failed":
      return 502;
    case "provider_rate_limit":
      return 429;
    case "provider_timeout":
    case "provider_unavailable":
    case "providers_unavailable":
      return 503;
    default:
      return 500;
  }
}

export async function POST(request: Request) {
  let conversationId: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    if (!process.env.MAXWEB_AI_API_KEY && !process.env.MAXWEB_AI_API_KEY2) {
      return NextResponse.json(
        {
          error: "ai_not_configured",
          message:
            "MAXWEB AI is not configured. Set MAXWEB_AI_API_KEY (GLM) and/or MAXWEB_AI_API_KEY2 (Gemini) in server environment variables.",
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.trim() : "";
    conversationId =
      typeof body.conversationId === "string" ? body.conversationId : null;

    if (!message) {
      return NextResponse.json({ error: "message_required" }, { status: 400 });
    }

    if (!conversationId) {
      const { data: created, error: createError } = await supabase
        .from("ai_conversations")
        .insert({
          user_id: user.id,
          title: "Website consultation",
          status: "active",
          starting_price: 15000,
          current_price: 15000,
          minimum_price: 7000,
        })
        .select("id, current_price, minimum_price, website_type, agreed_price, status")
        .single();

      if (createError || !created) {
        console.error("create conversation failed", createError);
        return NextResponse.json({ error: "create_failed" }, { status: 500 });
      }
      conversationId = created.id;
    }

    const { data: conversation, error: convError } = await supabase
      .from("ai_conversations")
      .select(
        "id, user_id, current_price, minimum_price, website_type, agreed_price, status"
      )
      .eq("id", conversationId)
      .single();

    if (convError || !conversation || conversation.user_id !== user.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Persist the user turn before calling providers so a later failure still
    // keeps the conversation history. Never write a fake assistant reply on failure.
    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: message,
    });

    const { data: history } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    const messages: ChatMessage[] = [
      { role: "system", content: BARGAIN_SYSTEM_PROMPT },
      ...(history || []).map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ];

    const result = await grokChat(messages);

    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: result.content,
      metadata: {
        model: result.model,
        usage: result.usage,
        provider: result.provider,
      },
    });

    const priceMatch =
      result.content.match(/(?:₹|Rs\.?|INR)\s*([0-9]{4,6})/i) ||
      result.content.match(/\b([7-9][0-9]{3}|1[0-4][0-9]{3}|15000)\b/);
    let currentPrice = conversation.current_price;
    if (priceMatch) {
      const parsed = parseInt(priceMatch[1], 10);
      if (parsed >= 7000 && parsed <= 15000) {
        currentPrice = parsed;
      }
    }

    // AI output is advisory only. It must never approve a quote or complete a project.
    const updates: Record<string, unknown> = {
      current_price: currentPrice,
      updated_at: new Date().toISOString(),
    };

    const typeHints = [
      "restaurant",
      "portfolio",
      "business",
      "ecommerce",
      "e-commerce",
      "landing",
      "blog",
      "shop",
    ];
    const msgLower = message.toLowerCase();
    for (const t of typeHints) {
      if (msgLower.includes(t)) {
        updates.website_type = t;
        break;
      }
    }

    await supabase
      .from("ai_conversations")
      .update(updates)
      .eq("id", conversationId);

    return NextResponse.json({
      conversationId,
      reply: result.content,
      currentPrice,
      agreedPrice: conversation.agreed_price,
      status: conversation.status,
      provider: result.provider,
    });
  } catch (err) {
    const safeMessage =
      err instanceof ProviderError
        ? err.message
        : err instanceof Error
          ? err.message
          : "unknown";

    // Never log secrets; message from ProviderError is already sanitized.
    console.error("AI chat error", {
      code: err instanceof ProviderError ? err.code : "server_error",
      provider: err instanceof ProviderError ? err.provider : undefined,
      httpStatus: err instanceof ProviderError ? err.httpStatus : undefined,
      message: safeMessage.slice(0, 500),
      conversationId,
    });

    if (err instanceof ProviderError) {
      return NextResponse.json(
        {
          error: err.code,
          message: err.message,
          conversationId,
        },
        { status: statusForCode(err.code) }
      );
    }

    return NextResponse.json(
      {
        error: "server_error",
        message: safeMessage.slice(0, 300),
        conversationId,
      },
      { status: 500 }
    );
  }
}

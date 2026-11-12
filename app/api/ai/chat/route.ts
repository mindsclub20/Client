import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { grokChat, BARGAIN_SYSTEM_PROMPT, type ChatMessage } from "@/lib/ai/grok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.trim() : "";
    let conversationId =
      typeof body.conversationId === "string" ? body.conversationId : null;

    if (!message) {
      return NextResponse.json({ error: "message_required" }, { status: 400 });
    }

    // Create or load conversation
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
        .select("id, current_price, minimum_price, website_type, agreed_price")
        .single();

      if (createError || !created) {
        console.error("create conversation failed", createError);
        return NextResponse.json({ error: "create_failed" }, { status: 500 });
      }
      conversationId = created.id;
    }

    // Verify ownership
    const { data: conversation, error: convError } = await supabase
      .from("ai_conversations")
      .select("id, user_id, current_price, minimum_price, website_type, agreed_price, status")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation || conversation.user_id !== user.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Store user message
    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: message,
    });

    // Load recent history (last 20 messages)
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

    // Call Grok
    const result = await grokChat(messages);

    // Store assistant reply
    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: result.content,
      metadata: { model: result.model, usage: result.usage },
    });

    // Lightweight extraction of price / website type from the reply
    const priceMatch = result.content.match(/(?:₹|Rs\.?|INR)\s*([0-9]{4,6})/i) ||
      result.content.match(/\b([7-9][0-9]{3}|1[0-4][0-9]{3}|15000)\b/);
    let currentPrice = conversation.current_price;
    if (priceMatch) {
      const parsed = parseInt(priceMatch[1], 10);
      if (parsed >= 7000 && parsed <= 15000) {
        currentPrice = parsed;
      }
    }

    // Detect agreement
    const lower = result.content.toLowerCase();
    const agreed =
      lower.includes("agreed") ||
      lower.includes("confirmed at") ||
      lower.includes("final price") ||
      lower.includes("we can lock");

    const updates: Record<string, unknown> = {
      current_price: currentPrice,
      updated_at: new Date().toISOString(),
    };
    if (agreed && currentPrice) {
      updates.agreed_price = currentPrice;
      updates.status = "completed";
      updates.summary = `Agreed at ₹${currentPrice}. ${result.content.slice(0, 200)}`;
    }

    // Simple website type detection from user message
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
      agreedPrice: agreed ? currentPrice : conversation.agreed_price,
      status: agreed ? "completed" : conversation.status,
    });
  } catch (err) {
    console.error("AI chat error", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "server_error", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const { data: quote, error } = await supabase
      .from("ai_quotes")
      .select("id, conversation_id, proposed_price, scope_summary, status, created_at, admin_approved_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("quote status lookup failed", { code: error.code });
      return NextResponse.json({ error: "quote_status_unavailable" }, { status: 503 });
    }

    let conversation = null;
    if (!quote) {
      const { data: latestConversation, error: conversationError } = await supabase
        .from("ai_conversations")
        .select("id, current_price, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (conversationError) {
        console.error("active conversation lookup failed", { code: conversationError.code });
        return NextResponse.json({ error: "conversation_status_unavailable" }, { status: 503 });
      }
      conversation = latestConversation;
    }

    return NextResponse.json({ quote: quote || null, conversation }, {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

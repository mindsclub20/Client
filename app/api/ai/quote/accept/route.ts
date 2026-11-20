import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
    if (!conversationId) {
      return NextResponse.json({ error: "conversation_id_required" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("submit_ai_quote", {
      p_conversation_id: conversationId,
    });
    if (error) {
      const message = error.message || "";
      if (message.includes("quote_already_submitted")) {
        return NextResponse.json({ error: "quote_already_submitted" }, { status: 409 });
      }
      if (message.includes("conversation_not_found_or_closed")) {
        return NextResponse.json({ error: "conversation_not_found_or_closed" }, { status: 404 });
      }
      if (message.includes("quote_price_out_of_range")) {
        return NextResponse.json({ error: "quote_price_out_of_range" }, { status: 400 });
      }
      console.error("quote submission failed", { code: error.code });
      return NextResponse.json({ error: "quote_submission_failed" }, { status: 500 });
    }

    return NextResponse.json({
      quote: data,
      message: "Your quote request has been sent for admin approval.",
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

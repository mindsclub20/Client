import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const isAdmin = user.app_metadata?.role === "admin";

    let query = supabase
      .from("ai_conversations")
      .select(
        "id, user_id, title, status, website_type, starting_price, current_price, minimum_price, agreed_price, summary, created_at, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(50);

    if (!isAdmin) {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("list conversations failed", error);
      return NextResponse.json({ error: "query_failed" }, { status: 500 });
    }

    // For admin, enrich with email if possible (best-effort via auth admin not available with anon)
    return NextResponse.json({
      conversations: data || [],
      role: isAdmin ? "admin" : "client",
    });
  } catch (err) {
    console.error("conversations list error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

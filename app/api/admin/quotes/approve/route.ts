import { NextResponse } from "next/server";
import { getCurrentAdminContext } from "@/lib/admin-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { user, isAdmin } = await getCurrentAdminContext();
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const quoteId = typeof body.quoteId === "string" ? body.quoteId : "";
    if (!quoteId) {
      return NextResponse.json({ error: "quote_id_required" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_approve_ai_quote", {
      p_quote_id: quoteId,
    });
    if (error) {
      const message = error.message || "";
      if (message.includes("pending_quote_not_found")) {
        return NextResponse.json({ error: "pending_quote_not_found" }, { status: 404 });
      }
      if (message.includes("forbidden")) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      console.error("admin quote approval failed", { code: error.code });
      return NextResponse.json({ error: "quote_approval_failed" }, { status: 500 });
    }

    return NextResponse.json({ quote: data, message: "Quotation approved." });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUTHGEAR_ISSUER, getAuthgearSession } from "@/lib/authgear";
import { authgearSubjectToUserId } from "@/lib/ai/authgear-user-id.mjs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authgearUser = await getAuthgearSession();
    let supabase: SupabaseClient;
    let userId: string | null = null;
    let isAdmin = false;

    if (authgearUser) {
      // Authgear identities are not Supabase Auth users. Use the server-only
      // service client and explicitly scope every client listing to its UUIDv5.
      supabase = createSupabaseAdminClient();
      if (authgearUser.role === "admin") {
        isAdmin = true;
      } else {
        userId = authgearSubjectToUserId(AUTHGEAR_ISSUER, authgearUser.sub);
      }
    } else {
      // Preserve the existing Supabase Auth path and its RLS-scoped client.
      supabase = await createSupabaseServerClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      }

      isAdmin = user.app_metadata?.role === "admin";
      userId = user.id;
    }

    let query = supabase
      .from("ai_conversations")
      .select(
        "id, user_id, title, status, website_type, starting_price, current_price, minimum_price, agreed_price, summary, created_at, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(50);

    if (!isAdmin) {
      if (!userId) {
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      }
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("list conversations failed", { code: error.code });
      return NextResponse.json({ error: "query_failed" }, { status: 500 });
    }

    return NextResponse.json({
      conversations: data || [],
      role: isAdmin ? "admin" : "client",
    });
  } catch (err) {
    console.error(
      "conversations list error",
      err instanceof Error ? err.message : "unknown error"
    );
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

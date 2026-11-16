import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Client marks their consultation for a live demo review.
 * Full chat remains visible to admins; no AI summary is generated.
 */
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

    if (user.app_metadata?.role === "admin") {
      return NextResponse.json({ error: "admins_use_admin_panel" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId.trim() : "";
    const note =
      typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

    let targetId = conversationId;

    if (targetId) {
      const { data: owned, error: ownError } = await supabase
        .from("ai_conversations")
        .select("id, demo_requested_at")
        .eq("id", targetId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (ownError || !owned) {
        return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
      }

      if (owned.demo_requested_at) {
        return NextResponse.json({
          ok: true,
          alreadyRequested: true,
          conversationId: owned.id,
          message: "Demo already requested. Our team can see your full chat.",
        });
      }
    } else {
      const { data: latest } = await supabase
        .from("ai_conversations")
        .select("id, demo_requested_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest?.demo_requested_at) {
        return NextResponse.json({
          ok: true,
          alreadyRequested: true,
          conversationId: latest.id,
          message: "Demo already requested. Our team can see your full chat.",
        });
      }

      if (latest?.id) {
        targetId = latest.id;
      } else {
        const { data: created, error: createError } = await supabase
          .from("ai_conversations")
          .insert({
            user_id: user.id,
            title: "Demo request",
            status: "active",
            starting_price: 15000,
            current_price: 15000,
            minimum_price: 7000,
            demo_requested_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (createError || !created) {
          console.error("demo request create conversation failed", {
            code: createError?.code,
          });
          return NextResponse.json({ error: "create_failed" }, { status: 500 });
        }
        targetId = created.id;
      }
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("ai_conversations")
      .update({
        demo_requested_at: now,
        updated_at: now,
        title: "Demo request",
      })
      .eq("id", targetId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("demo request update failed", { code: updateError.code });
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    const marker =
      note.length > 0
        ? `[DEMO REQUEST] ${note}`
        : "[DEMO REQUEST] Client asked for a live demo of MAXWEB sample sites.";

    const { error: messageError } = await supabase.from("ai_messages").insert({
      conversation_id: targetId,
      role: "user",
      content: marker,
    });

    if (messageError) {
      console.error("demo request message insert failed", { code: messageError.code });
      // Flag still set; message is best-effort for transcript.
    }

    return NextResponse.json({
      ok: true,
      conversationId: targetId,
      message:
        "Demo requested. The full chat is visible to the MAXWEB team — no AI summary needed.",
    });
  } catch (error) {
    console.error("demo request failed", {
      message: error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

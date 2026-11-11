import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ code: "INVALID_ORIGIN", message: "This request was blocked for security reasons." }, { status: 403 });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) return NextResponse.json({ code: "SIGNOUT_FAILED", message: "Could not sign out. Try again." }, { status: 500 });
    return NextResponse.json({ ok: true }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("logout route failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ code: "SERVER_ERROR", message: "The server had a problem. Please try again." }, { status: 500 });
  }
}

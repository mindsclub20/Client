import { NextResponse } from "next/server";
import { getAuthgearSession } from "@/lib/authgear";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authgearUser = await getAuthgearSession();
    if (authgearUser) {
      return NextResponse.json(
        {
          user: {
            id: authgearUser.sub,
            name: authgearUser.name,
            email: authgearUser.email,
            role: authgearUser.role,
          },
          provider: "authgear",
          expiresAt: null,
        },
        { headers: { "cache-control": "no-store" } }
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json(
        { error: "unauthenticated" },
        { status: 401, headers: { "cache-control": "no-store" } }
      );
    }
    const name =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null;
    const role = user.app_metadata?.role === "admin" ? "admin" : "client";
    return NextResponse.json(
      {
        user: { id: user.id, name, email: user.email, role },
        provider: "supabase",
        expiresAt: null,
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error(
      "session check failed",
      error instanceof Error ? error.message : "unknown error"
    );
    return NextResponse.json(
      { error: "server_error" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") || "/#login";
  const safeNext = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/#login";

  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return NextResponse.redirect(new URL("/?confirmation=failed#login", url.origin));
    } catch {
      return NextResponse.redirect(new URL("/?confirmation=failed#login", url.origin));
    }
  }

  return NextResponse.redirect(new URL(safeNext, url.origin));
}

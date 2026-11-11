import { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const allowedTypes: EmailOtpType[] = ["email"];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const requestedNext = url.searchParams.get("next") || "/#portal";
  const safeNext = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/#portal";

  if (!tokenHash || !type || !allowedTypes.includes(type)) {
    return NextResponse.redirect(new URL("/?confirmation=failed#login", url.origin));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type
    });

    if (error) {
      return NextResponse.redirect(new URL("/?confirmation=failed#login", url.origin));
    }

    return NextResponse.redirect(new URL(safeNext, url.origin));
  } catch {
    return NextResponse.redirect(new URL("/?confirmation=failed#login", url.origin));
  }
}

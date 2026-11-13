import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeAuthNextPath } from "@/lib/auth-redirect";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const next = safeAuthNextPath(new URL(request.url).searchParams.get("next"));
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", next);

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error || !data.url) {
      return NextResponse.redirect(new URL("/?oauth_error=google#login", origin));
    }

    return NextResponse.redirect(data.url);
  } catch {
    return NextResponse.redirect(new URL("/?oauth_error=google#login", origin));
  }
}

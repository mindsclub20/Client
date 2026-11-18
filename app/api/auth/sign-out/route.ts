import { NextRequest, NextResponse } from "next/server";
import { getAuthgearSession, AUTHGEAR_ISSUER, AUTHGEAR_SESSION_COOKIE } from "@/lib/authgear";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ code: "INVALID_ORIGIN", message: "This request was blocked for security reasons." }, { status: 403 });
  }
  try {
    const authgearUser = await getAuthgearSession();
    if (authgearUser) {
      const logoutUrl = new URL(AUTHGEAR_ISSUER + "/oauth2/end_session");
      logoutUrl.searchParams.set("client_id", process.env.AUTHGEAR_CLIENT_ID || "");
      logoutUrl.searchParams.set("post_logout_redirect_uri", process.env.AUTHGEAR_POST_LOGOUT_REDIRECT_URI || new URL("/", request.url).toString());
      const response = NextResponse.json({ ok: true, redirectTo: logoutUrl.toString() }, { status: 200, headers: { "cache-control": "no-store" } });
      response.cookies.set(AUTHGEAR_SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
      return response;
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) return NextResponse.json({ code: "SIGNOUT_FAILED", message: "Could not sign out. Try again." }, { status: 500 });
    return NextResponse.json({ ok: true }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("logout route failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ code: "SERVER_ERROR", message: "The server had a problem. Please try again." }, { status: 500 });
  }
}

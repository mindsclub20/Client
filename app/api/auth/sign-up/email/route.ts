import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateSignupInput } from "@/lib/auth-validation.js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ code: "INVALID_ORIGIN", message: "This request was blocked for security reasons." }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ code: "INVALID_JSON", message: "Enter valid account details." }, { status: 400 });
  }

  const validationError = validateSignupInput(body);
  if (validationError) return NextResponse.json({ code: "INVALID_INPUT", message: validationError }, { status: 400 });

  const input = body as { name: string; email: string; password: string };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: { data: { full_name: input.name.trim() } }
    });

    if (error) {
      const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 400;
      return NextResponse.json({ code: error.code || "SIGNUP_FAILED", message: error.message }, { status });
    }

    if (!data.session) {
      return NextResponse.json({ needsEmailConfirmation: true, message: "Account created. Check your email for a confirmation link, then log in." }, { status: 202 });
    }

    return NextResponse.json({ user: { id: data.user?.id, email: data.user?.email } }, { status: 200 });
  } catch (error) {
    console.error("signup route failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ code: "SERVER_ERROR", message: "The server had a problem. Please try again." }, { status: 500 });
  }
}

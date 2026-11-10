import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateLoginInput } from "@/lib/auth-validation.js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ code: "INVALID_ORIGIN", message: "This request was blocked for security reasons." }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ code: "INVALID_JSON", message: "Enter valid login details." }, { status: 400 });
  }

  const validationError = validateLoginInput(body);
  if (validationError) return NextResponse.json({ code: "INVALID_INPUT", message: validationError }, { status: 400 });

  const input = body as { email: string; password: string };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: input.email.trim(), password: input.password });
    if (error) {
      const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 401;
      return NextResponse.json({ code: error.code || "INVALID_CREDENTIALS", message: error.message }, { status });
    }
    return NextResponse.json({ user: { id: data.user.id, email: data.user.email } }, { status: 200 });
  } catch (error) {
    console.error("login route failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ code: "SERVER_ERROR", message: "The server had a problem. Please try again." }, { status: 500 });
  }
}

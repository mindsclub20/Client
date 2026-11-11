import { NextResponse } from "next/server";
import { getCurrentAdminContext } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user, isAdmin } = await getCurrentAdminContext();

    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: { "cache-control": "no-store" } });
    }

    if (!isAdmin) {
      return NextResponse.json({ error: "forbidden" }, { status: 403, headers: { "cache-control": "no-store" } });
    }

    return NextResponse.json(
      { user: { id: user.id, email: user.email, role: "admin" } },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("admin session check failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

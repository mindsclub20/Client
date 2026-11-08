import { auth } from "../lib/auth.js";

const noStore = { "cache-control": "no-store" };

// Server-side session check. The portal trusts this response, not browser state.
export async function GET(request) {
  try {
    const s = await auth.api.getSession({ headers: request.headers });
    if (!s) return Response.json({ error: "unauthenticated" }, { status: 401, headers: noStore });
    return Response.json(
      { user: { name: s.user.name, email: s.user.email }, expiresAt: s.session.expiresAt },
      { headers: noStore }
    );
  } catch (e) {
    console.error("session check failed", e && e.message);
    return Response.json({ error: "server_error" }, { status: 500, headers: noStore });
  }
}

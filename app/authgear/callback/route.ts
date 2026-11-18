import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import {
  AUTHGEAR_ISSUER,
  AUTHGEAR_SESSION_COOKIE,
  authgearCookieOptions,
  createAuthgearSessionToken,
  getAuthgearConfig,
  getAuthgearRedirectUri,
  isAllowedAuthgearAdmin
} from "@/lib/authgear";

export const runtime = "nodejs";

function clearFlowCookies(response: NextResponse) {
  for (const name of ["maxweb-ag-state", "maxweb-ag-nonce", "maxweb-ag-verifier"]) {
    response.cookies.set(name, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  }
}

function fail(request: NextRequest, reason: string) {
  const response = NextResponse.redirect(new URL("/?authgear=" + encodeURIComponent(reason) + "#login", request.url));
  clearFlowCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("maxweb-ag-state")?.value;
  const nonce = request.cookies.get("maxweb-ag-nonce")?.value;
  const verifier = request.cookies.get("maxweb-ag-verifier")?.value;

  if (request.nextUrl.searchParams.get("error")) return fail(request, "login_cancelled");
  if (!code || !returnedState || !expectedState || returnedState !== expectedState || !nonce || !verifier) {
    return fail(request, "invalid_callback");
  }

  try {
    const { clientId } = getAuthgearConfig();
    const redirectUri = getAuthgearRedirectUri(request.nextUrl.origin);
    const tokenResponse = await fetch(AUTHGEAR_ISSUER + "/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      cache: "no-store",
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier
      })
    });
    if (!tokenResponse.ok) return fail(request, "token_exchange_failed");
    const tokenData = await tokenResponse.json() as { id_token?: string };
    if (!tokenData.id_token) return fail(request, "missing_id_token");

    const jwks = createRemoteJWKSet(new URL(AUTHGEAR_ISSUER + "/oauth2/jwks"));
    const { payload } = await jwtVerify(tokenData.id_token, jwks, {
      issuer: AUTHGEAR_ISSUER,
      audience: clientId
    });
    if (payload.nonce !== nonce) return fail(request, "invalid_nonce");
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return fail(request, "missing_profile");

    const role = isAllowedAuthgearAdmin(payload.email, payload.email_verified) ? "admin" : "client";
    const sessionToken = await createAuthgearSessionToken({
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : (typeof payload.preferred_username === "string" ? payload.preferred_username : null),
      role
    });
    const response = NextResponse.redirect(new URL(role === "admin" ? "/admin" : "/#portal", request.url));
    response.cookies.set(AUTHGEAR_SESSION_COOKIE, sessionToken, authgearCookieOptions());
    clearFlowCookies(response);
    return response;
  } catch (error) {
    console.error("Authgear callback failed", error instanceof Error ? error.message : "unknown error");
    return fail(request, "authentication_failed");
  }
}

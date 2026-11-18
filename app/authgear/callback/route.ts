import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import {
  AUTHGEAR_ISSUER,
  AUTHGEAR_SESSION_COOKIE,
  authgearCookieOptions,
  createAuthgearSessionToken,
  fetchAuthgearUserInfo,
  getAuthgearConfig,
  getAuthgearRedirectUri,
  isAllowedAuthgearAdmin,
  resolveAuthgearProfileFromClaims,
} from "@/lib/authgear";

export const runtime = "nodejs";

function clearFlowCookies(response: NextResponse) {
  for (const name of ["maxweb-ag-state", "maxweb-ag-nonce", "maxweb-ag-verifier"]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

function fail(request: NextRequest, reason: string) {
  const response = NextResponse.redirect(
    new URL("/?authgear=" + encodeURIComponent(reason) + "#login", request.url)
  );
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
  if (
    !code ||
    !returnedState ||
    !expectedState ||
    returnedState !== expectedState ||
    !nonce ||
    !verifier
  ) {
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
        code_verifier: verifier,
      }),
    });
    if (!tokenResponse.ok) return fail(request, "token_exchange_failed");

    const tokenData = (await tokenResponse.json()) as {
      id_token?: string;
      access_token?: string;
    };
    // Never log tokenData — contains access_token / id_token.
    if (!tokenData.id_token) return fail(request, "missing_id_token");

    const jwks = createRemoteJWKSet(new URL(AUTHGEAR_ISSUER + "/oauth2/jwks"));
    const { payload } = await jwtVerify(tokenData.id_token, jwks, {
      issuer: AUTHGEAR_ISSUER,
      audience: clientId,
    });
    if (payload.nonce !== nonce) return fail(request, "invalid_nonce");
    if (typeof payload.sub !== "string" || !payload.sub) {
      return fail(request, "missing_profile");
    }

    const idClaims = payload as Record<string, unknown>;
    let userInfo: Record<string, unknown> | null = null;

    // Authgear often keeps email off the ID token; fetch UserInfo with the access token.
    if (typeof idClaims.email !== "string" || !String(idClaims.email).trim()) {
      if (!tokenData.access_token) return fail(request, "missing_profile");
      userInfo = await fetchAuthgearUserInfo(tokenData.access_token);
      if (!userInfo) return fail(request, "userinfo_failed");
    }

    const resolved = resolveAuthgearProfileFromClaims(idClaims, userInfo);
    if (!resolved.ok) {
      if (resolved.reason === "subject_mismatch") return fail(request, "subject_mismatch");
      if (resolved.reason === "userinfo_failed" || resolved.reason === "invalid_userinfo") {
        return fail(request, "userinfo_failed");
      }
      if (resolved.reason === "missing_email") return fail(request, "missing_email");
      return fail(request, "missing_profile");
    }

    const role = isAllowedAuthgearAdmin(resolved.email, resolved.emailVerified)
      ? "admin"
      : "client";

    const sessionToken = await createAuthgearSessionToken({
      sub: resolved.sub,
      email: resolved.email,
      name: resolved.name,
      role,
    });

    const response = NextResponse.redirect(
      new URL(role === "admin" ? "/admin" : "/#portal", request.url)
    );
    response.cookies.set(AUTHGEAR_SESSION_COOKIE, sessionToken, authgearCookieOptions());
    clearFlowCookies(response);
    return response;
  } catch (error) {
    console.error(
      "Authgear callback failed",
      error instanceof Error ? error.message : "unknown error"
    );
    return fail(request, "authentication_failed");
  }
}

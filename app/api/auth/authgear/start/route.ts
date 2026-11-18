import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AUTHGEAR_ISSUER, authgearCookieOptions, getAuthgearConfig, getAuthgearRedirectUri } from "@/lib/authgear";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { clientId } = getAuthgearConfig();
    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const redirectUri = getAuthgearRedirectUri(request.nextUrl.origin);
    const authorize = new URL(AUTHGEAR_ISSUER + "/oauth2/authorize");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", "openid email profile");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("nonce", nonce);
    authorize.searchParams.set("code_challenge", challenge);
    authorize.searchParams.set("code_challenge_method", "S256");

    const response = NextResponse.redirect(authorize);
    const options = { ...authgearCookieOptions(), maxAge: 600 };
    response.cookies.set("maxweb-ag-state", state, options);
    response.cookies.set("maxweb-ag-nonce", nonce, options);
    response.cookies.set("maxweb-ag-verifier", verifier, options);
    return response;
  } catch (error) {
    console.error("Authgear start failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.redirect(new URL("/?authgear=configuration_error#login", request.url));
  }
}

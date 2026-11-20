import { createHash } from "node:crypto";
import { getAuthgearSession } from "@/lib/authgear";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "client";
  provider: "authgear" | "supabase";
  avatarUrl: string | null;
};

/** Deterministic UUID so Authgear subjects can own ai_conversations.user_id. */
export function stableUserIdFromSubject(subject: string): string {
  const hash = createHash("sha1").update("maxweb-authgear-v1:").update(subject).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5-ish
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function getAppUser(): Promise<AppUser | null> {
  const authgear = await getAuthgearSession();
  if (authgear) {
    return {
      id: stableUserIdFromSubject(authgear.sub),
      email: authgear.email,
      name: authgear.name,
      role: authgear.role,
      provider: "authgear",
      avatarUrl: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user || !user.email) return null;

  const meta = user.user_metadata || {};
  const name =
    typeof meta.full_name === "string"
      ? meta.full_name
      : typeof meta.name === "string"
        ? meta.name
        : null;
  const avatarUrl =
    typeof meta.avatar_url === "string"
      ? meta.avatar_url
      : typeof meta.picture === "string"
        ? meta.picture
        : null;

  return {
    id: user.id,
    email: user.email,
    name,
    role: user.app_metadata?.role === "admin" ? "admin" : "client",
    provider: "supabase",
    avatarUrl,
  };
}

/**
 * Data client for the signed-in user.
 * Authgear has no Supabase JWT, so RLS would block — use service role only after session check.
 */
export async function createUserDataClient(user: AppUser) {
  if (user.provider === "authgear") {
    return createSupabaseAdminClient();
  }
  return createSupabaseServerClient();
}

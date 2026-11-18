import { AUTHGEAR_ISSUER, getAuthgearSession } from "@/lib/authgear";
import { authgearSubjectToUserId } from "./authgear-user-id.mjs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Resolve the signed-in customer to the UUID used by MAXWEB's AI tables.
 * Authgear sessions use a stable UUID mapping and a server-only service client;
 * Supabase sessions continue using their own user UUID and RLS-scoped client.
 */
export async function getCurrentAIUserContext() {
  const authgearUser = await getAuthgearSession();

  if (authgearUser) {
    if (authgearUser.role !== "client") {
      return { user: null, supabase: null, forbidden: true, unavailable: false };
    }

    try {
      return {
        user: {
          id: authgearSubjectToUserId(AUTHGEAR_ISSUER, authgearUser.sub),
          email: authgearUser.email,
        },
        supabase: createSupabaseAdminClient(),
        forbidden: false,
        unavailable: false,
      };
    } catch (error) {
      console.error("Authgear AI storage client unavailable", {
        message: error instanceof Error ? error.message : "unknown_error",
      });
      return { user: null, supabase: null, forbidden: false, unavailable: true };
    }
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, supabase, forbidden: false, unavailable: false };
  }

  if (user.app_metadata?.role === "admin") {
    return { user: null, supabase, forbidden: true, unavailable: false };
  }

  return {
    user: { id: user.id, email: user.email },
    supabase,
    forbidden: false,
    unavailable: false,
  };
}

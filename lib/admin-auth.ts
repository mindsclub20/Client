import { getAuthgearSession } from "@/lib/authgear";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentAdminContext() {
  const authgearUser = await getAuthgearSession();
  if (authgearUser) {
    return {
      user: {
        id: authgearUser.sub,
        email: authgearUser.email,
        name: authgearUser.name,
        app_metadata: { role: authgearUser.role },
      },
      isAdmin: authgearUser.role === "admin",
      provider: "authgear" as const,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, isAdmin: false, provider: null };
  }

  // app_metadata is controlled by trusted server-side admin operations.
  // Never authorize using user_metadata because users can edit it themselves.
  return {
    user,
    isAdmin: user.app_metadata?.role === "admin",
    provider: "supabase" as const,
  };
}

/**
 * After getCurrentAdminContext() confirms isAdmin, use this for admin data reads.
 * Authgear sessions have no Supabase JWT, so RLS admin policies would return empty.
 * Service role is only used after server-side admin verification.
 */
export async function createVerifiedAdminDataClient() {
  const { isAdmin } = await getCurrentAdminContext();
  if (!isAdmin) {
    throw new Error("Admin data client requires a verified administrator session.");
  }
  return createSupabaseAdminClient();
}

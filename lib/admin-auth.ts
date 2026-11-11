import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentAdminContext() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, isAdmin: false };
  }

  // app_metadata is controlled by trusted server-side admin operations.
  // Never authorize using user_metadata because users can edit it themselves.
  return {
    user,
    isAdmin: user.app_metadata?.role === "admin"
  };
}

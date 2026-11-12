import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ClientDashboard from "./client-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ClientPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/#login");

  const isAdmin = user.app_metadata?.role === "admin";
  if (isAdmin) redirect("/admin");

  const name =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;

  return (
    <ClientDashboard
      userEmail={user.email || ""}
      userName={name}
    />
  );
}

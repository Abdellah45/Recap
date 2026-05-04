import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Smart role-based redirect:
// Employees  → /app/log
// Managers   → /app/dashboard
export default async function AppIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "manager") {
    redirect("/app/dashboard");
  } else {
    redirect("/app/log");
  }
}

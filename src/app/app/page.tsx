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

  if (!profile) {
    redirect("/onboarding/setup");
  }

  // All roles with dashboard access go there; employees go to log
  if (profile.role === "employee") {
    redirect("/app/log");
  } else {
    redirect("/app/dashboard");
  }
}

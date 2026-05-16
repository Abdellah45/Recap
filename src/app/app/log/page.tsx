import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DailyLogClient from "@/components/DailyLogClient";

export default async function DailyLogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, language, role, team_id, company_id")
    .eq("id", user!.id)
    .single();

  if (profile?.role === "manager" || profile?.role === "owner") {
    redirect("/app/dashboard");
  }

  // Fetch team info
  let teamName: string | null = null;
  let managerName: string | null = null;

  if (profile?.team_id) {
    const { data: team } = await supabase
      .from("teams")
      .select("name")
      .eq("id", profile.team_id)
      .single();
    teamName = team?.name ?? null;

    const { data: manager } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("team_id", profile.team_id)
      .eq("role", "manager")
      .eq("status", "active")
      .single();
    managerName = manager?.full_name ?? null;
  }

  const { data: recentLogs } = await supabase
    .from("daily_logs")
    .select("id, logged_at, ai_summary, blocker_note")
    .eq("user_id", user!.id)
    .order("logged_at", { ascending: false })
    .limit(3);

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <DailyLogClient
      firstName={firstName}
      userId={user!.id}
      recentLogs={recentLogs ?? []}
      language={profile?.language ?? "en"}
      teamName={teamName}
      managerName={managerName}
    />
  );
}

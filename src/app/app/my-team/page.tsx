import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ManagerTeamClient, { type EmployeeWithStats } from "@/components/ManagerTeamClient";
import { computeStats } from "@/lib/employeeScoring";

export default async function MyTeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, full_name, role, team_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding/setup");
  if (profile.role === "employee") redirect("/app/log");
  if (profile.role === "owner") redirect("/app/team");

  // Manager with no team
  if (!profile.team_id) {
    return (
      <div className="w-full max-w-xl flex flex-col items-center justify-center text-center py-24">
        <span className="material-symbols-outlined text-5xl text-[#c8c4d5] mb-4">group_off</span>
        <h2 className="text-2xl font-bold text-[#131b2e] mb-2">No team assigned yet</h2>
        <p className="text-[#464553]">The company owner needs to assign you to a team first.</p>
      </div>
    );
  }

  // Get team info
  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("id", profile.team_id)
    .single();

  // Get active employees in team
  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("team_id", profile.team_id)
    .eq("role", "employee")
    .eq("status", "active");

  // Get pending employees in company
  const { data: pendingProfiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", profile.company_id)
    .eq("role", "employee")
    .eq("status", "pending");

  const employees = members ?? [];
  const employeeIds = employees.map((e) => e.id);
  const todayStr = new Date().toISOString().split("T")[0];

  // Build 28-day date array
  const dates: string[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  // Today's logs
  let todayLogs: any[] = [];
  if (employeeIds.length > 0) {
    const { data } = await supabase
      .from("daily_logs")
      .select("user_id, raw_input, ai_summary, blocker_note, tasks_completed, mood_signal, logged_at")
      .eq("logged_at", todayStr)
      .in("user_id", employeeIds);
    todayLogs = data ?? [];
  }

  // Historical logs
  let historicalLogs: any[] = [];
  if (employeeIds.length > 0) {
    const { data } = await supabase
      .from("daily_logs")
      .select("user_id, logged_at, mood_signal, blocker_note")
      .gte("logged_at", dates[0])
      .lte("logged_at", todayStr)
      .in("user_id", employeeIds);
    historicalLogs = data ?? [];
  }

  // Build EmployeeWithStats array (server-computed scores)
  const employeesWithStats: EmployeeWithStats[] = employees.map((emp) => {
    const todayLog = todayLogs.find((l) => l.user_id === emp.id);
    const empLogs = historicalLogs.filter((l) => l.user_id === emp.id);

    const dailyData = dates.map((date) => {
      const log = empLogs.find((l) => l.logged_at === date);
      return { date, logged: !!log, mood: log?.mood_signal ?? null, hasBlocker: !!log?.blocker_note };
    });

    const stats = computeStats(dailyData, 28);

    return {
      id: emp.id,
      name: emp.full_name as string,
      loggedToday: !!todayLog,
      mood: (todayLog?.mood_signal ?? "on_track") as "on_track" | "at_risk" | "blocked",
      brief: todayLog?.ai_summary ?? null,
      blocker: todayLog?.blocker_note ?? null,
      tasks: (todayLog?.tasks_completed ?? []) as string[],
      rawInput: todayLog?.raw_input ?? null,
      loggedAt: todayLog?.logged_at ?? null,
      ...stats,
    };
  });

  return (
    <ManagerTeamClient
      teamName={team?.name ?? "My Team"}
      employees={employeesWithStats}
      pendingEmployees={(pendingProfiles ?? []).map((p) => ({ id: p.id, name: p.full_name as string }))}
    />
  );
}

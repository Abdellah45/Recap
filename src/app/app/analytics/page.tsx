import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AnalyticsSection, { type DailyTeamStat, type EmployeeHistoryRow } from "@/components/AnalyticsSection";

export default async function AnalyticsPage() {
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

  const isOwner = profile.role === "owner";

  // Owner sees all employees; manager sees only their team
  let employeesQuery = supabase
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", profile.company_id)
    .eq("role", "employee")
    .eq("status", "active");

  if (!isOwner) {
    if (!profile.team_id) {
      return (
        <div className="w-full max-w-xl flex flex-col items-center justify-center text-center py-24">
          <span className="material-symbols-outlined text-5xl text-[#c8c4d5] mb-4">analytics</span>
          <h2 className="text-2xl font-bold text-[#131b2e] mb-2">No team assigned yet</h2>
          <p className="text-[#464553]">Analytics will be available once you're assigned to a team.</p>
        </div>
      );
    }
    employeesQuery = employeesQuery.eq("team_id", profile.team_id);
  }

  const { data: members } = await employeesQuery;
  const employees = members ?? [];
  const employeeIds = employees.map((e) => e.id);

  const todayStr = new Date().toISOString().split("T")[0];
  const dates: string[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

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

  const teamDaily: DailyTeamStat[] = dates.map((date) => {
    const dayLogs = historicalLogs.filter((l) => l.logged_at === date);
    return { date, logged: dayLogs.length, total: employees.length, hasBlocker: dayLogs.some((l) => l.blocker_note) };
  });

  const employeeHistory: EmployeeHistoryRow[] = employees.map((emp) => {
    const empLogs = historicalLogs.filter((l) => l.user_id === emp.id);
    return {
      id: emp.id,
      name: emp.full_name as string,
      dailyData: dates.map((date) => {
        const log = empLogs.find((l) => l.logged_at === date);
        return { date, logged: !!log, mood: log?.mood_signal ?? null, hasBlocker: !!log?.blocker_note };
      }),
    };
  });

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-6xl mb-6">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
          Analytics
        </h2>
        <p className="text-[#464553] mt-2 font-medium">
          {isOwner ? "Company-wide performance" : "Your team's performance"} · Last 28 days
        </p>
      </div>
      <AnalyticsSection teamDaily={teamDaily} employeeHistory={employeeHistory} />
    </div>
  );
}

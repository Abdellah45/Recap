import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient, { type EmployeeRow } from "@/components/DashboardClient";
import AnalyticsSection, {
  type DailyTeamStat,
  type EmployeeHistoryRow,
} from "@/components/AnalyticsSection";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch manager profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) redirect("/onboarding/setup");
  if (profile.role === "employee") redirect("/app/log");

  // Fetch company
  const { data: company } = await supabase
    .from("companies")
    .select("name, invite_code")
    .eq("id", profile.company_id)
    .single();

  // Fetch all employees in this company
  const { data: teamMembers } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", profile.company_id)
    .eq("role", "employee");

  const employees = teamMembers ?? [];
  const employeeIds = employees.map((e) => e.id);

  // ── Today's logs ────────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split("T")[0];
  let todayLogs: any[] = [];
  if (employeeIds.length > 0) {
    const { data } = await supabase
      .from("daily_logs")
      .select("user_id, raw_input, ai_summary, blocker_note, tasks_completed, mood_signal, logged_at")
      .eq("logged_at", todayStr)
      .in("user_id", employeeIds);
    todayLogs = data ?? [];
  }

  const dashboardData: EmployeeRow[] = employees.map((emp) => {
    const log = todayLogs.find((l) => l.user_id === emp.id);
    return {
      id: emp.id,
      name: emp.full_name as string,
      hasLogged: !!log,
      brief: log?.ai_summary ?? null,
      tasks: (log?.tasks_completed ?? []) as string[],
      blocker: log?.blocker_note ?? null,
      mood: (log?.mood_signal ?? "on_track") as "on_track" | "at_risk" | "blocked",
      rawInput: log?.raw_input ?? null,
      loggedAt: log?.logged_at ?? null,
    };
  });

  // ── 28-day historical logs ───────────────────────────────────────────────────
  // Build the 28-day date array (oldest → newest)
  const dates: string[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  const startStr = dates[0];

  let historicalLogs: any[] = [];
  if (employeeIds.length > 0) {
    const { data } = await supabase
      .from("daily_logs")
      .select("user_id, logged_at, mood_signal, blocker_note")
      .gte("logged_at", startStr)
      .lte("logged_at", todayStr)
      .in("user_id", employeeIds)
      .order("logged_at", { ascending: true });
    historicalLogs = data ?? [];
  }

  // Team daily stats (for the bar chart)
  const teamDaily: DailyTeamStat[] = dates.map((date) => {
    const dayLogs = historicalLogs.filter((l) => l.logged_at === date);
    return {
      date,
      logged: dayLogs.length,
      total: employees.length,
      hasBlocker: dayLogs.some((l) => l.blocker_note),
    };
  });

  // Per-employee 28-day history (for rankings + trends)
  const employeeHistory: EmployeeHistoryRow[] = employees.map((emp) => {
    const empLogs = historicalLogs.filter((l) => l.user_id === emp.id);
    const dailyData = dates.map((date) => {
      const log = empLogs.find((l) => l.logged_at === date);
      return {
        date,
        logged: !!log,
        mood: (log?.mood_signal ?? null) as "on_track" | "at_risk" | "blocked" | null,
        hasBlocker: !!log?.blocker_note,
      };
    });
    return { id: emp.id, name: emp.full_name as string, dailyData };
  });

  const companyInfo = { name: company?.name ?? "", invite_code: company?.invite_code ?? "" };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Analytics section (28-day historical view) */}
      <AnalyticsSection teamDaily={teamDaily} employeeHistory={employeeHistory} />

      {/* Divider */}
      <div className="w-full max-w-6xl border-t border-[#eaedff] mb-10" />

      {/* Today's live dashboard */}
      <DashboardClient
        employees={dashboardData}
        company={companyInfo}
        managerName={profile.full_name ?? "Manager"}
      />
    </div>
  );
}

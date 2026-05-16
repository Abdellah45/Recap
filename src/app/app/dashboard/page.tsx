import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient, { type EmployeeRow } from "@/components/DashboardClient";
import AnalyticsSection, { type DailyTeamStat, type EmployeeHistoryRow } from "@/components/AnalyticsSection";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, full_name, role, team_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) redirect("/onboarding/setup");
  if (profile.role === "employee") redirect("/app/log");

  const { data: company } = await supabase
    .from("companies")
    .select("name, employee_invite_code, manager_invite_code")
    .eq("id", profile.company_id)
    .single();

  const isOwner = profile.role === "owner";

  // ── Fetch employees based on role ───────────────────────────────────────────
  let employeesQuery = supabase
    .from("profiles")
    .select("id, full_name, team_id")
    .eq("company_id", profile.company_id)
    .eq("role", "employee")
    .eq("status", "active");

  // Manager only sees their team
  if (!isOwner && profile.team_id) {
    employeesQuery = employeesQuery.eq("team_id", profile.team_id);
  } else if (!isOwner && !profile.team_id) {
    // Manager without a team assigned
    return (
      <div className="w-full max-w-xl flex flex-col items-center justify-center text-center py-20">
        <span className="material-symbols-outlined text-5xl text-[#c8c4d5] mb-4">group_off</span>
        <h2 className="text-2xl font-bold text-[#131b2e] mb-2">No team assigned yet</h2>
        <p className="text-[#464553]">The company owner needs to assign you to a team before you can view your dashboard.</p>
      </div>
    );
  }

  const { data: teamMembers } = await employeesQuery;
  const employees = teamMembers ?? [];
  const employeeIds = employees.map((e) => e.id);

  // ── Today's logs ─────────────────────────────────────────────────────────────
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

  // ── 28-day historical ──────────────────────────────────────────────────────
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

  // ── Owner pending count ────────────────────────────────────────────────────
  let pendingCount = 0;
  if (isOwner) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact" })
      .eq("company_id", profile.company_id)
      .eq("status", "pending");
    pendingCount = count ?? 0;
  }

  const companyInfo = {
    name: company?.name ?? "",
    invite_code: company?.employee_invite_code ?? "",
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Owner-only: pending badge */}
      {isOwner && pendingCount > 0 && (
        <div className="w-full max-w-6xl mb-6">
          <Link href="/app/team" className="flex items-center gap-3 bg-[#fff5f0] border border-[#ffc4a8] rounded-2xl p-4 hover:shadow-md transition-shadow">
            <div className="w-8 h-8 rounded-lg bg-[#ff4d00] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>person_alert</span>
            </div>
            <div className="flex-1">
              <p className="font-black text-[#341100] text-sm">
                {pendingCount} member{pendingCount > 1 ? "s" : ""} waiting for approval
              </p>
              <p className="text-xs text-[#7c3300]">Click to review in Team Management</p>
            </div>
            <span className="material-symbols-outlined text-[#ff4d00]">chevron_right</span>
          </Link>
        </div>
      )}

      <AnalyticsSection teamDaily={teamDaily} employeeHistory={employeeHistory} />
      <div className="w-full max-w-6xl border-t border-[#eaedff] mb-10" />
      <DashboardClient employees={dashboardData} company={companyInfo} managerName={profile.full_name ?? ""} />
    </div>
  );
}

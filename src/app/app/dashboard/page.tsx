import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient, { type EmployeeRow } from "@/components/DashboardClient";
import AnalyticsSection, { type DailyTeamStat, type EmployeeHistoryRow } from "@/components/AnalyticsSection";
import OwnerDashboardClient, { type TeamCardData } from "@/components/OwnerDashboardClient";

// ── Shared helpers ─────────────────────────────────────────────────────────────
function buildDates(days = 28): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().split("T")[0];
  });
}

function buildAnalyticsData(employees: any[], historicalLogs: any[], dates: string[]) {
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
  return { teamDaily, employeeHistory };
}

// ══════════════════════════════════════════════════════════════════════════════
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

  const todayStr = new Date().toISOString().split("T")[0];
  const dates = buildDates(28);

  // ════════════════════════════════════════════════════════════════════════════
  // OWNER VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (profile.role === "owner") {
    // Fetch all teams
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name")
      .eq("company_id", profile.company_id)
      .order("created_at");

    // Fetch all active non-owner profiles in this company
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, role, team_id, status")
      .eq("company_id", profile.company_id)
      .neq("id", user.id)
      .eq("status", "active");

    const managers  = (allProfiles ?? []).filter((p) => p.role === "manager");
    const employees = (allProfiles ?? []).filter((p) => p.role === "employee");
    const employeeIds = employees.map((e) => e.id);

    // Today's logs for all employees
    let todayLogs: any[] = [];
    if (employeeIds.length > 0) {
      const { data } = await supabase
        .from("daily_logs")
        .select("user_id, ai_summary, blocker_note, mood_signal")
        .eq("logged_at", todayStr)
        .in("user_id", employeeIds);
      todayLogs = data ?? [];
    }

    // Historical logs for analytics
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

    // Pending count
    const { count: pendingCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact" })
      .eq("company_id", profile.company_id)
      .eq("status", "pending");

    // Build team cards
    const teamCards: TeamCardData[] = (teams ?? []).map((team) => {
      const mgr = managers.find((m) => m.team_id === team.id);
      const teamEmps = employees.filter((e) => e.team_id === team.id);
      return {
        id: team.id,
        name: team.name,
        manager: mgr ? { id: mgr.id, name: mgr.full_name } : null,
        employees: teamEmps.map((emp) => {
          const log = todayLogs.find((l) => l.user_id === emp.id);
          return {
            id: emp.id,
            name: emp.full_name as string,
            loggedToday: !!log,
            mood: (log?.mood_signal ?? "on_track") as "on_track" | "at_risk" | "blocked",
            blocker: log?.blocker_note ?? null,
            brief: null,
          };
        }),
      };
    });

    const unassignedManagers  = managers.filter((m) => !m.team_id).map((m) => ({ id: m.id, name: m.full_name as string }));
    const unassignedEmployees = employees.filter((e) => !e.team_id).map((e) => ({ id: e.id, name: e.full_name as string }));

    const { teamDaily, employeeHistory } = buildAnalyticsData(employees, historicalLogs, dates);

    return (
      <div className="w-full flex flex-col items-center">
        <OwnerDashboardClient
          teams={teamCards}
          unassignedManagers={unassignedManagers}
          unassignedEmployees={unassignedEmployees}
          company={{
            name: company?.name ?? "",
            employeeCode: company?.employee_invite_code ?? "",
            managerCode:  company?.manager_invite_code  ?? "",
          }}
          pendingCount={pendingCount ?? 0}
          totalManagers={managers.length}
        />
        {employees.length > 0 && (
          <>
            <div className="w-full max-w-6xl border-t border-[#eaedff] mb-10" />
            <AnalyticsSection teamDaily={teamDaily} employeeHistory={employeeHistory} />
          </>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MANAGER VIEW
  // ════════════════════════════════════════════════════════════════════════════

  // Manager without team assigned — show invite code + waiting state
  if (!profile.team_id) {
    return (
      <div className="w-full max-w-xl flex flex-col items-center justify-center text-center py-24">
        <span className="material-symbols-outlined text-5xl text-[#c8c4d5] mb-4">group_off</span>
        <h2 className="text-2xl font-bold text-[#131b2e] mb-2">No team assigned yet</h2>
        <p className="text-[#464553] mb-6">The company owner needs to assign you to a team. Check back soon!</p>
        <div className="bg-[#f2f3ff] rounded-2xl p-5 border border-[#dde0ff] text-left w-full">
          <p className="text-[9px] font-bold text-[#464553] uppercase tracking-widest mb-2">Employee Invite Code</p>
          <p className="font-mono tracking-[0.3em] font-black text-xl text-[#1f108e]">{company?.employee_invite_code}</p>
          <p className="text-xs text-[#9896b0] mt-1">Share this with employees so they can request to join</p>
        </div>
      </div>
    );
  }

  // Fetch manager's team employees only
  const { data: teamMembers } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", profile.company_id)
    .eq("team_id", profile.team_id)
    .eq("role", "employee")
    .eq("status", "active");

  // Fetch pending employees in this company (managers can approve them)
  const { data: pendingEmployees } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("company_id", profile.company_id)
    .eq("role", "employee")
    .eq("status", "pending");

  const employees = teamMembers ?? [];
  const employeeIds = employees.map((e) => e.id);

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

  return (
    <div className="w-full flex flex-col items-center">
      <DashboardClient
        employees={dashboardData}
        company={{
          name: company?.name ?? "",
          invite_code: company?.employee_invite_code ?? "",
        }}
        managerName={profile.full_name ?? ""}
        pendingEmployees={(pendingEmployees ?? []).map((p) => ({ id: p.id, name: p.full_name as string }))}
      />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient, { type EmployeeRow } from "@/components/DashboardClient";

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

  // Fetch today's logs (including raw_input)
  const todayStr = new Date().toISOString().split("T")[0];
  let logs: any[] = [];
  if (employeeIds.length > 0) {
    const { data: todayLogs } = await supabase
      .from("daily_logs")
      .select("user_id, raw_input, ai_summary, blocker_note, tasks_completed, mood_signal, logged_at")
      .eq("logged_at", todayStr)
      .in("user_id", employeeIds);
    logs = todayLogs ?? [];
  }

  // Merge employee + log data
  const dashboardData: EmployeeRow[] = employees.map((emp) => {
    const log = logs.find((l) => l.user_id === emp.id);
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
    <DashboardClient
      employees={dashboardData}
      company={{ name: company?.name ?? "", invite_code: company?.invite_code ?? "" }}
      managerName={profile.full_name ?? "Manager"}
    />
  );
}

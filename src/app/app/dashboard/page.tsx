import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

  // Fetch today's logs for these employees
  const todayStr = new Date().toISOString().split("T")[0];
  
  let logs: any[] = [];
  if (employeeIds.length > 0) {
    const { data: todayLogs } = await supabase
      .from("daily_logs")
      .select("user_id, ai_summary, blocker_note")
      .eq("logged_at", todayStr)
      .in("user_id", employeeIds);
      
    logs = todayLogs ?? [];
  }

  // Combine data
  const dashboardData = employees.map((emp) => {
    const log = logs.find((l) => l.user_id === emp.id);
    return {
      id: emp.id,
      name: emp.full_name,
      hasLogged: !!log,
      summary: log?.ai_summary,
      blocker: log?.blocker_note,
    };
  });

  const loggedCount = dashboardData.filter((d) => d.hasLogged).length;
  const pendingCount = dashboardData.length - loggedCount;
  const blockedCount = dashboardData.filter((d) => d.blocker).length;

  return (
    <div className="w-full max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tighter text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Dashboard
          </h2>
          <p className="text-[#464553] mt-2 text-lg font-medium">
            Overview for {new Date().toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-xs font-bold text-[#464553] uppercase tracking-wider mb-1">
            {company?.name} Invite Code
          </p>
          <div className="bg-[#f2f3ff] px-4 py-2 rounded-xl text-lg font-mono tracking-widest font-bold text-[#1f108e] border border-[#eaedff]">
            {company?.invite_code}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 ambient-shadow border border-[#eaedff] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#464553] uppercase tracking-wider mb-1">Logged Today</p>
            <p className="text-3xl font-black text-[#131b2e]">{loggedCount}<span className="text-lg text-[#c8c4d5]">/{dashboardData.length}</span></p>
          </div>
          <div className="w-12 h-12 rounded-full bg-[#d4f5e9] flex items-center justify-center text-[#006b5f]">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 ambient-shadow border border-[#eaedff] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#464553] uppercase tracking-wider mb-1">Pending</p>
            <p className="text-3xl font-black text-[#464553]">{pendingCount}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-[#f2f3ff] flex items-center justify-center text-[#1f108e]">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>pending_actions</span>
          </div>
        </div>
        <div className={`rounded-2xl p-6 border flex items-center justify-between ${blockedCount > 0 ? 'bg-[#ffdbca] border-[#ffdbca] ambient-shadow' : 'bg-white border-[#eaedff] ambient-shadow'}`}>
          <div>
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${blockedCount > 0 ? 'text-[#783200]' : 'text-[#464553]'}`}>Blocked</p>
            <p className={`text-3xl font-black ${blockedCount > 0 ? 'text-[#341100]' : 'text-[#131b2e]'}`}>{blockedCount}</p>
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${blockedCount > 0 ? 'bg-white/50 text-[#783200]' : 'bg-[#fff0f0] text-[#ff0000]'}`}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
          </div>
        </div>
      </div>

      {/* Team Cards */}
      <h3 className="text-xl font-bold text-[#131b2e] mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>
        Team Summaries
      </h3>
      
      {dashboardData.length === 0 ? (
        <div className="bg-[#f2f3ff] p-12 rounded-2xl text-center border border-[#eaedff]">
          <span className="material-symbols-outlined text-4xl text-[#c8c4d5] mb-3">group_add</span>
          <p className="font-bold text-[#131b2e] text-lg">Your team is empty</p>
          <p className="text-[#464553] text-sm mt-1">Share the invite code <b>{company?.invite_code}</b> with your employees so they can join.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {dashboardData.map((emp) => (
            <div key={emp.id} className={`rounded-2xl overflow-hidden border ${emp.hasLogged ? 'bg-white ambient-shadow border-[#eaedff]' : 'bg-slate-50 border-dashed border-slate-200 opacity-70'}`}>
              {/* Blocker Banner */}
              {emp.blocker && (
                <div className="bg-[#ffdbca] px-6 py-3 flex items-start gap-3 border-b border-[#ffc4a8]">
                  <span className="material-symbols-outlined text-[#783200] text-xl mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                  <div>
                    <p className="text-xs font-bold text-[#783200] uppercase tracking-wider mb-0.5">Blocker Detected</p>
                    <p className="text-sm font-medium text-[#341100]">{emp.blocker}</p>
                  </div>
                </div>
              )}
              
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1f108e] flex items-center justify-center text-white font-bold text-sm">
                      {emp.name?.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-[#131b2e] text-lg">{emp.name}</p>
                      <p className="text-xs font-semibold text-[#464553] uppercase tracking-wider">Employee</p>
                    </div>
                  </div>
                  {emp.hasLogged ? (
                    <span className="bg-[#d4f5e9] text-[#006b5f] text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">done</span> Logged
                    </span>
                  ) : (
                    <span className="bg-slate-200 text-slate-500 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">hourglass_empty</span> Pending
                    </span>
                  )}
                </div>

                {emp.hasLogged && (
                  <div className="bg-[#f2f3ff] rounded-xl p-5 border border-[#eaedff]">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#544fc0] mb-2">
                      AI Summary
                    </p>
                    <p className="text-[#131b2e] leading-relaxed text-sm">
                      {emp.summary || "Raw text submitted. AI summary generating..."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

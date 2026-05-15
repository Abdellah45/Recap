import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type MoodSignal = "on_track" | "at_risk" | "blocked";

const MOOD_CONFIG: Record<MoodSignal, { label: string; color: string; bg: string; border: string; dot: string }> = {
  on_track: {
    label: "On Track",
    color: "text-[#006b5f]",
    bg: "bg-[#d4f5e9]",
    border: "border-l-[#00b894]",
    dot: "bg-[#00b894]",
  },
  at_risk: {
    label: "At Risk",
    color: "text-[#7c4f00]",
    bg: "bg-[#fff3d4]",
    border: "border-l-[#f59e0b]",
    dot: "bg-[#f59e0b]",
  },
  blocked: {
    label: "Blocked",
    color: "text-[#7c1f00]",
    bg: "bg-[#ffdbca]",
    border: "border-l-[#ff4d00]",
    dot: "bg-[#ff4d00]",
  },
};

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

  // Fetch today's logs
  const todayStr = new Date().toISOString().split("T")[0];
  let logs: any[] = [];
  if (employeeIds.length > 0) {
    const { data: todayLogs } = await supabase
      .from("daily_logs")
      .select("user_id, ai_summary, blocker_note, tasks_completed, mood_signal")
      .eq("logged_at", todayStr)
      .in("user_id", employeeIds);
    logs = todayLogs ?? [];
  }

  // Merge employee + log data
  const dashboardData = employees.map((emp) => {
    const log = logs.find((l) => l.user_id === emp.id);
    return {
      id: emp.id,
      name: emp.full_name as string,
      hasLogged: !!log,
      brief: log?.ai_summary as string | null,
      tasks: (log?.tasks_completed ?? []) as string[],
      blocker: log?.blocker_note as string | null,
      mood: (log?.mood_signal ?? "on_track") as MoodSignal,
    };
  });

  // Stats
  const total = dashboardData.length;
  const loggedCount = dashboardData.filter((d) => d.hasLogged).length;
  const blockers = dashboardData.filter((d) => d.blocker);
  const atRisk = dashboardData.filter((d) => d.mood === "at_risk").length;
  const progressPct = total > 0 ? Math.round((loggedCount / total) * 100) : 0;

  // SVG ring helpers
  const RADIUS = 36;
  const CIRCUM = 2 * Math.PI * RADIUS;
  const dashOffset = CIRCUM - (progressPct / 100) * CIRCUM;

  return (
    <div className="w-full max-w-6xl">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
        <div>
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tighter text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Dashboard
          </h2>
          <p className="text-[#464553] mt-2 font-medium">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        {/* Invite Code chip */}
        <div className="flex flex-col items-start md:items-end gap-1">
          <p className="text-[10px] font-bold text-[#464553] uppercase tracking-widest">
            {company?.name} · Invite Code
          </p>
          <div className="bg-[#f2f3ff] px-5 py-2.5 rounded-2xl text-xl font-mono tracking-[0.3em] font-black text-[#1f108e] border border-[#dde0ff] select-all">
            {company?.invite_code}
          </div>
        </div>
      </div>

      {/* ── Stats Row ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* Progress Ring */}
        <div className="col-span-2 md:col-span-1 bg-white rounded-2xl p-5 border border-[#eaedff] flex items-center gap-4">
          <svg width="88" height="88" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r={RADIUS} fill="none" stroke="#eaedff" strokeWidth="8" />
            <circle
              cx="44"
              cy="44"
              r={RADIUS}
              fill="none"
              stroke="#1f108e"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUM}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 44 44)"
            />
            <text x="44" y="49" textAnchor="middle" fontSize="16" fontWeight="800" fill="#131b2e">
              {progressPct}%
            </text>
          </svg>
          <div>
            <p className="text-[10px] font-bold text-[#464553] uppercase tracking-widest mb-1">Logged Today</p>
            <p className="text-3xl font-black text-[#131b2e]">
              {loggedCount}
              <span className="text-base font-semibold text-[#c8c4d5]">/{total}</span>
            </p>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-2xl p-5 border border-[#eaedff] flex flex-col justify-between">
          <div className="w-10 h-10 rounded-xl bg-[#f2f3ff] flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[#1f108e]" style={{ fontVariationSettings: "'FILL' 1" }}>
              hourglass_empty
            </span>
          </div>
          <div>
            <p className="text-2xl font-black text-[#131b2e]">{total - loggedCount}</p>
            <p className="text-[10px] font-bold text-[#464553] uppercase tracking-widest mt-0.5">Pending</p>
          </div>
        </div>

        {/* At Risk */}
        <div className={`rounded-2xl p-5 border flex flex-col justify-between ${atRisk > 0 ? "bg-[#fff3d4] border-[#fde68a]" : "bg-white border-[#eaedff]"}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${atRisk > 0 ? "bg-white/60" : "bg-[#fff8e6]"}`}>
            <span className={`material-symbols-outlined ${atRisk > 0 ? "text-[#b45309]" : "text-[#d97706]"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
              trending_down
            </span>
          </div>
          <div>
            <p className={`text-2xl font-black ${atRisk > 0 ? "text-[#92400e]" : "text-[#131b2e]"}`}>{atRisk}</p>
            <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${atRisk > 0 ? "text-[#92400e]" : "text-[#464553]"}`}>At Risk</p>
          </div>
        </div>

        {/* Blocked */}
        <div className={`rounded-2xl p-5 border flex flex-col justify-between ${blockers.length > 0 ? "bg-[#ffdbca] border-[#ffc4a8]" : "bg-white border-[#eaedff]"}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${blockers.length > 0 ? "bg-white/60" : "bg-[#fff0f0]"}`}>
            <span className={`material-symbols-outlined ${blockers.length > 0 ? "text-[#783200]" : "text-[#ef4444]"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
              block
            </span>
          </div>
          <div>
            <p className={`text-2xl font-black ${blockers.length > 0 ? "text-[#341100]" : "text-[#131b2e]"}`}>{blockers.length}</p>
            <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${blockers.length > 0 ? "text-[#783200]" : "text-[#464553]"}`}>Blocked</p>
          </div>
        </div>
      </div>

      {/* ── Team Progress Bar ───────────────────────────── */}
      <div className="bg-white rounded-2xl p-6 border border-[#eaedff] mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-[#131b2e]">Team Submission Progress</p>
          <p className="text-xs text-[#464553]">{loggedCount} of {total} submitted</p>
        </div>
        <div className="w-full h-3 bg-[#f2f3ff] rounded-full overflow-hidden flex">
          {/* Blocked segment */}
          {blockers.length > 0 && (
            <div
              className="h-full bg-[#ff4d00] transition-all duration-700"
              style={{ width: `${(blockers.length / Math.max(total, 1)) * 100}%` }}
            />
          )}
          {/* At risk segment */}
          {atRisk > 0 && (
            <div
              className="h-full bg-[#f59e0b] transition-all duration-700"
              style={{ width: `${(atRisk / Math.max(total, 1)) * 100}%` }}
            />
          )}
          {/* On track segment */}
          {(loggedCount - blockers.length - atRisk) > 0 && (
            <div
              className="h-full bg-[#00b894] transition-all duration-700"
              style={{ width: `${((loggedCount - blockers.length - atRisk) / Math.max(total, 1)) * 100}%` }}
            />
          )}
        </div>
        <div className="flex items-center gap-5 mt-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00b894]" />
            <span className="text-xs text-[#464553]">On Track</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
            <span className="text-xs text-[#464553]">At Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff4d00]" />
            <span className="text-xs text-[#464553]">Blocked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#eaedff]" />
            <span className="text-xs text-[#464553]">Pending</span>
          </div>
        </div>
      </div>

      {/* ── Blockers Spotlight ──────────────────────────── */}
      {blockers.length > 0 && (
        <div className="bg-[#fff5f0] border border-[#ffc4a8] rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-[#ff4d00] flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                warning
              </span>
            </div>
            <div>
              <p className="font-black text-[#341100] text-base">
                {blockers.length} {blockers.length === 1 ? "Person" : "People"} Blocked — Needs Attention
              </p>
              <p className="text-xs text-[#7c3300]">These employees cannot progress without your help</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {blockers.map((emp) => (
              <div key={emp.id} className="bg-white rounded-xl p-4 flex items-start gap-4 border border-[#ffd5bc]">
                <div className="w-9 h-9 rounded-full bg-[#ff4d00] flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {emp.name?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-[#131b2e] text-sm">{emp.name}</p>
                  <p className="text-sm text-[#7c3300] mt-0.5">{emp.blocker}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Team Cards ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
          Team Summaries
        </h3>
        <p className="text-xs text-[#464553]">{total} members</p>
      </div>

      {total === 0 ? (
        <div className="bg-[#f2f3ff] p-14 rounded-2xl text-center border border-[#eaedff]">
          <span className="material-symbols-outlined text-5xl text-[#c8c4d5]">group_add</span>
          <p className="font-bold text-[#131b2e] text-lg mt-3">Your team is empty</p>
          <p className="text-[#464553] text-sm mt-1">
            Share the invite code <span className="font-mono font-bold text-[#1f108e]">{company?.invite_code}</span> with your employees.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
          {dashboardData.map((emp) => {
            const mood = MOOD_CONFIG[emp.mood] ?? MOOD_CONFIG.on_track;
            return (
              <div
                key={emp.id}
                className={`flex flex-col rounded-2xl overflow-hidden border-l-4 border border-[#eaedff] bg-white ${emp.hasLogged ? mood.border + " shadow-sm" : "border-l-slate-200 opacity-60"}`}
              >
                {/* Card Header */}
                <div className="p-4 flex items-center justify-between border-b border-[#f2f3ff]">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${emp.hasLogged ? "bg-[#1f108e]" : "bg-slate-300"}`}>
                      {emp.name?.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-[#131b2e] text-sm leading-tight">{emp.name}</p>
                      {emp.hasLogged ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${mood.dot}`} />
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${mood.color}`}>
                            {mood.label}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending</span>
                      )}
                    </div>
                  </div>
                  {emp.hasLogged && (
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${mood.bg} ${mood.color}`}>
                      Logged
                    </span>
                  )}
                </div>

                {/* Card Body */}
                {emp.hasLogged ? (
                  <div className="p-4 flex flex-col gap-3 flex-grow">
                    {/* One-line brief */}
                    <p className="text-sm text-[#131b2e] leading-relaxed font-medium">
                      {emp.brief ?? "Summary being generated…"}
                    </p>

                    {/* Tasks checklist */}
                    {emp.tasks.length > 0 && (
                      <div className="bg-[#f8f9ff] rounded-xl p-3 border border-[#eaedff]">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#544fc0] mb-2">
                          Completed
                        </p>
                        <ul className="flex flex-col gap-1.5">
                          {emp.tasks.map((t, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="material-symbols-outlined text-[#00b894] text-[14px] mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                                check_circle
                              </span>
                              <span className="text-xs text-[#464553] leading-snug">{t}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-300 text-[18px]">schedule</span>
                    <p className="text-xs text-slate-400">No log submitted yet today</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

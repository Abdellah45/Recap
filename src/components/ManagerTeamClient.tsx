"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { scoreLabel } from "@/lib/employeeScoring";

type MoodSignal = "on_track" | "at_risk" | "blocked";

export type EmployeeWithStats = {
  id: string;
  name: string;
  // Today
  loggedToday: boolean;
  mood: MoodSignal;
  brief: string | null;
  blocker: string | null;
  tasks: string[];
  rawInput: string | null;
  loggedAt: string | null;
  // Scores
  overall: number;
  consistency: number;
  reliability: number;
  blockerScore: number;
  trend: "up" | "down" | "stable";
  logsInPeriod: number;
  blockedDays: number;
};

const MOOD_DOT: Record<MoodSignal, string> = {
  on_track: "bg-[#00b894]",
  at_risk: "bg-[#f59e0b]",
  blocked: "bg-[#ff4d00]",
};
const MOOD_LABEL: Record<MoodSignal, { label: string; color: string; bg: string }> = {
  on_track: { label: "On Track", color: "text-[#006b5f]", bg: "bg-[#d4f5e9]" },
  at_risk:  { label: "At Risk",  color: "text-[#7c4f00]", bg: "bg-[#fff3d4]" },
  blocked:  { label: "Blocked",  color: "text-[#7c1f00]", bg: "bg-[#ffdbca]" },
};

function ScoreRing({ score }: { score: number }) {
  const sl = scoreLabel(score);
  const R = 28; const C = 2 * Math.PI * R;
  const offset = C - (score / 100) * C;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68">
      <circle cx="34" cy="34" r={R} fill="none" stroke="#eaedff" strokeWidth="6" />
      <circle cx="34" cy="34" r={R} fill="none" stroke={sl.ring} strokeWidth="6"
        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
        transform="rotate(-90 34 34)" />
      <text x="34" y="39" textAnchor="middle" fontSize="13" fontWeight="900" fill="#131b2e">{score}</text>
    </svg>
  );
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-[#f2f3ff] rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.min((value / 33.33) * 100, 100)}%`, backgroundColor: color }} />
    </div>
  );
}

export default function ManagerTeamClient({
  teamName,
  employees,
  pendingEmployees: initialPending,
}: {
  teamName: string;
  employees: EmployeeWithStats[];
  pendingEmployees: Array<{ id: string; name: string }>;
}) {
  const supabase = createClient();
  const [selected, setSelected] = useState<EmployeeWithStats | null>(null);
  const [rawExpanded, setRawExpanded] = useState(false);
  const [pending, setPending] = useState(initialPending);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"score" | "name" | "today">("score");
  const [filterMood, setFilterMood] = useState<"all" | MoodSignal>("all");

  async function approveEmployee(id: string) {
    setLoadingId(id);
    await supabase.from("profiles").update({ status: "active" }).eq("id", id);
    setPending((p) => p.filter((u) => u.id !== id));
    setLoadingId(null);
  }
  async function rejectEmployee(id: string) {
    setLoadingId(id);
    await supabase.from("profiles").update({ status: "rejected" }).eq("id", id);
    setPending((p) => p.filter((u) => u.id !== id));
    setLoadingId(null);
  }

  const sorted = [...employees]
    .filter((e) => filterMood === "all" || (filterMood === "on_track" ? (e.loggedToday && e.mood === "on_track") : e.mood === filterMood))
    .sort((a, b) =>
      sortBy === "score" ? b.overall - a.overall :
      sortBy === "name"  ? a.name.localeCompare(b.name) :
      (b.loggedToday ? 1 : 0) - (a.loggedToday ? 1 : 0)
    );

  const loggedCount = employees.filter((e) => e.loggedToday).length;
  const blockedCount = employees.filter((e) => e.blocker).length;
  const avgScore = employees.length > 0
    ? Math.round(employees.reduce((s, e) => s + e.overall, 0) / employees.length)
    : 0;

  return (
    <>
      <div className="w-full max-w-6xl">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#f2f3ff] text-[#1f108e] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-[#dde0ff]">
              My Team
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
            {teamName}
          </h2>
          <p className="text-[#464553] mt-2 font-medium">
            {employees.length} member{employees.length !== 1 ? "s" : ""} · {loggedCount} logged today
          </p>
        </div>

        {/* ── Quick stats ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Team Size",   value: employees.length, icon: "group",           bg: "bg-[#f2f3ff]", color: "text-[#1f108e]" },
            { label: "Logged Today",value: `${loggedCount}/${employees.length}`, icon: "task_alt", bg: "bg-[#d4f5e9]", color: "text-[#006b5f]" },
            { label: "Avg. Score",  value: `${avgScore}/100`, icon: "military_tech",  bg: "bg-[#fff3d4]", color: "text-[#7c4f00]" },
            { label: "Blocked",     value: blockedCount,      icon: "warning",         bg: blockedCount > 0 ? "bg-[#ffdbca]" : "bg-[#f2f3ff]", color: blockedCount > 0 ? "text-[#783200]" : "text-[#9896b0]" },
          ].map(({ label, value, icon, bg, color }) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-[#eaedff]">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <span className={`material-symbols-outlined ${color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
              </div>
              <p className="text-2xl font-black text-[#131b2e]">{value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#464553] mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Pending Approvals ─────────────────────────────────────────── */}
        {pending.length > 0 && (
          <div className="bg-[#fff5f0] border border-[#ffc4a8] rounded-2xl p-5 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#ff4d00] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>person_alert</span>
              </div>
              <div>
                <p className="font-black text-[#341100] text-sm">{pending.length} employee{pending.length > 1 ? "s" : ""} requesting to join</p>
                <p className="text-xs text-[#7c3300]">Approve to give them access to the app</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {pending.map((u) => (
                <div key={u.id} className="bg-white rounded-xl p-3 flex items-center gap-3 border border-[#ffd5bc]">
                  <div className="w-9 h-9 rounded-full bg-[#1f108e] flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {u.name?.substring(0, 2).toUpperCase()}
                  </div>
                  <p className="flex-1 font-semibold text-[#131b2e] text-sm">{u.name}</p>
                  <button onClick={() => approveEmployee(u.id)} disabled={loadingId === u.id}
                    className="bg-[#d4f5e9] text-[#006b5f] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#b0edd8] transition disabled:opacity-50">
                    Approve
                  </button>
                  <button onClick={() => rejectEmployee(u.id)} disabled={loadingId === u.id}
                    className="bg-[#f2f3ff] text-[#464553] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#eaedff] transition disabled:opacity-50">
                    Reject
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Controls ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h3 className="text-xl font-bold text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
            Employee Cards
          </h3>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Mood filter */}
            <div className="flex bg-[#f2f3ff] p-1 rounded-xl border border-[#eaedff]">
              {(["all", "on_track", "at_risk", "blocked"] as const).map((f) => (
                <button key={f} onClick={() => setFilterMood(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterMood === f ? "bg-[#1f108e] text-white shadow-sm" : "text-[#464553] hover:text-[#1f108e]"}`}>
                  {f === "all" ? "All" : f === "on_track" ? "On Track" : f === "at_risk" ? "At Risk" : "Blocked"}
                </button>
              ))}
            </div>
            {/* Sort */}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs bg-[#f2f3ff] rounded-xl px-3 py-2 text-[#131b2e] font-bold outline-none border border-[#eaedff]">
              <option value="score">Sort: Score</option>
              <option value="name">Sort: Name</option>
              <option value="today">Sort: Today</option>
            </select>
          </div>
        </div>

        {/* ── Employee Card Grid ───────────────────────────────────────── */}
        {employees.length === 0 ? (
          <div className="bg-[#f2f3ff] p-14 rounded-2xl text-center border border-[#eaedff]">
            <span className="material-symbols-outlined text-5xl text-[#c8c4d5]">group_add</span>
            <p className="font-bold text-[#131b2e] text-lg mt-3">No employees yet</p>
            <p className="text-[#464553] text-sm mt-1">Approve pending employees to add them to your team.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sorted.map((emp, rank) => {
              const sl = scoreLabel(emp.overall);
              const moodConfig = emp.loggedToday ? MOOD_LABEL[emp.mood] : null;
              return (
                <button
                  key={emp.id}
                  onClick={() => { setSelected(emp); setRawExpanded(false); }}
                  className="bg-white rounded-2xl border border-[#eaedff] p-5 text-left hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer w-full"
                >
                  {/* Top: avatar + name + score ring */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      {/* Rank badge */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0
                        ${rank === 0 ? "bg-[#ffd700] text-[#7c5a00]" : rank === 1 ? "bg-[#e0e7ef] text-[#464553]" : rank === 2 ? "bg-[#c97f4f] text-white" : "bg-[#f2f3ff] text-[#9896b0]"}`}>
                        {rank + 1}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-[#1f108e] flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {emp.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-[#131b2e] text-sm leading-tight">{emp.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {emp.trend === "up"   && <span className="text-[#00b894] text-xs font-bold">↑</span>}
                          {emp.trend === "down" && <span className="text-[#ff4d00] text-xs font-bold">↓</span>}
                          {emp.trend === "stable" && <span className="text-[#9896b0] text-xs">→</span>}
                          <span className="text-[10px] text-[#9896b0]">
                            {emp.trend === "up" ? "Improving" : emp.trend === "down" ? "Declining" : "Stable"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ScoreRing score={emp.overall} />
                  </div>

                  {/* Score label */}
                  <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full ${sl.bg} ${sl.color} uppercase tracking-wider`}>
                    {sl.label}
                  </span>

                  {/* Progress bars */}
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div>
                      <p className="text-[9px] font-bold text-[#464553] uppercase tracking-wider mb-1">Consistency</p>
                      <MiniBar value={emp.consistency} color="#1f108e" />
                      <p className="text-[9px] text-[#9896b0] mt-0.5">{emp.logsInPeriod}/28d</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-[#464553] uppercase tracking-wider mb-1">Reliability</p>
                      <MiniBar value={emp.reliability} color="#00b894" />
                      <p className="text-[9px] text-[#9896b0] mt-0.5">{Math.round((emp.reliability / 33.33) * 100)}%</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-[#464553] uppercase tracking-wider mb-1">Blocker-Free</p>
                      <MiniBar value={emp.blockerScore} color="#f59e0b" />
                      <p className="text-[9px] text-[#9896b0] mt-0.5">{emp.blockedDays}x blocked</p>
                    </div>
                  </div>

                  {/* Today status */}
                  <div className="mt-4 pt-4 border-t border-[#f2f3ff] flex items-center justify-between">
                    {emp.loggedToday && moodConfig ? (
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${MOOD_DOT[emp.mood]}`} />
                        <span className={`text-xs font-bold ${moodConfig.color}`}>{moodConfig.label} today</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Not logged today</span>
                    )}
                    <span className="text-[10px] text-[#9896b0] font-medium flex items-center gap-0.5">
                      View details <span className="material-symbols-outlined text-[13px]">chevron_right</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail Drawer ──────────────────────────────────────────────── */}
      <div className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${selected ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => { setSelected(null); setRawExpanded(false); }} />

      <div className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${selected ? "translate-x-0" : "translate-x-full"}`}>
        {selected && (
          <>
            {/* Drawer header */}
            <div className={`p-6 border-b flex items-start justify-between gap-4 shrink-0 ${selected.blocker ? "bg-[#fff5f0] border-[#ffc4a8]" : "bg-white border-[#eaedff]"}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0 ${selected.blocker ? "bg-[#ff4d00]" : "bg-[#1f108e]"}`}>
                  {selected.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-black text-[#131b2e] text-lg">{selected.name}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {(() => { const sl = scoreLabel(selected.overall); return (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sl.bg} ${sl.color}`}>{sl.label}</span>
                    ); })()}
                    <span className="text-xs text-[#9896b0]">{selected.overall}/100 · 28-day score</span>
                  </div>
                </div>
              </div>
              <button onClick={() => { setSelected(null); setRawExpanded(false); }}
                className="w-9 h-9 rounded-xl bg-[#f2f3ff] flex items-center justify-center hover:bg-[#e2e3ff] transition-colors shrink-0">
                <span className="material-symbols-outlined text-[#1f108e] text-[20px]">close</span>
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              {/* Score breakdown */}
              <div className="bg-[#f2f3ff] rounded-2xl p-5 border border-[#eaedff]">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#544fc0] mb-4">28-Day Performance</p>
                <div className="flex items-center gap-4 mb-5">
                  <ScoreRing score={selected.overall} />
                  <div className="flex-1">
                    <p className="text-3xl font-black text-[#131b2e]">{selected.overall}<span className="text-base font-semibold text-[#9896b0]">/100</span></p>
                    <div className="flex items-center gap-1 mt-1">
                      {selected.trend === "up"   && <span className="text-[#00b894] text-sm font-bold">↑ Improving</span>}
                      {selected.trend === "down" && <span className="text-[#ff4d00] text-sm font-bold">↓ Declining</span>}
                      {selected.trend === "stable" && <span className="text-[#9896b0] text-sm">→ Stable</span>}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Consistency",  value: selected.consistency,  color: "#1f108e", sub: `${selected.logsInPeriod}/28 days` },
                    { label: "Reliability",  value: selected.reliability,  color: "#00b894", sub: `${Math.round((selected.reliability / 33.33) * 100)}% on-track` },
                    { label: "Blocker-Free", value: selected.blockerScore, color: "#f59e0b", sub: `${selected.blockedDays}x blocked` },
                  ].map(({ label, value, color, sub }) => (
                    <div key={label}>
                      <p className="text-[9px] font-bold text-[#464553] uppercase tracking-wider mb-1.5">{label}</p>
                      <MiniBar value={value} color={color} />
                      <p className="text-[9px] text-[#9896b0] mt-1">{sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Today's log */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#464553] mb-3">Today's Log</p>
                {!selected.loggedToday ? (
                  <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <span className="material-symbols-outlined text-slate-300 text-4xl">schedule</span>
                    <div>
                      <p className="font-bold text-[#131b2e]">Not submitted yet</p>
                      <p className="text-xs text-[#464553] mt-0.5">{selected.name} hasn't logged today.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {selected.blocker && (
                      <div className="bg-[#fff5f0] border border-[#ffc4a8] rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-symbols-outlined text-[#ff4d00] text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                          <p className="font-black text-[#341100] text-sm uppercase tracking-wider">Blocked</p>
                        </div>
                        <p className="text-sm text-[#7c3300] leading-relaxed">{selected.blocker}</p>
                      </div>
                    )}
                    {selected.brief && (
                      <div className="bg-[#f2f3ff] rounded-2xl p-4 border border-[#eaedff]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#544fc0] mb-2">AI Summary</p>
                        <p className="text-sm text-[#131b2e] leading-relaxed">{selected.brief}</p>
                      </div>
                    )}
                    {selected.tasks.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#464553] mb-2">Completed Today</p>
                        <ul className="flex flex-col gap-2">
                          {selected.tasks.map((t, i) => (
                            <li key={i} className="flex items-start gap-3 bg-white border border-[#eaedff] rounded-xl p-3">
                              <span className="material-symbols-outlined text-[#00b894] text-[18px] mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                              <span className="text-sm text-[#131b2e]">{t}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selected.rawInput && (
                      <div>
                        <button onClick={() => setRawExpanded((p) => !p)}
                          className="flex items-center gap-2 text-xs font-bold text-[#464553] uppercase tracking-widest hover:text-[#1f108e] transition-colors">
                          <span className="material-symbols-outlined text-[16px]">{rawExpanded ? "expand_less" : "expand_more"}</span>
                          {rawExpanded ? "Hide" : "View"} original log
                        </button>
                        {rawExpanded && (
                          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <p className="text-sm text-[#464553] leading-relaxed whitespace-pre-wrap">{selected.rawInput}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

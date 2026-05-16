"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type MoodSignal = "on_track" | "at_risk" | "blocked";

const MOOD_DOT: Record<MoodSignal, string> = {
  on_track: "bg-[#00b894]",
  at_risk: "bg-[#f59e0b]",
  blocked: "bg-[#ff4d00]",
};

export type TeamCardData = {
  id: string;
  name: string;
  manager: { id: string; name: string } | null;
  employees: Array<{
    id: string;
    name: string;
    loggedToday: boolean;
    mood: MoodSignal;
    blocker: string | null;
    brief: string | null;
  }>;
};

export type OwnerCompanyInfo = {
  name: string;
  employeeCode: string;
  managerCode: string;
};

export default function OwnerDashboardClient({
  teams,
  unassignedManagers,
  unassignedEmployees,
  company,
  pendingCount,
  totalManagers,
}: {
  teams: TeamCardData[];
  unassignedManagers: Array<{ id: string; name: string }>;
  unassignedEmployees: Array<{ id: string; name: string }>;
  company: OwnerCompanyInfo;
  pendingCount: number;
  totalManagers: number;
}) {
  const supabase = createClient();
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [localTeams, setLocalTeams] = useState(teams);

  const totalEmployees = teams.reduce((s, t) => s + t.employees.length, 0) + unassignedEmployees.length;
  const totalLoggedToday = teams.reduce((s, t) => s + t.employees.filter((e) => e.loggedToday).length, 0);
  const totalBlockers = teams.reduce((s, t) => s + t.employees.filter((e) => e.blocker).length, 0);
  const submissionPct = totalEmployees > 0 ? Math.round((totalLoggedToday / totalEmployees) * 100) : 0;

  // ── Assign manager to team ─────────────────────────────────────────────────
  async function assignManager(teamId: string, managerId: string) {
    await supabase.from("profiles").update({ team_id: teamId }).eq("id", managerId);
    // Optimistic update
    setLocalTeams((prev) =>
      prev.map((t) => {
        if (t.id !== teamId) return t;
        const mgr = unassignedManagers.find((m) => m.id === managerId);
        return { ...t, manager: mgr ? { id: mgr.id, name: mgr.name } : t.manager };
      })
    );
  }

  return (
    <div className="w-full max-w-6xl">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#f2f3ff] text-[#1f108e] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-[#dde0ff]">
              Owner
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
            {company.name}
          </h2>
          <p className="text-[#464553] mt-2 font-medium">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        {/* Invite codes */}
        <div className="flex flex-col gap-2 items-start md:items-end">
          {[
            { label: "Employee Code", code: company.employeeCode, style: "text-[#1f108e] bg-[#f2f3ff] border-[#dde0ff]" },
            { label: "Manager Code",  code: company.managerCode,  style: "text-[#783200] bg-[#fff5f0] border-[#ffd5bc]" },
          ].map(({ label, code, style }) => (
            <div key={label} className="flex items-center gap-3">
              <p className="text-[9px] font-bold text-[#9896b0] uppercase tracking-widest">{label}</p>
              <button
                onClick={() => navigator.clipboard.writeText(code)}
                title="Click to copy"
                className={`font-mono tracking-[0.25em] font-black text-base px-4 py-1.5 rounded-xl border ${style} hover:opacity-75 transition`}
              >
                {code}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pending banner ─────────────────────────────────────────────────── */}
      {pendingCount > 0 && (
        <Link href="/app/team" className="flex items-center gap-3 bg-[#fff5f0] border border-[#ffc4a8] rounded-2xl p-4 mb-8 hover:shadow-md transition-shadow">
          <div className="w-8 h-8 rounded-lg bg-[#ff4d00] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>person_alert</span>
          </div>
          <div className="flex-1">
            <p className="font-black text-[#341100] text-sm">{pendingCount} member{pendingCount > 1 ? "s" : ""} waiting for approval</p>
            <p className="text-xs text-[#7c3300]">Go to Team Management to review</p>
          </div>
          <span className="material-symbols-outlined text-[#ff4d00]">chevron_right</span>
        </Link>
      )}

      {/* ── Company-wide stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Teams",       value: localTeams.length,   icon: "category",      bg: "bg-[#f2f3ff]", color: "text-[#1f108e]" },
          { label: "Managers",    value: totalManagers,       icon: "supervisor_account", bg: "bg-[#fff3d4]", color: "text-[#7c4f00]" },
          { label: "Employees",   value: totalEmployees,      icon: "group",         bg: "bg-[#d4f5e9]", color: "text-[#006b5f]" },
          { label: "Logged Today",value: `${totalLoggedToday}/${totalEmployees}`, icon: "task_alt", bg: blockersBg(totalBlockers), color: blockersColor(totalBlockers) },
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

      {/* ── Team Cards ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-bold text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>Teams Overview</h3>
        <Link href="/app/team" className="text-xs font-bold text-[#1f108e] hover:underline flex items-center gap-1">
          Manage teams <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </Link>
      </div>

      {localTeams.length === 0 ? (
        <div className="bg-[#f2f3ff] p-12 rounded-2xl text-center border border-[#eaedff] mb-10">
          <span className="material-symbols-outlined text-5xl text-[#c8c4d5]">category</span>
          <p className="font-bold text-[#131b2e] text-lg mt-3">No teams yet</p>
          <p className="text-[#464553] text-sm mt-1">
            <Link href="/app/team" className="text-[#1f108e] font-bold underline">Create your first team</Link> to start organizing your company.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {localTeams.map((team) => {
            const loggedInTeam = team.employees.filter((e) => e.loggedToday).length;
            const blockersInTeam = team.employees.filter((e) => e.blocker).length;
            const pct = team.employees.length > 0 ? Math.round((loggedInTeam / team.employees.length) * 100) : 0;
            const isExpanded = expandedTeam === team.id;

            return (
              <div key={team.id} className="bg-white rounded-2xl border border-[#eaedff] overflow-hidden shadow-sm">
                {/* Team header */}
                <div
                  className="p-5 cursor-pointer hover:bg-[#fafbff] transition-colors"
                  onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-black text-[#131b2e] text-lg">{team.name}</h4>
                        {blockersInTeam > 0 && (
                          <span className="bg-[#ffdbca] text-[#783200] text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {blockersInTeam} blocked
                          </span>
                        )}
                      </div>

                      {/* Manager row */}
                      {team.manager ? (
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-[#1f108e] flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                            {team.manager.name.substring(0, 2).toUpperCase()}
                          </div>
                          <p className="text-sm text-[#464553]">
                            <span className="font-semibold text-[#131b2e]">{team.manager.name}</span>
                            <span className="text-[#9896b0] ml-1">· Manager</span>
                          </p>
                        </div>
                      ) : (
                        <div className="mb-3">
                          {unassignedManagers.length > 0 ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#9896b0] italic">No manager assigned —</span>
                              <select
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => { if (e.target.value) assignManager(team.id, e.target.value); }}
                                defaultValue=""
                                className="text-xs bg-[#f2f3ff] rounded-lg px-2 py-1 text-[#1f108e] font-bold outline-none border border-[#dde0ff] cursor-pointer"
                              >
                                <option value="" disabled>Assign manager</option>
                                {unassignedManagers.map((m) => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <p className="text-xs text-[#9896b0] italic">No manager assigned</p>
                          )}
                        </div>
                      )}

                      {/* Progress bar mini */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-[#f2f3ff] rounded-full overflow-hidden">
                          <div className="h-full bg-[#1f108e] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-[#9896b0] shrink-0">
                          {loggedInTeam}/{team.employees.length} logged
                        </span>
                      </div>
                    </div>

                    <span className="material-symbols-outlined text-[#c8c4d5] text-[20px] shrink-0 mt-1">
                      {isExpanded ? "expand_less" : "expand_more"}
                    </span>
                  </div>
                </div>

                {/* Expanded employees */}
                {isExpanded && (
                  <div className="border-t border-[#f2f3ff]">
                    {team.employees.length === 0 ? (
                      <p className="text-xs text-[#9896b0] italic p-5">No employees in this team yet.</p>
                    ) : (
                      <div className="divide-y divide-[#f2f3ff]">
                        {team.employees.map((emp) => (
                          <div key={emp.id} className="px-5 py-3 flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${emp.loggedToday ? MOOD_DOT[emp.mood] : "bg-slate-200"}`} />
                            <div className="w-7 h-7 rounded-full bg-[#f2f3ff] flex items-center justify-center text-[#1f108e] font-bold text-[11px] shrink-0">
                              {emp.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#131b2e] truncate">{emp.name}</p>
                              {emp.loggedToday && emp.brief && (
                                <p className="text-xs text-[#464553] truncate mt-0.5">{emp.brief}</p>
                              )}
                            </div>
                            {emp.loggedToday ? (
                              <span className="text-[10px] font-bold text-[#006b5f] bg-[#d4f5e9] px-2 py-0.5 rounded-full shrink-0">Logged</span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">Pending</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Unassigned section ─────────────────────────────────────────────── */}
      {(unassignedManagers.length > 0 || unassignedEmployees.length > 0) && (
        <div className="bg-[#fff3d4] border border-[#fde68a] rounded-2xl p-5 mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[#7c4f00]" style={{ fontVariationSettings: "'FILL' 1" }}>person_off</span>
            <p className="font-bold text-[#7c4f00] text-sm">
              {unassignedManagers.length + unassignedEmployees.length} member{(unassignedManagers.length + unassignedEmployees.length) > 1 ? "s" : ""} not assigned to any team
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[...unassignedManagers.map(m => ({ ...m, role: "manager" })), ...unassignedEmployees.map(e => ({ ...e, role: "employee" }))].map((u) => (
              <div key={u.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-[#fde68a]">
                <div className="w-6 h-6 rounded-full bg-[#1f108e] flex items-center justify-center text-white font-bold text-[10px]">
                  {u.name.substring(0, 2).toUpperCase()}
                </div>
                <p className="text-sm font-medium text-[#131b2e]">{u.name}</p>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${u.role === "manager" ? "bg-[#fff3d4] text-[#7c4f00]" : "bg-[#f2f3ff] text-[#1f108e]"}`}>
                  {u.role}
                </span>
              </div>
            ))}
          </div>
          <Link href="/app/team" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#7c4f00] hover:underline">
            Assign them in Team Management <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </div>
      )}
    </div>
  );
}

function blockersBg(n: number) { return n > 0 ? "bg-[#ffdbca]" : "bg-[#d4f5e9]"; }
function blockersColor(n: number) { return n > 0 ? "text-[#783200]" : "text-[#006b5f]"; }

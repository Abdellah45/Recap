"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type MoodSignal = "on_track" | "at_risk" | "blocked";
type FilterType = "all" | "logged" | "pending" | "at_risk" | "blocked";

const MOOD_CONFIG: Record<MoodSignal, { label: string; color: string; bg: string; borderLeft: string; dot: string; textDark: string }> = {
  on_track: {
    label: "On Track",
    color: "text-[#006b5f]",
    bg: "bg-[#d4f5e9]",
    borderLeft: "border-l-[#00b894]",
    dot: "bg-[#00b894]",
    textDark: "text-[#004d43]",
  },
  at_risk: {
    label: "At Risk",
    color: "text-[#7c4f00]",
    bg: "bg-[#fff3d4]",
    borderLeft: "border-l-[#f59e0b]",
    dot: "bg-[#f59e0b]",
    textDark: "text-[#7c4f00]",
  },
  blocked: {
    label: "Blocked",
    color: "text-[#7c1f00]",
    bg: "bg-[#ffdbca]",
    borderLeft: "border-l-[#ff4d00]",
    dot: "bg-[#ff4d00]",
    textDark: "text-[#7c1f00]",
  },
};

export type EmployeeRow = {
  id: string;
  name: string;
  hasLogged: boolean;
  brief: string | null;
  tasks: string[];
  blocker: string | null;
  mood: MoodSignal;
  rawInput: string | null;
  loggedAt: string | null;
};

export type CompanyInfo = {
  name: string;
  invite_code: string;
};

export default function DashboardClient({
  employees,
  company,
  managerName,
  pendingEmployees = [],
}: {
  employees: EmployeeRow[];
  company: CompanyInfo;
  managerName: string;
  pendingEmployees?: Array<{ id: string; name: string }>;
}) {
  const supabase = createClient();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selected, setSelected] = useState<EmployeeRow | null>(null);
  const [rawExpanded, setRawExpanded] = useState(false);
  const [pending, setPending] = useState(pendingEmployees);
  const [loadingApproval, setLoadingApproval] = useState<string | null>(null);

  async function approveEmployee(id: string) {
    setLoadingApproval(id);
    await supabase.from("profiles").update({ status: "active" }).eq("id", id);
    setPending((p) => p.filter((u) => u.id !== id));
    setLoadingApproval(null);
  }

  async function rejectEmployee(id: string) {
    setLoadingApproval(id);
    await supabase.from("profiles").update({ status: "rejected" }).eq("id", id);
    setPending((p) => p.filter((u) => u.id !== id));
    setLoadingApproval(null);
  }

  // Close drawer on Escape
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") { setSelected(null); setRawExpanded(false); }
  }, []);
  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Stats
  const total = employees.length;
  const loggedCount = employees.filter((e) => e.hasLogged).length;
  const pendingCount = total - loggedCount;
  const atRiskCount = employees.filter((e) => e.mood === "at_risk").length;
  const blockers = employees.filter((e) => e.blocker);
  const progressPct = total > 0 ? Math.round((loggedCount / total) * 100) : 0;
  const RADIUS = 36;
  const CIRCUM = 2 * Math.PI * RADIUS;
  const dashOffset = CIRCUM - (progressPct / 100) * CIRCUM;

  // Filtering
  const filtered = employees.filter((e) => {
    if (activeFilter === "logged") return e.hasLogged;
    if (activeFilter === "pending") return !e.hasLogged;
    if (activeFilter === "at_risk") return e.mood === "at_risk";
    if (activeFilter === "blocked") return !!e.blocker;
    return true;
  });

  function toggleFilter(f: FilterType) {
    setActiveFilter((prev) => (prev === f ? "all" : f));
  }

  function formatTime(iso: string | null) {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  const statCard = (
    label: string,
    value: number,
    icon: string,
    filter: FilterType,
    activeBg: string,
    activeText: string,
    inactiveBg: string,
  ) => {
    const isActive = activeFilter === filter;
    return (
      <button
        onClick={() => toggleFilter(filter)}
        className={`rounded-2xl p-5 border flex flex-col justify-between text-left transition-all duration-200 cursor-pointer
          ${isActive
            ? `${activeBg} ring-2 ring-offset-2 ring-[#1f108e] shadow-lg scale-[1.02]`
            : `${inactiveBg} border-[#eaedff] hover:shadow-md hover:scale-[1.01]`
          }`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${isActive ? "bg-white/60" : "bg-[#f2f3ff]"}`}>
          <span className={`material-symbols-outlined ${isActive ? activeText : "text-[#1f108e]"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
            {icon}
          </span>
        </div>
        <div>
          <p className={`text-2xl font-black ${isActive ? activeText : "text-[#131b2e]"}`}>{value}</p>
          <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${isActive ? activeText : "text-[#464553]"}`}>{label}</p>
        </div>
        {isActive && (
          <p className={`text-[9px] font-bold uppercase tracking-widest mt-2 opacity-70 ${activeText}`}>
            Filtering ✕
          </p>
        )}
      </button>
    );
  };

  return (
    <>
      <div className="w-full max-w-6xl">
        {/* ── Header ─────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
          <div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
              Dashboard
            </h2>
            <p className="text-[#464553] mt-2 font-medium">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-1">
            <p className="text-[10px] font-bold text-[#464553] uppercase tracking-widest">{company.name} · Invite Code</p>
            <div className="bg-[#f2f3ff] px-5 py-2.5 rounded-2xl text-xl font-mono tracking-[0.3em] font-black text-[#1f108e] border border-[#dde0ff] select-all cursor-copy"
              title="Click to copy"
              onClick={() => navigator.clipboard.writeText(company.invite_code)}
            >
              {company.invite_code}
            </div>
            <p className="text-[9px] text-[#9896b0]">Click to copy</p>
          </div>
        </div>

        {/* ── Stats Row ──────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Progress Ring — clickable to show logged */}
          <button
            onClick={() => toggleFilter("logged")}
            className={`col-span-2 md:col-span-1 rounded-2xl p-5 border flex items-center gap-4 transition-all duration-200 cursor-pointer
              ${activeFilter === "logged"
                ? "bg-[#edf9f5] ring-2 ring-offset-2 ring-[#1f108e] shadow-lg scale-[1.02] border-[#00b894]"
                : "bg-white border-[#eaedff] hover:shadow-md hover:scale-[1.01]"
              }`}
          >
            <svg width="80" height="80" viewBox="0 0 88 88" className="shrink-0">
              <circle cx="44" cy="44" r={RADIUS} fill="none" stroke="#eaedff" strokeWidth="8" />
              <circle cx="44" cy="44" r={RADIUS} fill="none" stroke="#1f108e" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={CIRCUM} strokeDashoffset={dashOffset} transform="rotate(-90 44 44)"
              />
              <text x="44" y="49" textAnchor="middle" fontSize="16" fontWeight="800" fill="#131b2e">{progressPct}%</text>
            </svg>
            <div className="text-left">
              <p className="text-[10px] font-bold text-[#464553] uppercase tracking-widest mb-1">Logged Today</p>
              <p className="text-3xl font-black text-[#131b2e]">
                {loggedCount}<span className="text-base font-semibold text-[#c8c4d5]">/{total}</span>
              </p>
              {activeFilter === "logged" && <p className="text-[9px] font-bold text-[#1f108e] uppercase tracking-widest mt-1">Filtering ✕</p>}
            </div>
          </button>

          {statCard("Pending", pendingCount, "hourglass_empty", "pending", "bg-[#f2f3ff]", "text-[#1f108e]", "bg-white")}
          {statCard("At Risk", atRiskCount, "trending_down", "at_risk", "bg-[#fff3d4]", "text-[#92400e]", "bg-white")}
          {statCard("Blocked", blockers.length, "block", "blocked", "bg-[#ffdbca]", "text-[#783200]", "bg-white")}
        </div>

        {/* ── Progress Bar ───────────────────────────── */}
        <div className="bg-white rounded-2xl p-6 border border-[#eaedff] mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-[#131b2e]">Team Submission Progress</p>
            <p className="text-xs text-[#464553]">{loggedCount} of {total} submitted</p>
          </div>
          <div className="w-full h-3 bg-[#f2f3ff] rounded-full overflow-hidden flex cursor-pointer">
            {blockers.length > 0 && (
              <div onClick={() => toggleFilter("blocked")} className="h-full bg-[#ff4d00] hover:opacity-80 transition-opacity" title="Click to filter blocked"
                style={{ width: `${(blockers.length / Math.max(total, 1)) * 100}%` }} />
            )}
            {atRiskCount > 0 && (
              <div onClick={() => toggleFilter("at_risk")} className="h-full bg-[#f59e0b] hover:opacity-80 transition-opacity" title="Click to filter at risk"
                style={{ width: `${(atRiskCount / Math.max(total, 1)) * 100}%` }} />
            )}
            {(loggedCount - blockers.length - atRiskCount) > 0 && (
              <div onClick={() => toggleFilter("logged")} className="h-full bg-[#00b894] hover:opacity-80 transition-opacity" title="Click to filter on track"
                style={{ width: `${((loggedCount - blockers.length - atRiskCount) / Math.max(total, 1)) * 100}%` }} />
            )}
          </div>
          <div className="flex items-center gap-5 mt-3 flex-wrap">
            {[
              { color: "bg-[#00b894]", label: "On Track", f: "logged" as FilterType },
              { color: "bg-[#f59e0b]", label: "At Risk", f: "at_risk" as FilterType },
              { color: "bg-[#ff4d00]", label: "Blocked", f: "blocked" as FilterType },
              { color: "bg-[#eaedff]", label: "Pending", f: "pending" as FilterType },
            ].map(({ color, label, f }) => (
              <button key={f} onClick={() => toggleFilter(f)}
                className={`flex items-center gap-1.5 hover:opacity-70 transition-opacity ${activeFilter === f ? "opacity-100 font-bold" : ""}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <span className="text-xs text-[#464553]">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Pending Approvals (Manager) ────────────── */}
        {pending.length > 0 && (
          <div className="bg-[#fff5f0] border border-[#ffc4a8] rounded-2xl p-5 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#ff4d00] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>person_alert</span>
              </div>
              <div>
                <p className="font-black text-[#341100] text-sm">{pending.length} employee{pending.length > 1 ? "s" : ""} waiting for approval</p>
                <p className="text-xs text-[#7c3300]">Approve them to give access and assign to your team</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {pending.map((u) => (
                <div key={u.id} className="bg-white rounded-xl p-3 flex items-center gap-3 border border-[#ffd5bc]">
                  <div className="w-9 h-9 rounded-full bg-[#1f108e] flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {u.name?.substring(0, 2).toUpperCase()}
                  </div>
                  <p className="flex-1 font-semibold text-[#131b2e] text-sm">{u.name}</p>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => approveEmployee(u.id)} disabled={loadingApproval === u.id}
                      className="bg-[#d4f5e9] text-[#006b5f] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#b0edd8] transition disabled:opacity-50">
                      Approve
                    </button>
                    <button onClick={() => rejectEmployee(u.id)} disabled={loadingApproval === u.id}
                      className="bg-[#f2f3ff] text-[#464553] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#eaedff] transition disabled:opacity-50">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Blockers Spotlight ─────────────────────── */}
        {blockers.length > 0 && (
          <div className="bg-[#fff5f0] border border-[#ffc4a8] rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-[#ff4d00] flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              </div>
              <div>
                <p className="font-black text-[#341100] text-base">
                  {blockers.length} {blockers.length === 1 ? "Person" : "People"} Blocked — Needs Attention
                </p>
                <p className="text-xs text-[#7c3300]">Click a card to see full details</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {blockers.map((emp) => (
                <button key={emp.id} onClick={() => { setSelected(emp); setRawExpanded(false); }}
                  className="bg-white rounded-xl p-4 flex items-start gap-4 border border-[#ffd5bc] hover:shadow-md hover:scale-[1.01] transition-all text-left w-full">
                  <div className="w-9 h-9 rounded-full bg-[#ff4d00] flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {emp.name?.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[#131b2e] text-sm">{emp.name}</p>
                    <p className="text-sm text-[#7c3300] mt-0.5">{emp.blocker}</p>
                  </div>
                  <span className="material-symbols-outlined text-[#ff4d00] text-[18px] shrink-0">chevron_right</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Team Cards ─────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
            {activeFilter === "all" ? "Team Summaries" : `Filtered: ${activeFilter.replace("_", " ")}`}
          </h3>
          <p className="text-xs text-[#464553]">
            {filtered.length} of {total} {activeFilter !== "all" && <button onClick={() => setActiveFilter("all")} className="underline ml-1 text-[#1f108e]">clear</button>}
          </p>
        </div>

        {total === 0 ? (
          <div className="bg-[#f2f3ff] p-14 rounded-2xl text-center border border-[#eaedff]">
            <span className="material-symbols-outlined text-5xl text-[#c8c4d5]">group_add</span>
            <p className="font-bold text-[#131b2e] text-lg mt-3">Your team is empty</p>
            <p className="text-[#464553] text-sm mt-1">
              Share the invite code <span className="font-mono font-bold text-[#1f108e]">{company.invite_code}</span> with your employees.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#f2f3ff] p-10 rounded-2xl text-center border border-[#eaedff]">
            <span className="material-symbols-outlined text-4xl text-[#c8c4d5]">filter_list_off</span>
            <p className="font-bold text-[#131b2e] text-lg mt-3">No employees match this filter</p>
            <button onClick={() => setActiveFilter("all")} className="text-[#1f108e] text-sm font-bold mt-2 underline">Clear filter</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
            {filtered.map((emp) => {
              const mood = MOOD_CONFIG[emp.mood] ?? MOOD_CONFIG.on_track;
              return (
                <button
                  key={emp.id}
                  onClick={() => { setSelected(emp); setRawExpanded(false); }}
                  className={`flex flex-col rounded-2xl overflow-hidden border-l-4 border border-[#eaedff] text-left w-full transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-pointer
                    ${emp.hasLogged ? mood.borderLeft + " bg-white shadow-sm" : "border-l-slate-200 bg-slate-50 opacity-60"}`}
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
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${mood.color}`}>{mood.label}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {emp.hasLogged && (
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${mood.bg} ${mood.color}`}>Logged</span>
                      )}
                      <span className="material-symbols-outlined text-[#c8c4d5] text-[18px]">chevron_right</span>
                    </div>
                  </div>

                  {/* Card Body */}
                  {emp.hasLogged ? (
                    <div className="p-4 flex flex-col gap-3 flex-grow">
                      <p className="text-sm text-[#131b2e] leading-relaxed font-medium line-clamp-2">
                        {emp.brief ?? "Summary generating…"}
                      </p>
                      {emp.tasks.length > 0 && (
                        <div className="bg-[#f8f9ff] rounded-xl p-3 border border-[#eaedff]">
                          <p className="text-[9px] font-black uppercase tracking-widest text-[#544fc0] mb-2">Completed</p>
                          <ul className="flex flex-col gap-1.5">
                            {emp.tasks.slice(0, 3).map((t, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-[#00b894] text-[14px] mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                <span className="text-xs text-[#464553] leading-snug">{t}</span>
                              </li>
                            ))}
                            {emp.tasks.length > 3 && (
                              <li className="text-xs text-[#9896b0] pl-5">+{emp.tasks.length - 3} more</li>
                            )}
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
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail Drawer ──────────────────────────────── */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${selected ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => { setSelected(null); setRawExpanded(false); }}
      />

      {/* Drawer panel */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${selected ? "translate-x-0" : "translate-x-full"}`}>
        {selected && (
          <>
            {/* Drawer Header */}
            <div className={`p-6 border-b flex items-center justify-between shrink-0 ${selected.blocker ? "bg-[#fff5f0] border-[#ffc4a8]" : "bg-white border-[#eaedff]"}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0 ${selected.blocker ? "bg-[#ff4d00]" : "bg-[#1f108e]"}`}>
                  {selected.name?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-black text-[#131b2e] text-lg">{selected.name}</p>
                  {selected.hasLogged ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className={`w-2 h-2 rounded-full ${MOOD_CONFIG[selected.mood].dot}`} />
                      <span className={`text-xs font-bold uppercase tracking-wider ${MOOD_CONFIG[selected.mood].color}`}>
                        {MOOD_CONFIG[selected.mood].label}
                      </span>
                      {selected.loggedAt && (
                        <span className="text-xs text-[#9896b0]">· {formatTime(selected.loggedAt)}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Has not logged today</span>
                  )}
                </div>
              </div>
              <button onClick={() => { setSelected(null); setRawExpanded(false); }}
                className="w-9 h-9 rounded-xl bg-[#f2f3ff] flex items-center justify-center hover:bg-[#e2e3ff] transition-colors shrink-0">
                <span className="material-symbols-outlined text-[#1f108e] text-[20px]">close</span>
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {!selected.hasLogged ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
                  <span className="material-symbols-outlined text-5xl text-[#c8c4d5]">schedule</span>
                  <p className="font-bold text-[#131b2e]">No log submitted yet</p>
                  <p className="text-sm text-[#464553]">{selected.name} hasn't submitted their daily log today.</p>
                </div>
              ) : (
                <>
                  {/* Blocker Banner */}
                  {selected.blocker && (
                    <div className="bg-[#fff5f0] border border-[#ffc4a8] rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-[#ff4d00] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                        <p className="font-black text-[#341100] text-sm uppercase tracking-wider">Blocked — Needs Action</p>
                      </div>
                      <p className="text-sm text-[#7c3300] leading-relaxed">{selected.blocker}</p>
                    </div>
                  )}

                  {/* Brief */}
                  <div className="bg-[#f2f3ff] rounded-2xl p-5 border border-[#eaedff]">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#544fc0] mb-3">AI Summary</p>
                    <p className="text-base text-[#131b2e] leading-relaxed font-medium">
                      {selected.brief ?? "Summary generating…"}
                    </p>
                  </div>

                  {/* Tasks */}
                  {selected.tasks.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#464553] mb-3">Completed Today</p>
                      <ul className="flex flex-col gap-2">
                        {selected.tasks.map((t, i) => (
                          <li key={i} className="flex items-start gap-3 bg-white border border-[#eaedff] rounded-xl p-3">
                            <span className="material-symbols-outlined text-[#00b894] text-[18px] mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                              check_circle
                            </span>
                            <span className="text-sm text-[#131b2e]">{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Raw input toggle */}
                  {selected.rawInput && (
                    <div>
                      <button
                        onClick={() => setRawExpanded((p) => !p)}
                        className="flex items-center gap-2 text-xs font-bold text-[#464553] uppercase tracking-widest hover:text-[#1f108e] transition-colors"
                      >
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
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

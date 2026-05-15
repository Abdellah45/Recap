"use client";

import { useState, useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
export type DailyTeamStat = {
  date: string;       // YYYY-MM-DD
  logged: number;     // how many logged that day
  total: number;      // team size
  hasBlocker: boolean;
};

export type EmployeeDayData = {
  date: string;
  logged: boolean;
  mood: "on_track" | "at_risk" | "blocked" | null;
  hasBlocker: boolean;
};

export type EmployeeHistoryRow = {
  id: string;
  name: string;
  dailyData: EmployeeDayData[];  // always 28 entries
};

// ── Score helpers ─────────────────────────────────────────────────────────────
function computeStats(slice: EmployeeDayData[]) {
  const total = slice.length;
  if (total === 0) return { consistency: 0, reliability: 0, blockerScore: 0, overall: 0 };

  const logged = slice.filter((d) => d.logged).length;
  const onTrack = slice.filter((d) => d.mood === "on_track").length;
  const blocked = slice.filter((d) => d.mood === "blocked").length;

  // Equal weight: 33.33 each
  const consistency = (logged / total) * 33.33;
  const reliability = logged > 0 ? (onTrack / logged) * 33.33 : 0;
  const blockerScore = logged > 0 ? ((logged - blocked) / logged) * 33.33 : 16.67;
  const overall = Math.round(consistency + reliability + blockerScore);

  return { consistency, reliability, blockerScore, overall };
}

function computeTrend(dailyData: EmployeeDayData[], period: number): "up" | "down" | "stable" {
  const slice = dailyData.slice(-period);
  const half = Math.floor(period / 2);
  if (half < 2) return "stable";

  const first = slice.slice(0, half);
  const second = slice.slice(half);

  const firstRate = first.filter((d) => d.logged).length / first.length;
  const secondRate = second.filter((d) => d.logged).length / second.length;

  if (secondRate > firstRate + 0.15) return "up";
  if (secondRate < firstRate - 0.15) return "down";
  return "stable";
}

function scoreLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: "Excellent", color: "text-[#006b5f]", bg: "bg-[#d4f5e9]" };
  if (score >= 75) return { label: "Performing", color: "text-[#1f108e]", bg: "bg-[#eef0ff]" };
  if (score >= 50) return { label: "Developing", color: "text-[#7c4f00]", bg: "bg-[#fff3d4]" };
  return { label: "Needs Attention", color: "text-[#7c1f00]", bg: "bg-[#ffdbca]" };
}

function scoreRingColor(score: number) {
  if (score >= 90) return "#00b894";
  if (score >= 75) return "#1f108e";
  if (score >= 50) return "#f59e0b";
  return "#ff4d00";
}

// ── Mini progress bar ─────────────────────────────────────────────────────────
function MiniBar({ value, max = 33.33, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-1.5 bg-[#f2f3ff] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

// ── SVG Bar Chart ─────────────────────────────────────────────────────────────
function TeamActivityChart({ teamSlice }: { teamSlice: DailyTeamStat[] }) {
  const [tooltip, setTooltip] = useState<{ i: number; x: number; y: number } | null>(null);

  const W = 600;
  const H = 90;
  const n = teamSlice.length;
  const gap = 3;
  const barW = (W / n) - gap;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(iso: string) {
    const d = new Date(iso);
    return `${d.getDate()} ${months[d.getMonth()]}`;
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full" style={{ overflow: "visible" }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <line key={r} x1={0} y1={H - H * r} x2={W} y2={H - H * r}
            stroke="#eaedff" strokeWidth="1" strokeDasharray="4 4" />
        ))}

        {/* Bars */}
        {teamSlice.map((day, i) => {
          const ratio = day.total > 0 ? day.logged / day.total : 0;
          const barH = Math.max(ratio * H, ratio > 0 ? 4 : 0);
          const x = i * (barW + gap);
          const y = H - barH;

          const fill = day.hasBlocker
            ? "#ff4d00"
            : ratio >= 0.7 ? "#00b894"
            : ratio >= 0.4 ? "#f59e0b"
            : ratio > 0 ? "#e0e7ff"
            : "#f2f3ff";

          // Show date label every 7th bar (or first/last)
          const showLabel = i === 0 || (i + 1) % 7 === 0 || i === n - 1;

          return (
            <g key={day.date}>
              <rect
                x={x} y={y} width={barW} height={barH}
                rx={3} fill={fill}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onMouseEnter={(e) => setTooltip({ i, x: x + barW / 2, y })}
                onMouseLeave={() => setTooltip(null)}
              />
              {showLabel && (
                <text x={x + barW / 2} y={H + 16} textAnchor="middle" fontSize="8" fill="#9896b0" fontWeight="500">
                  {fmtDate(day.date)}
                </text>
              )}
            </g>
          );
        })}

        {/* Tooltip */}
        {tooltip !== null && teamSlice[tooltip.i] && (() => {
          const day = teamSlice[tooltip.i];
          const ratio = day.total > 0 ? Math.round((day.logged / day.total) * 100) : 0;
          const txRaw = tooltip.x;
          const tx = Math.min(Math.max(txRaw, 50), W - 50);
          const ty = Math.max(tooltip.y - 10, 10);
          return (
            <g>
              <rect x={tx - 44} y={ty - 32} width={88} height={34} rx={6} fill="#1f108e" />
              <text x={tx} y={ty - 16} textAnchor="middle" fontSize="9" fill="white" fontWeight="700">
                {fmtDate(day.date)}
              </text>
              <text x={tx} y={ty - 5} textAnchor="middle" fontSize="8" fill="#c8c4d5">
                {day.logged}/{day.total} logged · {ratio}%{day.hasBlocker ? " 🚨" : ""}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap mt-1">
        {[
          { color: "#00b894", label: "≥70% logged" },
          { color: "#f59e0b", label: "40-69% logged" },
          { color: "#ff4d00", label: "Blocker day" },
          { color: "#f2f3ff", label: "No logs" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-[#9896b0]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Score Ring ─────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const R = 26;
  const C = 2 * Math.PI * R;
  const offset = C - (score / 100) * C;
  const color = scoreRingColor(score);
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
      <circle cx="32" cy="32" r={R} fill="none" stroke="#eaedff" strokeWidth="6" />
      <circle cx="32" cy="32" r={R} fill="none" stroke={color} strokeWidth="6"
        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
        transform="rotate(-90 32 32)" />
      <text x="32" y="37" textAnchor="middle" fontSize="13" fontWeight="800" fill="#131b2e">
        {score}
      </text>
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AnalyticsSection({
  teamDaily,
  employeeHistory,
}: {
  teamDaily: DailyTeamStat[];
  employeeHistory: EmployeeHistoryRow[];
}) {
  const [period, setPeriod] = useState<7 | 14 | 28>(28);

  const teamSlice = useMemo(() => teamDaily.slice(-period), [teamDaily, period]);

  const rankedEmployees = useMemo(() => {
    return employeeHistory
      .map((emp) => {
        const slice = emp.dailyData.slice(-period);
        const stats = computeStats(slice);
        const trend = computeTrend(emp.dailyData, period);
        return { ...emp, ...stats, trend };
      })
      .sort((a, b) => b.overall - a.overall);
  }, [employeeHistory, period]);

  const avgScore = rankedEmployees.length > 0
    ? Math.round(rankedEmployees.reduce((s, e) => s + e.overall, 0) / rankedEmployees.length)
    : 0;

  const hasAnyData = teamDaily.some((d) => d.logged > 0);

  return (
    <div className="w-full max-w-6xl mb-10">
      {/* ── Section Header ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-2xl font-extrabold text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
            Team Analytics
          </h3>
          <p className="text-sm text-[#464553] mt-0.5">
            Real performance data — scores update automatically as employees log work
          </p>
        </div>
        {/* Period selector */}
        <div className="flex bg-[#f2f3ff] p-1 rounded-xl border border-[#eaedff]">
          {([7, 14, 28] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                period === p
                  ? "bg-[#1f108e] text-white shadow-sm"
                  : "text-[#464553] hover:text-[#1f108e]"
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {!hasAnyData ? (
        <div className="bg-[#f2f3ff] rounded-2xl p-12 text-center border border-[#eaedff] mb-8">
          <span className="material-symbols-outlined text-5xl text-[#c8c4d5]">analytics</span>
          <p className="font-bold text-[#131b2e] text-lg mt-3">No data yet</p>
          <p className="text-sm text-[#464553] mt-1 max-w-sm mx-auto">
            Analytics will appear automatically as your employees submit their daily logs. Data builds over time.
          </p>
        </div>
      ) : (
        <>
          {/* ── Team Summary Row ───────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: "Avg. Team Score",
                value: `${avgScore}`,
                sub: "/100",
                icon: "military_tech",
                color: "text-[#1f108e]",
                bg: "bg-[#f2f3ff]",
              },
              {
                label: "Top Performer",
                value: rankedEmployees[0]?.name?.split(" ")[0] ?? "—",
                sub: `${rankedEmployees[0]?.overall ?? 0}pts`,
                icon: "star",
                color: "text-[#006b5f]",
                bg: "bg-[#d4f5e9]",
              },
              {
                label: "Needs Attention",
                value: `${rankedEmployees.filter((e) => e.overall < 50).length}`,
                sub: "employees",
                icon: "person_alert",
                color: "text-[#783200]",
                bg: "bg-[#ffdbca]",
              },
              {
                label: "Avg. Consistency",
                value: `${rankedEmployees.length > 0 ? Math.round(rankedEmployees.reduce((s, e) => s + (e.consistency / 33.33) * 100, 0) / rankedEmployees.length) : 0}%`,
                sub: "days logged",
                icon: "calendar_today",
                color: "text-[#7c4f00]",
                bg: "bg-[#fff3d4]",
              },
            ].map(({ label, value, sub, icon, color, bg }) => (
              <div key={label} className="bg-white rounded-2xl p-5 border border-[#eaedff]">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                  <span className={`material-symbols-outlined ${color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                </div>
                <p className="text-2xl font-black text-[#131b2e]">
                  {value}
                  <span className="text-sm font-semibold text-[#9896b0] ml-1">{sub}</span>
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#464553] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Team Activity Chart ────────────────────── */}
          <div className="bg-white rounded-2xl p-6 border border-[#eaedff] mb-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-bold text-[#131b2e]">Daily Submission Activity</p>
                <p className="text-xs text-[#464553] mt-0.5">
                  Team log submissions over the last {period} days — hover a bar for details
                </p>
              </div>
            </div>
            <TeamActivityChart teamSlice={teamSlice} />
          </div>

          {/* ── Employee Rankings ──────────────────────── */}
          <div className="bg-white rounded-2xl border border-[#eaedff] overflow-hidden">
            <div className="p-6 border-b border-[#f2f3ff]">
              <p className="font-bold text-[#131b2e]">Employee Performance Rankings</p>
              <p className="text-xs text-[#464553] mt-0.5">
                Score = equal weight of Consistency + Reliability + Blocker Rate · Last {period} days
              </p>
            </div>

            <div className="divide-y divide-[#f2f3ff]">
              {rankedEmployees.map((emp, rank) => {
                const sl = scoreLabel(emp.overall);
                const logsInPeriod = emp.dailyData.slice(-period).filter((d) => d.logged).length;
                const blockedDays = emp.dailyData.slice(-period).filter((d) => d.mood === "blocked").length;
                return (
                  <div key={emp.id} className="p-5 flex items-center gap-5 hover:bg-[#fafbff] transition-colors">
                    {/* Rank */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-black text-sm
                      ${rank === 0 ? "bg-[#ffd700] text-[#7c5a00]" : rank === 1 ? "bg-[#e0e7ef] text-[#464553]" : rank === 2 ? "bg-[#c97f4f] text-white" : "bg-[#f2f3ff] text-[#9896b0]"}`}>
                      {rank + 1}
                    </div>

                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-[#1f108e] flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {emp.name?.substring(0, 2).toUpperCase()}
                    </div>

                    {/* Name + bars */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-bold text-[#131b2e] text-sm truncate">{emp.name}</p>
                        {/* Trend */}
                        {emp.trend === "up" && <span className="text-[#00b894] text-xs font-bold">↑ Improving</span>}
                        {emp.trend === "down" && <span className="text-[#ff4d00] text-xs font-bold">↓ Declining</span>}
                        {emp.trend === "stable" && <span className="text-[#9896b0] text-xs">→ Stable</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-[9px] font-bold text-[#464553] uppercase tracking-wider">Consistency</span>
                            <span className="text-[9px] text-[#9896b0]">{logsInPeriod}/{period}d</span>
                          </div>
                          <MiniBar value={emp.consistency} color="#1f108e" />
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-[9px] font-bold text-[#464553] uppercase tracking-wider">Reliability</span>
                            <span className="text-[9px] text-[#9896b0]">{Math.round((emp.reliability / 33.33) * 100)}%</span>
                          </div>
                          <MiniBar value={emp.reliability} color="#00b894" />
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-[9px] font-bold text-[#464553] uppercase tracking-wider">Blocker-Free</span>
                            <span className="text-[9px] text-[#9896b0]">{blockedDays}x blocked</span>
                          </div>
                          <MiniBar value={emp.blockerScore} color="#f59e0b" />
                        </div>
                      </div>
                    </div>

                    {/* Score ring */}
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <ScoreRing score={emp.overall} />
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${sl.bg} ${sl.color}`}>
                        {sl.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

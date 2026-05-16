"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Profile = { id: string; full_name: string; role: string; status: string; team_id: string | null };
type Team = { id: string; name: string; created_at: string };

export default function TeamManagementClient({
  companyId,
  company,
  teams: initialTeams,
  pendingUsers: initialPending,
  activeUsers: initialActive,
}: {
  companyId: string;
  company: { name: string; employeeCode: string; managerCode: string };
  teams: Team[];
  pendingUsers: Profile[];
  activeUsers: Profile[];
}) {
  const supabase = createClient();
  const router = useRouter();

  const [teams, setTeams] = useState(initialTeams);
  const [pending, setPending] = useState(initialPending);
  const [active, setActive] = useState(initialActive);
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // ── Approve user ────────────────────────────────────────────────────────────
  async function approveUser(u: Profile) {
    setLoadingId(u.id);
    await supabase.from("profiles").update({ status: "active" }).eq("id", u.id);
    setPending((p) => p.filter((x) => x.id !== u.id));
    setActive((a) => [...a, { ...u, status: "active" }]);
    setLoadingId(null);
  }

  // ── Reject user ─────────────────────────────────────────────────────────────
  async function rejectUser(userId: string) {
    setLoadingId(userId);
    await supabase.from("profiles").update({ status: "rejected" }).eq("id", userId);
    setPending((p) => p.filter((x) => x.id !== userId));
    setLoadingId(null);
  }

  // ── Create team ─────────────────────────────────────────────────────────────
  async function createTeam() {
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    const { data: team } = await supabase
      .from("teams")
      .insert({ company_id: companyId, name: newTeamName.trim() })
      .select()
      .single();
    if (team) setTeams((t) => [...t, team]);
    setNewTeamName("");
    setCreatingTeam(false);
  }

  // ── Assign user to team ─────────────────────────────────────────────────────
  async function assignToTeam(userId: string, teamId: string | null) {
    setLoadingId(userId);
    await supabase.from("profiles").update({ team_id: teamId }).eq("id", userId);
    setActive((a) => a.map((u) => u.id === userId ? { ...u, team_id: teamId } : u));
    setLoadingId(null);
  }

  const unassigned = active.filter((u) => !u.team_id);

  return (
    <div className="w-full max-w-5xl">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
            Team Management
          </h2>
          <p className="text-[#464553] mt-2 font-medium">{company.name}</p>
        </div>
        {/* Invite codes */}
        <div className="flex flex-col gap-2 items-end">
          {[
            { label: "Employee Code", code: company.employeeCode, color: "text-[#1f108e] bg-[#f2f3ff] border-[#dde0ff]" },
            { label: "Manager Code", code: company.managerCode, color: "text-[#783200] bg-[#fff5f0] border-[#ffd5bc]" },
          ].map(({ label, code, color }) => (
            <div key={label} className="flex items-center gap-3">
              <p className="text-[9px] font-bold text-[#464553] uppercase tracking-widest">{label}</p>
              <button
                onClick={() => navigator.clipboard.writeText(code)}
                className={`font-mono tracking-widest font-black text-base px-4 py-1.5 rounded-xl border ${color} hover:opacity-80 transition`}
                title="Click to copy"
              >
                {code}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pending Approvals ──────────────────────────────────────────────── */}
      {pending.length > 0 && (
        <div className="bg-[#fff5f0] border border-[#ffc4a8] rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-[#ff4d00] flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>person_alert</span>
            </div>
            <div>
              <p className="font-black text-[#341100] text-base">{pending.length} Pending Approval{pending.length > 1 ? "s" : ""}</p>
              <p className="text-xs text-[#7c3300]">Review and approve new members requesting to join</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {pending.map((u) => (
              <div key={u.id} className="bg-white rounded-xl p-4 flex items-center gap-4 border border-[#ffd5bc]">
                <div className="w-10 h-10 rounded-full bg-[#1f108e] flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {u.full_name?.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[#131b2e] text-sm">{u.full_name}</p>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${u.role === "manager" ? "bg-[#fff3d4] text-[#7c4f00]" : "bg-[#f2f3ff] text-[#1f108e]"}`}>
                    Wants to join as {u.role}
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => approveUser(u)}
                    disabled={loadingId === u.id}
                    className="bg-[#d4f5e9] text-[#006b5f] text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#b0edd8] transition disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => rejectUser(u.id)}
                    disabled={loadingId === u.id}
                    className="bg-[#ffdbca] text-[#783200] text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#ffc4a8] transition disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create Team ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-6 border border-[#eaedff] mb-6">
        <p className="font-bold text-[#131b2e] mb-4">Create a New Team</p>
        <div className="flex gap-3">
          <input
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="e.g. Frontend, Backend, Design..."
            onKeyDown={(e) => e.key === "Enter" && createTeam()}
            className="flex-1 bg-[#f2f3ff] rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#544fc0] focus:ring-offset-2 transition"
          />
          <button
            onClick={createTeam}
            disabled={creatingTeam || !newTeamName.trim()}
            className="primary-gradient text-white px-6 py-3 rounded-xl font-bold text-sm hover:scale-[1.01] active:scale-95 transition-transform shadow-lg shadow-indigo-200 disabled:opacity-50"
          >
            + Create
          </button>
        </div>
      </div>

      {/* ── Teams Grid ────────────────────────────────────────────────────── */}
      {teams.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-[#131b2e] mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>Teams</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {teams.map((team) => {
              const members = active.filter((u) => u.team_id === team.id);
              const manager = members.find((u) => u.role === "manager" || u.role === "owner");
              const employees = members.filter((u) => u.role === "employee");
              return (
                <div key={team.id} className="bg-white rounded-2xl p-5 border border-[#eaedff]">
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-bold text-[#131b2e]">{team.name}</p>
                    <span className="text-[10px] font-bold text-[#464553] bg-[#f2f3ff] px-2 py-1 rounded-full">
                      {members.length} members
                    </span>
                  </div>
                  {manager ? (
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full bg-[#1f108e] flex items-center justify-center text-white font-bold text-[10px]">
                        {manager.full_name?.substring(0, 1).toUpperCase()}
                      </div>
                      <p className="text-xs text-[#464553]">{manager.full_name} <span className="text-[#9896b0]">(manager)</span></p>
                    </div>
                  ) : (
                    <p className="text-xs text-[#9896b0] italic mb-3">No manager assigned</p>
                  )}
                  {employees.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {employees.map((e) => (
                        <div key={e.id} className="bg-[#f2f3ff] rounded-lg px-2 py-1 text-xs text-[#464553] font-medium">
                          {e.full_name}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#9896b0] italic">No employees yet</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Unassigned Users ──────────────────────────────────────────────── */}
      {unassigned.length > 0 && teams.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#eaedff] overflow-hidden">
          <div className="p-5 border-b border-[#f2f3ff]">
            <p className="font-bold text-[#131b2e]">Unassigned Members</p>
            <p className="text-xs text-[#464553] mt-0.5">Assign these approved members to a team</p>
          </div>
          <div className="divide-y divide-[#f2f3ff]">
            {unassigned.map((u) => (
              <div key={u.id} className="p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-[#c8c4d5] flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {u.full_name?.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[#131b2e] text-sm">{u.full_name}</p>
                  <span className="text-[10px] font-bold text-[#464553] uppercase tracking-wider">{u.role}</span>
                </div>
                <select
                  onChange={(e) => assignToTeam(u.id, e.target.value || null)}
                  disabled={loadingId === u.id}
                  defaultValue=""
                  className="bg-[#f2f3ff] rounded-lg px-3 py-2 text-xs font-medium text-[#131b2e] outline-none border border-[#eaedff] focus:ring-2 focus:ring-[#544fc0] cursor-pointer"
                >
                  <option value="" disabled>Assign to team...</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {teams.length === 0 && unassigned.length > 0 && (
        <div className="bg-[#f2f3ff] p-8 rounded-2xl text-center border border-[#eaedff]">
          <span className="material-symbols-outlined text-4xl text-[#c8c4d5]">group_add</span>
          <p className="font-bold text-[#131b2e] mt-3">Create a team first</p>
          <p className="text-sm text-[#464553] mt-1">Then you can assign your {unassigned.length} approved member{unassigned.length > 1 ? "s" : ""} to teams.</p>
        </div>
      )}
    </div>
  );
}

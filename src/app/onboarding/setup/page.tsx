"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Path = "owner" | "manager" | "employee";

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function OnboardingSetupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [path, setPath] = useState<Path | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!path) return;
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Session expired. Please sign in again."); setLoading(false); return; }

    const fullName = user.user_metadata?.full_name ?? user.email ?? "User";

    // ── Owner: create company ──────────────────────────────────────────────
    if (path === "owner") {
      const employeeCode = generateCode();
      const managerCode = generateCode();

      const { data: company, error: cErr } = await supabase
        .from("companies")
        .insert({ name: companyName, employee_invite_code: employeeCode, manager_invite_code: managerCode, owner_id: user.id })
        .select()
        .single();

      if (cErr) { setError(cErr.message); setLoading(false); return; }

      const { error: pErr } = await supabase.from("profiles").insert({
        id: user.id, full_name: fullName, role: "owner",
        company_id: company.id, language: "en", status: "active",
      });

      if (pErr) { setError(pErr.message); setLoading(false); return; }
      router.push("/app"); router.refresh(); return;
    }

    // ── Manager: join via manager_invite_code ─────────────────────────────
    if (path === "manager") {
      const { data: company, error: cErr } = await supabase
        .from("companies")
        .select("id")
        .eq("manager_invite_code", code.toUpperCase().trim())
        .single();

      if (cErr || !company) { setError("Invalid manager code. Ask the company owner."); setLoading(false); return; }

      const { error: pErr } = await supabase.from("profiles").insert({
        id: user.id, full_name: fullName, role: "manager",
        company_id: company.id, language: "en", status: "pending",
      });

      if (pErr) { setError(pErr.message); setLoading(false); return; }
      router.push("/pending"); router.refresh(); return;
    }

    // ── Employee: join via employee_invite_code ────────────────────────────
    const { data: company, error: cErr } = await supabase
      .from("companies")
      .select("id")
      .eq("employee_invite_code", code.toUpperCase().trim())
      .single();

    if (cErr || !company) { setError("Invalid employee code. Ask your manager."); setLoading(false); return; }

    const { error: pErr } = await supabase.from("profiles").insert({
      id: user.id, full_name: fullName, role: "employee",
      company_id: company.id, language: "en", status: "pending",
    });

    if (pErr) { setError(pErr.message); setLoading(false); return; }
    router.push("/pending"); router.refresh();
  }

  const paths: { key: Path; icon: string; title: string; desc: string }[] = [
    { key: "owner", icon: "domain", title: "Create Company", desc: "Start a new workspace — you become the owner" },
    { key: "manager", icon: "supervisor_account", title: "Join as Manager", desc: "Enter a manager code to co-manage a team" },
    { key: "employee", icon: "person", title: "Join as Employee", desc: "Enter an employee code to join your team" },
  ];

  return (
    <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-[#1f108e] uppercase tracking-widest" style={{ fontFamily: "Manrope, sans-serif" }}>
            Recap
          </h1>
          <p className="text-[#464553] mt-2 text-sm font-medium">One last step — set up your workspace</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#eaedff]">
          {step === 1 ? (
            <>
              <h2 className="text-2xl font-bold text-[#131b2e] mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>
                Who are you?
              </h2>
              <p className="text-sm text-[#464553] mb-8">Choose your role to get started</p>

              <div className="flex flex-col gap-3 mb-8">
                {paths.map(({ key, icon, title, desc }) => (
                  <button
                    key={key}
                    onClick={() => setPath(key)}
                    className={`p-4 rounded-xl text-left border-2 transition-all flex items-center gap-4 ${
                      path === key ? "border-[#1f108e] bg-[#f2f3ff]" : "border-[#eaedff] hover:border-[#c3c0ff]"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${path === key ? "bg-[#1f108e]" : "bg-[#f2f3ff]"}`}>
                      <span className={`material-symbols-outlined text-[20px] ${path === key ? "text-white" : "text-[#1f108e]"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                        {icon}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-[#131b2e] text-sm">{title}</p>
                      <p className="text-xs text-[#464553] mt-0.5">{desc}</p>
                    </div>
                    {path === key && (
                      <span className="material-symbols-outlined text-[#1f108e] ml-auto shrink-0">check_circle</span>
                    )}
                  </button>
                ))}
              </div>

              <button
                disabled={!path}
                onClick={() => setStep(2)}
                className="w-full primary-gradient text-white py-3.5 rounded-xl font-bold text-sm tracking-wide hover:scale-[1.01] active:scale-95 transition-transform shadow-lg shadow-indigo-200 disabled:opacity-40"
              >
                Continue →
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-xs text-[#464553] mb-6 hover:text-[#1f108e] transition">
                <span className="material-symbols-outlined text-sm">arrow_back</span> Back
              </button>

              <h2 className="text-2xl font-bold text-[#131b2e] mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>
                {path === "owner" ? "Name your company" : path === "manager" ? "Enter manager code" : "Enter employee code"}
              </h2>
              <p className="text-sm text-[#464553] mb-8">
                {path === "owner"
                  ? "You'll get two invite codes — one for managers, one for employees"
                  : path === "manager"
                  ? "Ask the company owner for the manager invite code"
                  : "Ask your manager or company owner for the employee code"}
              </p>

              {error && (
                <div className="bg-[#ffdad6] text-[#93000a] text-sm px-4 py-3 rounded-lg mb-5">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {path === "owner" ? (
                  <div>
                    <label className="block text-xs font-semibold text-[#464553] uppercase tracking-wider mb-1.5">
                      Company Name
                    </label>
                    <input
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Argan Organic"
                      className="w-full bg-[#f2f3ff] rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#544fc0] focus:ring-offset-2 transition"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-[#464553] uppercase tracking-wider mb-1.5">
                      {path === "manager" ? "Manager Invite Code" : "Employee Invite Code"}
                    </label>
                    <input
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="ABC123"
                      className="w-full bg-[#f2f3ff] rounded-lg px-4 py-3 text-sm font-mono tracking-widest outline-none focus:ring-2 focus:ring-[#544fc0] focus:ring-offset-2 transition uppercase"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full primary-gradient text-white py-3.5 rounded-xl font-bold text-sm tracking-wide hover:scale-[1.01] active:scale-95 transition-transform shadow-lg shadow-indigo-200 disabled:opacity-60 mt-2"
                >
                  {loading ? "Setting up..." : path === "owner" ? "Launch my Workspace 🚀" : "Request to Join →"}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Escape hatch — user can always sign out */}
        <p className="text-center mt-6 text-xs text-[#9896b0]">
          Wrong account?{" "}
          <button
            onClick={handleSignOut}
            className="text-[#1f108e] font-bold hover:underline"
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}

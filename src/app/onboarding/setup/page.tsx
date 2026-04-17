"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Role = "employee" | "manager";

export default function OnboardingSetupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expired. Please sign in again.");
      setLoading(false);
      return;
    }

    let companyId: string | null = null;

    if (role === "manager") {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({ name: companyName, invite_code: code })
        .select()
        .single();
      if (companyError) {
        setError(companyError.message);
        setLoading(false);
        return;
      }
      companyId = company.id;
    } else {
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("id")
        .eq("invite_code", inviteCode.toUpperCase())
        .single();
      if (companyError || !company) {
        setError("Invalid invite code. Please check and try again.");
        setLoading(false);
        return;
      }
      companyId = company.id;
    }

    const fullName = user.user_metadata?.full_name ?? user.email ?? "User";
    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      full_name: fullName,
      role,
      company_id: companyId,
      language: "en",
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    router.push("/app/log");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1
            className="text-3xl font-black text-[#1f108e] uppercase tracking-widest"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Recap
          </h1>
          <p className="text-[#464553] mt-2 text-sm font-medium">
            One last step — set up your workspace
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 ambient-shadow">
          {step === 1 ? (
            <>
              <h2
                className="text-2xl font-bold text-[#131b2e] mb-1"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Who are you?
              </h2>
              <p className="text-sm text-[#464553] mb-8">
                Choose your role to get the right experience
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                {(["employee", "manager"] as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`p-6 rounded-xl text-left border-2 transition-all ${
                      role === r
                        ? "border-[#1f108e] bg-[#f2f3ff]"
                        : "border-[#eaedff] hover:border-[#c3c0ff]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[#1f108e] mb-3 block">
                      {r === "employee" ? "person" : "supervisor_account"}
                    </span>
                    <p className="font-bold text-[#131b2e] capitalize">{r}</p>
                    <p className="text-xs text-[#464553] mt-1">
                      {r === "employee"
                        ? "Log your daily work"
                        : "View team summaries"}
                    </p>
                  </button>
                ))}
              </div>

              <button
                disabled={!role}
                onClick={() => setStep(2)}
                className="w-full primary-gradient text-white py-3.5 rounded-xl font-bold text-sm tracking-wide hover:scale-[1.01] active:scale-95 transition-transform shadow-lg shadow-indigo-200 disabled:opacity-40"
              >
                Continue →
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-xs text-[#464553] mb-6 hover:text-[#1f108e] transition"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Back
              </button>

              <h2
                className="text-2xl font-bold text-[#131b2e] mb-1"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                {role === "manager" ? "Name your workspace" : "Join a workspace"}
              </h2>
              <p className="text-sm text-[#464553] mb-8">
                {role === "manager"
                  ? "You'll get an invite code to share with your team"
                  : "Ask your manager for the invite code"}
              </p>

              {error && (
                <div className="bg-[#ffdad6] text-[#93000a] text-sm px-4 py-3 rounded-lg mb-5">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {role === "manager" ? (
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
                      Invite Code
                    </label>
                    <input
                      required
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="e.g. ABC123"
                      className="w-full bg-[#f2f3ff] rounded-lg px-4 py-3 text-sm font-mono tracking-widest outline-none focus:ring-2 focus:ring-[#544fc0] focus:ring-offset-2 transition uppercase"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full primary-gradient text-white py-3.5 rounded-xl font-bold text-sm tracking-wide hover:scale-[1.01] active:scale-95 transition-transform shadow-lg shadow-indigo-200 disabled:opacity-60 mt-2"
                >
                  {loading ? "Setting up..." : "Launch my Workspace 🚀"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

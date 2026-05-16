"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PendingPage() {
  const router = useRouter();
  const supabase = createClient();

  async function checkStatus() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .single();

    if (profile?.status === "active") {
      router.push("/app");
      router.refresh();
    }
  }

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <h1
          className="text-3xl font-black text-[#1f108e] uppercase tracking-widest mb-10"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Recap
        </h1>

        <div className="bg-white rounded-2xl p-10 shadow-sm border border-[#eaedff]">
          {/* Animated waiting icon */}
          <div className="w-20 h-20 rounded-full bg-[#f2f3ff] flex items-center justify-center mx-auto mb-6">
            <span
              className="material-symbols-outlined text-[#1f108e] text-4xl"
              style={{ fontVariationSettings: "'FILL' 1", animation: "pulse 2s infinite" }}
            >
              hourglass_top
            </span>
          </div>

          <h2 className="text-2xl font-black text-[#131b2e] mb-3" style={{ fontFamily: "Manrope, sans-serif" }}>
            Pending Approval
          </h2>
          <p className="text-[#464553] text-sm leading-relaxed mb-8">
            Your account is waiting for approval from the company owner. 
            You'll get access once they review your request.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={checkStatus}
              className="w-full primary-gradient text-white py-3.5 rounded-xl font-bold text-sm tracking-wide hover:scale-[1.01] active:scale-95 transition-transform shadow-lg shadow-indigo-200"
            >
              Check my status
            </button>
            <button
              onClick={signOut}
              className="w-full py-3 rounded-xl font-medium text-sm text-[#464553] hover:bg-[#f2f3ff] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

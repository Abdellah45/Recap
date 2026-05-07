"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
        data: { full_name: fullName },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data.session) {
      // Instant login because email confirmations are disabled
      router.push("/onboarding/setup");
      router.refresh();
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-[#e2dfff] flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-[#1f108e] text-3xl">
              mark_email_read
            </span>
          </div>
          <h2
            className="text-2xl font-bold text-[#131b2e] mb-3"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Check your inbox
          </h2>
          <p className="text-[#464553] text-sm leading-relaxed">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-[#1f108e]">{email}</span>.
            <br />
            Click it to continue setting up your Recap workspace.
          </p>
          <p className="text-xs text-[#777584] mt-6">
            Didn&apos;t receive it? Check your spam folder.
          </p>
        </div>
      </div>
    );
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
            Create your account
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 ambient-shadow">
          <h2
            className="text-2xl font-bold text-[#131b2e] mb-1"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Get started
          </h2>
          <p className="text-sm text-[#464553] mb-8">
            You&apos;ll set up your role and workspace after confirming your email
          </p>

          {error && (
            <div className="bg-[#ffdad6] text-[#93000a] text-sm px-4 py-3 rounded-lg mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#464553] uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Abdellah Bahmani"
                className="w-full bg-[#f2f3ff] rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#544fc0] focus:ring-offset-2 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#464553] uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full bg-[#f2f3ff] rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#544fc0] focus:ring-offset-2 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#464553] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full bg-[#f2f3ff] rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#544fc0] focus:ring-offset-2 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full primary-gradient text-white py-3.5 rounded-xl font-bold text-sm tracking-wide hover:scale-[1.01] active:scale-95 transition-transform shadow-lg shadow-indigo-200 disabled:opacity-60 mt-2"
            >
              {loading ? "Sending confirmation..." : "Create Account →"}
            </button>
          </form>

          <p className="text-center text-xs text-[#464553] mt-6">
            Already have an account?{" "}
            <a href="/login" className="text-[#1f108e] font-semibold hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

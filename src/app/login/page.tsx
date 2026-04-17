"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/app/log");
      router.refresh();
    }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1
            className="text-3xl font-black text-[#1f108e] uppercase tracking-widest"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Recap
          </h1>
          <p className="text-[#464553] mt-2 text-sm font-medium">
            Log your day. Let AI do the rest.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-8 ambient-shadow">
          <h2
            className="text-2xl font-bold text-[#131b2e] mb-1"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Welcome back
          </h2>
          <p className="text-sm text-[#464553] mb-8">
            Sign in to your workspace
          </p>

          {error && (
            <div className="bg-[#ffdad6] text-[#93000a] text-sm px-4 py-3 rounded-lg mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
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
                className="w-full bg-[#f2f3ff] rounded-lg px-4 py-3 text-[#131b2e] placeholder:text-[#c8c4d5] text-sm outline-none focus:ring-2 focus:ring-[#544fc0] focus:ring-offset-2 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#464553] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#f2f3ff] rounded-lg px-4 py-3 text-[#131b2e] placeholder:text-[#c8c4d5] text-sm outline-none focus:ring-2 focus:ring-[#544fc0] focus:ring-offset-2 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full primary-gradient text-white py-3.5 rounded-xl font-bold text-sm tracking-wide hover:scale-[1.01] active:scale-95 transition-transform shadow-lg shadow-indigo-200 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#eaedff]" />
            <span className="text-xs text-[#c8c4d5] font-medium">or</span>
            <div className="flex-1 h-px bg-[#eaedff]" />
          </div>

          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border border-[#eaedff] rounded-xl py-3 text-sm font-semibold text-[#131b2e] hover:bg-[#f2f3ff] transition"
          >
            <svg className="w-5 h-5" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.86l6.1-6.1C34.46 3.19 29.53 1 24 1 14.82 1 6.97 6.48 3.26 14.26l7.16 5.56C12.06 13.09 17.56 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.52 24.5c0-1.56-.14-3.06-.4-4.5H24v8.52h12.65c-.55 2.94-2.2 5.43-4.67 7.1l7.16 5.56C43.19 37.17 46.52 31.29 46.52 24.5z"/>
              <path fill="#FBBC05" d="M10.42 28.18A14.55 14.55 0 0 1 9.5 24c0-1.45.2-2.86.56-4.18l-7.16-5.56A23.94 23.94 0 0 0 0 24c0 3.86.92 7.51 2.55 10.74l7.87-6.56z"/>
              <path fill="#34A853" d="M24 47c5.53 0 10.18-1.84 13.57-4.98l-7.16-5.56c-1.83 1.23-4.18 1.95-6.41 1.95-6.44 0-11.94-3.59-13.58-8.63l-7.87 6.56C6.97 41.52 14.82 47 24 47z"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-xs text-[#464553] mt-6">
            New to Recap?{" "}
            <a
              href="/onboarding"
              className="text-[#1f108e] font-semibold hover:underline"
            >
              Create an account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

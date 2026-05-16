"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const employeeLinks = [
  { href: "/app/log", label: "Daily Log", icon: "edit_note" },
  { href: "/app/history", label: "My History", icon: "history" },
  { href: "/app/settings", label: "Settings", icon: "settings" },
];

const managerLinks = [
  { href: "/app/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/app/my-team", label: "My Team", icon: "group" },
  { href: "/app/analytics", label: "Analytics", icon: "analytics" },
  { href: "/app/settings", label: "Settings", icon: "settings" },
];

const ownerLinks = [
  { href: "/app/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/app/team", label: "Team Management", icon: "group" },
  { href: "/app/analytics", label: "Analytics", icon: "analytics" },
  { href: "/app/settings", label: "Settings", icon: "settings" },
];

export default function Sidebar({
  fullName,
  role,
  initials,
  language,
  userId,
}: {
  fullName: string;
  role: string;
  initials: string;
  language: string;
  userId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [lang, setLang] = useState(language);

  async function toggleLanguage(newLang: "en" | "fr") {
    setLang(newLang);
    await supabase
      .from("profiles")
      .update({ language: newLang })
      .eq("id", userId);
  }

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex h-screen w-64 bg-slate-50 flex-col p-4 gap-2 fixed left-0 top-0 z-40">
        {/* Logo */}
        <div className="mb-8 px-4">
          <h1
            className="text-xl font-black text-[#1f108e] uppercase tracking-widest"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Recap
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1 capitalize">
            {role}
          </p>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col gap-1 flex-grow">
          {(role === "owner" ? ownerLinks : role === "manager" ? managerLinks : employeeLinks).map(({ href, label, icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`py-3 px-4 flex items-center gap-3 font-medium rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-white text-[#1f108e] shadow-sm"
                    : "text-slate-600 hover:translate-x-1 hover:bg-indigo-50"
                }`}
              >
                <span className="material-symbols-outlined">{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-slate-200/50">
          {/* User pill */}
          <div className="flex items-center gap-3 px-4 py-3 mb-1 rounded-xl bg-[#e2dfff]/30">
            <div className="w-8 h-8 rounded-full bg-[#3730a3] flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <div className="flex-grow overflow-hidden">
              <p className="text-xs font-bold text-[#1f108e] truncate">{fullName}</p>
              <p className="text-[10px] text-[#464553] capitalize">{role}</p>
            </div>
          </div>

          {/* Language toggle */}
          <div className="flex bg-slate-200/50 p-1 rounded-full mb-2 mx-1">
            {(["en", "fr"] as const).map((l) => (
              <button
                key={l}
                onClick={() => toggleLanguage(l)}
                className={`flex-1 text-[10px] font-bold py-1 px-2 rounded-full transition-all uppercase ${
                  lang === l
                    ? "bg-white text-[#1f108e] shadow-sm"
                    : "text-slate-500 hover:text-indigo-600"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <Link
            href="/app/help"
            className="text-slate-600 py-2 px-4 flex items-center gap-3 hover:bg-indigo-50 rounded-lg text-sm"
          >
            <span className="material-symbols-outlined text-base">help</span>
            Help
          </Link>
          <button
            onClick={handleSignOut}
            className="text-slate-600 py-2 px-4 flex items-center gap-3 hover:bg-red-50 hover:text-red-600 rounded-lg text-sm w-full text-left"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full glass-nav px-6 py-4 flex justify-between items-center z-50 border-t border-indigo-100">
        {(role === "owner" ? ownerLinks : role === "manager" ? managerLinks : employeeLinks).map(({ href, icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 ${
                isActive ? "text-[#1f108e]" : "text-slate-400"
              }`}
            >
              <span
                className="material-symbols-outlined"
                style={
                  isActive
                    ? { fontVariationSettings: "'FILL' 1" }
                    : undefined
                }
              >
                {icon}
              </span>
              <span className="text-[10px] font-bold">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

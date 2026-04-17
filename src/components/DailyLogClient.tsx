"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type RecentLog = {
  id: string;
  logged_at: string;
  ai_summary: string | null;
  blocker_note: string | null;
};

const TIPS = [
  { icon: "bug_report", text: "Include critical bugs fixed or PR reviews." },
  { icon: "groups", text: "Mention key client or stakeholder meetings." },
  { icon: "speed", text: "Mention blockers that impacted your velocity." },
  { icon: "architecture", text: "Reference specific tickets or design docs." },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function DailyLogClient({
  firstName,
  userId,
  recentLogs,
  language,
}: {
  firstName: string;
  userId: string;
  recentLogs: RecentLog[];
  language: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Load draft from localStorage
  useEffect(() => {
    const draft = localStorage.getItem(`recap-draft-${userId}`);
    if (draft) setText(draft);
  }, [userId]);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!text) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(`recap-draft-${userId}`, text);
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [text, userId]);

  async function handleProcessWithAI() {
    if (!text.trim()) return;
    setProcessing(true);
    try {
      // Save raw log to Supabase (AI stubbed for now — Week 3-4)
      const { data: log, error } = await supabase
        .from("daily_logs")
        .insert({
          user_id: userId,
          raw_input: text,
          ai_summary: null,
          blocker_note: null,
          logged_at: new Date().toISOString().split("T")[0],
        })
        .select()
        .single();

      if (error) throw error;

      // Clear draft
      localStorage.removeItem(`recap-draft-${userId}`);
      setText("");

      console.log("Log saved, AI processing coming in Week 3-4:", log);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="w-full max-w-4xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tighter text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Daily Log
          </h2>
          <p className="text-[#464553] mt-2 text-lg font-medium">{today}</p>
        </div>
        <div className="flex items-center gap-2 text-[#006b5f] font-semibold bg-[#6df5e1]/20 px-4 py-2 rounded-full">
          <span
            className="material-symbols-outlined text-lg"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            bolt
          </span>
          AI Analysis Ready
        </div>
      </div>

      <div className="space-y-8">
        {/* Main textarea */}
        <section className="bg-white rounded-xl p-1 shadow-sm">
          <div className="relative">
            <label className="sr-only" htmlFor="work-dump">
              Worklog input
            </label>
            <textarea
              id="work-dump"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full p-8 md:p-10 text-xl text-[#131b2e] placeholder:text-[#c8c4d5] border-none focus:outline-none focus:ring-0 bg-transparent resize-none leading-relaxed"
              placeholder={
                language === "fr"
                  ? "Sur quoi avez-vous travaillé aujourd'hui ? (Videz simplement ici, l'IA organisera)"
                  : `Hey ${firstName} 👋 What did you work on today? (Just dump it here, AI will organize it)`
              }
              rows={12}
            />
            <div className="absolute bottom-6 right-6 flex items-center gap-4">
              <span className="text-xs text-slate-400 font-medium">
                {saving ? "Saving..." : saved ? "✓ Saved" : "Auto-saving..."}
              </span>
              <button
                onClick={handleProcessWithAI}
                disabled={!text.trim() || processing}
                className="primary-gradient text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-indigo-200 disabled:opacity-40"
              >
                {processing ? "Processing..." : "Process with AI"}
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  auto_awesome
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Bento cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pro tips */}
          <div className="md:col-span-2 bg-[#f2f3ff] p-8 rounded-xl relative overflow-hidden group">
            <div className="relative z-10">
              <h4 className="text-sm font-bold uppercase tracking-widest text-[#1f108e] mb-4">
                Pro-Tips
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {TIPS.map(({ icon, text: tip }) => (
                  <div key={icon} className="flex gap-3">
                    <span className="material-symbols-outlined text-[#c3c0ff]">
                      {icon}
                    </span>
                    <p className="text-sm text-[#464553]">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -right-12 -bottom-12 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-700">
              <span className="material-symbols-outlined text-[12rem]">
                lightbulb
              </span>
            </div>
          </div>

          {/* Weekly goal placeholder */}
          <div className="bg-[#ffdbca] p-8 rounded-xl flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-widest text-[#341100] mb-2">
                Weekly Goal
              </h4>
              <p className="text-[#341100] font-medium">
                Finish MVP for the demo presentation.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-2xl font-bold text-[#341100]">40%</span>
              <div className="w-24 h-1.5 bg-[#341100]/20 rounded-full overflow-hidden">
                <div className="h-full bg-[#341100] w-[40%]" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent logs */}
        <div className="pt-4">
          <div className="flex items-center justify-between mb-6">
            <h3
              className="text-xl font-bold"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Last 3 Days
            </h3>
            <a
              href="/app/history"
              className="text-sm font-bold text-[#1f108e] flex items-center gap-1 hover:underline"
            >
              View Full History
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
            </a>
          </div>

          {recentLogs.length === 0 ? (
            <div className="tonal-nesting p-8 rounded-xl text-center text-[#464553]">
              <span className="material-symbols-outlined text-3xl text-[#c8c4d5] block mb-2">
                edit_note
              </span>
              <p className="text-sm">No logs yet. Write your first one above!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="tonal-nesting p-6 rounded-xl flex items-center justify-between hover:bg-[#e2e7ff] transition-colors cursor-pointer"
                >
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-[#1f108e] shadow-sm">
                      <span
                        className="material-symbols-outlined"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {log.blocker_note ? "warning" : "check_circle"}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold">{formatDate(log.logged_at)}</p>
                      <p className="text-sm text-[#464553]">
                        {log.ai_summary
                          ? log.ai_summary.slice(0, 60) + "..."
                          : "Raw log saved — AI summary coming soon"}
                        {log.blocker_note && (
                          <span className="ml-2 inline-block bg-[#ffdbca] text-[#783200] text-xs px-2 py-0.5 rounded-full font-semibold">
                            Blocker
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#777584]">
                    chevron_right
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

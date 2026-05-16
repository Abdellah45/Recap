"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type RecentLog = {
  id: string;
  logged_at: string;
  ai_summary: string | null;
  blocker_note: string | null;
};

type AIState =
  | { stage: "idle" }
  | { stage: "processing" }
  | { stage: "followup"; log_id: string; tasks: string[]; question: string }
  | { stage: "answering" }
  | { stage: "done"; summary: string; has_blocker: boolean; blocker_text: string | null };

// ── i18n ──────────────────────────────────────────────────────────────────────
const STRINGS = {
  en: {
    title: "Daily Log",
    aiReady: "AI Ready",
    placeholder: (name: string) => `Hey ${name} 👋  What did you work on today? Just dump it here.`,
    autosave: "Autosave",
    saving: "Saving...",
    saved: "✓ Saved",
    processBtn: "Process with AI",
    processing: "Analyzing...",
    tasksFound: "Tasks identified",
    answerPlaceholder: "Your answer...",
    back: "← Start over",
    generateBtn: "Generate Summary",
    generating: "Generating...",
    successTitle: "Log saved!",
    successDesc: "Your manager can now see today's summary",
    aiSummary: "AI Summary",
    blockerDetected: "Blocker Detected",
    addAnother: "Submit another log",
    recentTitle: "Recent Logs",
    viewAll: "View full history",
    noLogs: "No logs yet. Write your first one above!",
    yourTeam: "Your Team",
    noTeam: "Not assigned to a team yet",
    manager: "Manager",
    noManager: "No manager assigned",
  },
  fr: {
    title: "Journal Quotidien",
    aiReady: "IA Prête",
    placeholder: (name: string) => `Salut ${name} 👋  Sur quoi avez-vous travaillé aujourd'hui ?`,
    autosave: "Auto-sauvegarde",
    saving: "Sauvegarde...",
    saved: "✓ Sauvegardé",
    processBtn: "Traiter avec l'IA",
    processing: "Analyse en cours...",
    tasksFound: "Tâches identifiées",
    answerPlaceholder: "Votre réponse...",
    back: "← Recommencer",
    generateBtn: "Générer le résumé",
    generating: "Génération...",
    successTitle: "Journal enregistré !",
    successDesc: "Votre manager peut voir votre résumé du jour",
    aiSummary: "Résumé IA",
    blockerDetected: "Blocage détecté",
    addAnother: "Ajouter un autre journal",
    recentTitle: "Journaux récents",
    viewAll: "Voir l'historique complet",
    noLogs: "Pas encore de journaux. Écrivez le vôtre ci-dessus !",
    yourTeam: "Votre équipe",
    noTeam: "Pas encore affecté à une équipe",
    manager: "Manager",
    noManager: "Aucun manager assigné",
  },
};

function formatDate(dateStr: string, lang: string) {
  return new Date(dateStr).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

export default function DailyLogClient({
  firstName,
  userId,
  recentLogs,
  language,
  teamName,
  managerName,
}: {
  firstName: string;
  userId: string;
  recentLogs: RecentLog[];
  language: string;
  teamName: string | null;
  managerName: string | null;
}) {
  const supabase = createClient();
  const lang = language === "fr" ? "fr" : "en";
  const s = STRINGS[lang];

  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiState, setAiState] = useState<AIState>({ stage: "idle" });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  // Load draft from localStorage
  useEffect(() => {
    const draft = localStorage.getItem(`recap-draft-${userId}`);
    if (draft) setText(draft);
  }, [userId]);

  // Auto-save draft
  useEffect(() => {
    if (!text || aiState.stage !== "idle") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(`recap-draft-${userId}`, text);
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 1200);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [text, userId, aiState.stage]);

  // ── Step 1: Save raw log + call Prompt 1 ──────────────────────────────────
  async function handleProcessWithAI() {
    if (!text.trim()) return;
    setAiState({ stage: "processing" });

    const { data: log, error: logError } = await supabase
      .from("daily_logs")
      .insert({ user_id: userId, raw_input: text, logged_at: new Date().toISOString().split("T")[0] })
      .select()
      .single();

    if (logError || !log) { setAiState({ stage: "idle" }); return; }

    const res = await fetch("/api/ai/process-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_input: text }),
    });

    if (!res.ok) { setAiState({ stage: "idle" }); return; }

    const { tasks_identified, followup_question } = await res.json();
    localStorage.removeItem(`recap-draft-${userId}`);
    setAiState({ stage: "followup", log_id: log.id, tasks: tasks_identified ?? [], question: followup_question });
  }

  // ── Step 2: Submit answer + call Prompt 2 ────────────────────────────────
  async function handleSubmitAnswer() {
    if (aiState.stage !== "followup" || !answer.trim()) return;
    const { log_id, question } = aiState;
    setAiState({ stage: "answering" });

    const res = await fetch("/api/ai/generate-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_input: text, followup_question: question, user_answer: answer, log_id }),
    });

    if (!res.ok) { setAiState({ stage: "idle" }); return; }

    const { summary, has_blocker, blocker_text } = await res.json();
    setAiState({ stage: "done", summary, has_blocker, blocker_text });
    setText(""); setAnswer("");
  }

  function handleReset() {
    setAiState({ stage: "idle" });
    setText(""); setAnswer("");
  }

  const isProcessing = aiState.stage === "processing" || aiState.stage === "answering";

  return (
    <div className="w-full max-w-3xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}>
            {s.title}
          </h2>
          <p className="text-[#464553] mt-2 font-medium capitalize">{today}</p>
        </div>
        <div className="flex items-center gap-2 text-[#006b5f] font-semibold bg-[#d4f5e9] px-4 py-2 rounded-full text-sm shrink-0">
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
          {s.aiReady}
        </div>
      </div>

      {/* ── Team info card ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#eaedff] p-4 mb-8 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#f2f3ff] flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[#1f108e]" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-bold text-[#9896b0] uppercase tracking-widest mb-0.5">{s.yourTeam}</p>
          {teamName ? (
            <p className="font-bold text-[#131b2e] truncate">{teamName}</p>
          ) : (
            <p className="text-sm text-[#9896b0] italic">{s.noTeam}</p>
          )}
        </div>
        {teamName && (
          <div className="flex items-center gap-2 shrink-0 pl-4 border-l border-[#f2f3ff]">
            <div className="w-7 h-7 rounded-full bg-[#1f108e] flex items-center justify-center text-white font-bold text-[10px] shrink-0">
              {managerName ? managerName.substring(0, 2).toUpperCase() : "?"}
            </div>
            <div>
              <p className="text-[9px] font-bold text-[#9896b0] uppercase tracking-widest">{s.manager}</p>
              <p className="text-xs font-semibold text-[#131b2e]">{managerName ?? s.noManager}</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* ── SCREEN 1 — Text input ─────────────────────────────────────── */}
        {(aiState.stage === "idle" || aiState.stage === "processing") && (
          <section className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#eaedff]">
            <textarea
              id="work-dump"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isProcessing}
              className="w-full p-8 text-lg text-[#131b2e] placeholder:text-[#c8c4d5] border-none focus:outline-none focus:ring-0 bg-transparent resize-none leading-relaxed disabled:opacity-60"
              placeholder={s.placeholder(firstName)}
              rows={10}
            />
            <div className="px-8 pb-6 flex items-center justify-between border-t border-[#f2f3ff]">
              <span className="text-xs text-slate-400 font-medium">
                {isProcessing ? s.processing : saving ? s.saving : saved ? s.saved : s.autosave}
              </span>
              <button
                onClick={handleProcessWithAI}
                disabled={!text.trim() || isProcessing}
                className="primary-gradient text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-indigo-200 disabled:opacity-40"
              >
                {isProcessing ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-base">progress_activity</span>
                    {s.processing}
                  </>
                ) : (
                  <>
                    {s.processBtn}
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {/* ── SCREEN 2 — AI Follow-up ───────────────────────────────────── */}
        {(aiState.stage === "followup" || aiState.stage === "answering") && (
          <section className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#eaedff]">
            {/* Tasks */}
            <div className="px-8 pt-8 pb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#544fc0] mb-3">{s.tasksFound}</p>
              <div className="flex flex-wrap gap-2">
                {aiState.stage === "followup" && aiState.tasks.map((t, i) => (
                  <span key={i} className="bg-[#f2f3ff] text-[#1f108e] text-sm font-medium px-3 py-1 rounded-full">{t}</span>
                ))}
              </div>
            </div>

            {/* AI question */}
            <div className="px-8 py-5 bg-[#f2f3ff] mx-8 rounded-xl mb-6">
              <div className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-full primary-gradient flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                </div>
                <p className="text-[#131b2e] font-semibold text-base leading-relaxed">
                  {aiState.stage === "followup" ? aiState.question : "..."}
                </p>
              </div>
            </div>

            {/* Answer */}
            <div className="px-8 pb-8">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={aiState.stage === "answering"}
                placeholder={s.answerPlaceholder}
                rows={4}
                className="w-full bg-[#faf8ff] rounded-xl px-5 py-4 text-[#131b2e] placeholder:text-[#c8c4d5] focus:outline-none focus:ring-2 focus:ring-[#544fc0] resize-none text-base leading-relaxed disabled:opacity-60"
              />
              <div className="flex justify-between items-center mt-4">
                <button onClick={handleReset} className="text-sm text-[#464553] hover:text-[#1f108e] transition-colors">
                  {s.back}
                </button>
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!answer.trim() || aiState.stage === "answering"}
                  className="primary-gradient text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-indigo-200 disabled:opacity-40"
                >
                  {aiState.stage === "answering" ? (
                    <>
                      <span className="animate-spin material-symbols-outlined text-base">progress_activity</span>
                      {s.generating}
                    </>
                  ) : (
                    <>
                      {s.generateBtn}
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── SCREEN 3 — Done! ──────────────────────────────────────────── */}
        {aiState.stage === "done" && (
          <section className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#eaedff]">
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-[#d4f5e9] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#006b5f]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                </div>
                <div>
                  <p className="font-bold text-[#131b2e]">{s.successTitle}</p>
                  <p className="text-xs text-[#464553]">{s.successDesc}</p>
                </div>
              </div>

              <div className="bg-[#f2f3ff] rounded-xl p-6 mb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-[#544fc0] mb-3">{s.aiSummary}</p>
                <p className="text-[#131b2e] leading-relaxed">{aiState.summary}</p>
              </div>

              {aiState.has_blocker && aiState.blocker_text && (
                <div className="bg-[#ffdbca] rounded-xl p-4 flex gap-3 items-start mb-4">
                  <span className="material-symbols-outlined text-[#783200]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                  <div>
                    <p className="text-xs font-bold text-[#783200] uppercase tracking-wider mb-1">{s.blockerDetected}</p>
                    <p className="text-sm text-[#341100]">{aiState.blocker_text}</p>
                  </div>
                </div>
              )}

              <button onClick={handleReset}
                className="w-full mt-2 border-2 border-[#eaedff] text-[#1f108e] font-bold py-3 rounded-xl hover:bg-[#f2f3ff] transition-colors">
                {s.addAnother}
              </button>
            </div>
          </section>
        )}

        {/* ── Recent logs ───────────────────────────────────────────────── */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-bold text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
              {s.recentTitle}
            </h3>
            <a href="/app/history" className="text-sm font-bold text-[#1f108e] flex items-center gap-1 hover:underline">
              {s.viewAll}
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </a>
          </div>

          {recentLogs.length === 0 ? (
            <div className="bg-[#f2f3ff] p-8 rounded-2xl text-center text-[#464553] border border-[#eaedff]">
              <span className="material-symbols-outlined text-3xl text-[#c8c4d5] block mb-2">edit_note</span>
              <p className="text-sm">{s.noLogs}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {recentLogs.map((log) => (
                <a key={log.id} href="/app/history"
                  className="bg-white rounded-2xl p-5 flex items-center gap-4 border border-[#eaedff] hover:shadow-md hover:scale-[1.005] transition-all">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${log.blocker_note ? "bg-[#ffdbca]" : "bg-[#d4f5e9]"}`}>
                    <span className={`material-symbols-outlined text-xl ${log.blocker_note ? "text-[#783200]" : "text-[#006b5f]"}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}>
                      {log.blocker_note ? "warning" : "check_circle"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#131b2e] capitalize text-sm">{formatDate(log.logged_at, lang)}</p>
                    <p className="text-xs text-[#464553] truncate mt-0.5">
                      {log.ai_summary ? log.ai_summary.slice(0, 80) + "…" : "Log saved"}
                    </p>
                  </div>
                  {log.blocker_note && (
                    <span className="bg-[#ffdbca] text-[#783200] text-[10px] font-bold px-2 py-1 rounded-full shrink-0 uppercase tracking-wider">
                      Blocker
                    </span>
                  )}
                  <span className="material-symbols-outlined text-[#c8c4d5] shrink-0">chevron_right</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

type AIState =
  | { stage: "idle" }
  | { stage: "processing" }
  | {
      stage: "followup";
      log_id: string;
      tasks: string[];
      question: string;
    }
  | { stage: "answering" }
  | {
      stage: "done";
      summary: string;
      has_blocker: boolean;
      blocker_text: string | null;
    };

const TIPS = [
  { icon: "bug_report", text: "Mentionnez les bugs critiques résolus ou les PR reviewées." },
  { icon: "groups", text: "Signalez les réunions importantes avec clients ou équipes." },
  { icon: "speed", text: "Indiquez les blocages qui ont impacté votre vélocité." },
  { icon: "architecture", text: "Référencez les tickets spécifiques ou docs de design." },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
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
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiState, setAiState] = useState<AIState>({ stage: "idle" });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    month: "long",
    day: "numeric",
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
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [text, userId, aiState.stage]);

  // ── Step 1: Save raw log + call Prompt 1 ──
  async function handleProcessWithAI() {
    if (!text.trim()) return;
    setAiState({ stage: "processing" });

    // Save raw input to Supabase first
    const { data: log, error: logError } = await supabase
      .from("daily_logs")
      .insert({
        user_id: userId,
        raw_input: text,
        logged_at: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (logError || !log) {
      console.error(logError);
      setAiState({ stage: "idle" });
      return;
    }

    // Call Prompt 1
    const res = await fetch("/api/ai/process-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_input: text }),
    });

    if (!res.ok) {
      console.error("process-log failed");
      setAiState({ stage: "idle" });
      return;
    }

    const { tasks_identified, followup_question } = await res.json();

    localStorage.removeItem(`recap-draft-${userId}`);
    setAiState({
      stage: "followup",
      log_id: log.id,
      tasks: tasks_identified ?? [],
      question: followup_question,
    });
  }

  // ── Step 2: Submit answer + call Prompt 2 ──
  async function handleSubmitAnswer() {
    if (aiState.stage !== "followup" || !answer.trim()) return;
    const { log_id, question } = aiState;
    setAiState({ stage: "answering" });

    const res = await fetch("/api/ai/generate-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raw_input: text,
        followup_question: question,
        user_answer: answer,
        log_id,
      }),
    });

    if (!res.ok) {
      console.error("generate-summary failed");
      setAiState({ stage: "idle" });
      return;
    }

    const { summary, has_blocker, blocker_text } = await res.json();
    setAiState({ stage: "done", summary, has_blocker, blocker_text });
    setText("");
    setAnswer("");
    router.refresh();
  }

  function handleReset() {
    setAiState({ stage: "idle" });
    setText("");
    setAnswer("");
  }

  const isProcessing =
    aiState.stage === "processing" || aiState.stage === "answering";

  return (
    <div className="w-full max-w-4xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tighter text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Journal Quotidien
          </h2>
          <p className="text-[#464553] mt-2 text-lg font-medium capitalize">
            {today}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[#006b5f] font-semibold bg-[#6df5e1]/20 px-4 py-2 rounded-full">
          <span
            className="material-symbols-outlined text-lg"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            bolt
          </span>
          Analyse IA Prête
        </div>
      </div>

      <div className="space-y-8">
        {/* ── SCREEN 1 — Text input ── */}
        {(aiState.stage === "idle" || aiState.stage === "processing") && (
          <section className="bg-white rounded-xl shadow-sm overflow-hidden">
            <textarea
              id="work-dump"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isProcessing}
              className="w-full p-8 md:p-10 text-xl text-[#131b2e] placeholder:text-[#c8c4d5] border-none focus:outline-none focus:ring-0 bg-transparent resize-none leading-relaxed disabled:opacity-60"
              placeholder={
                language === "fr"
                  ? `Salut ${firstName} 👋 Sur quoi avez-vous travaillé aujourd'hui ?`
                  : `Hey ${firstName} 👋 What did you work on today? (Just dump it here)`
              }
              rows={12}
            />
            <div className="px-8 pb-6 flex items-center justify-between border-t border-[#f2f3ff]">
              <span className="text-xs text-slate-400 font-medium">
                {isProcessing
                  ? "Analyse en cours..."
                  : saving
                  ? "Sauvegarde..."
                  : saved
                  ? "✓ Sauvegardé"
                  : "Auto-sauvegarde"}
              </span>
              <button
                onClick={handleProcessWithAI}
                disabled={!text.trim() || isProcessing}
                className="primary-gradient text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-indigo-200 disabled:opacity-40"
              >
                {isProcessing ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-base">
                      progress_activity
                    </span>
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    Traiter avec l&apos;IA
                    <span
                      className="material-symbols-outlined"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      auto_awesome
                    </span>
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {/* ── SCREEN 2 — AI Follow-up question ── */}
        {(aiState.stage === "followup" || aiState.stage === "answering") && (
          <section className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Tasks identified */}
            <div className="px-8 pt-8 pb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#544fc0] mb-3">
                Tâches identifiées
              </p>
              <div className="flex flex-wrap gap-2">
                {aiState.stage === "followup" &&
                  aiState.tasks.map((t, i) => (
                    <span
                      key={i}
                      className="bg-[#f2f3ff] text-[#1f108e] text-sm font-medium px-3 py-1 rounded-full"
                    >
                      {t}
                    </span>
                  ))}
              </div>
            </div>

            {/* Follow-up question */}
            <div className="px-8 py-6 bg-[#f2f3ff] mx-8 rounded-xl mb-6">
              <div className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-full primary-gradient flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span
                    className="material-symbols-outlined text-white text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    smart_toy
                  </span>
                </div>
                <p className="text-[#131b2e] font-semibold text-base leading-relaxed">
                  {aiState.stage === "followup" ? aiState.question : "..."}
                </p>
              </div>
            </div>

            {/* Answer input */}
            <div className="px-8 pb-8">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={aiState.stage === "answering"}
                placeholder="Votre réponse..."
                rows={4}
                className="w-full bg-[#faf8ff] rounded-xl px-5 py-4 text-[#131b2e] placeholder:text-[#c8c4d5] focus:outline-none focus:ring-2 focus:ring-[#544fc0] resize-none text-base leading-relaxed disabled:opacity-60"
              />
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={handleReset}
                  className="text-sm text-[#464553] hover:text-[#1f108e] transition-colors"
                >
                  ← Recommencer
                </button>
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!answer.trim() || aiState.stage === "answering"}
                  className="primary-gradient text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-indigo-200 disabled:opacity-40"
                >
                  {aiState.stage === "answering" ? (
                    <>
                      <span className="animate-spin material-symbols-outlined text-base">
                        progress_activity
                      </span>
                      Génération...
                    </>
                  ) : (
                    <>
                      Générer le résumé
                      <span
                        className="material-symbols-outlined"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        send
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── SCREEN 3 — Done! Summary ── */}
        {aiState.stage === "done" && (
          <section className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-[#d4f5e9] flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-[#006b5f]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                </div>
                <div>
                  <p className="font-bold text-[#131b2e]">
                    Journal enregistré et résumé généré !
                  </p>
                  <p className="text-xs text-[#464553]">
                    Votre manager peut maintenant voir votre résumé du jour
                  </p>
                </div>
              </div>

              <div className="bg-[#faf8ff] rounded-xl p-6 mb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-[#544fc0] mb-3">
                  Résumé IA
                </p>
                <p className="text-[#131b2e] leading-relaxed">
                  {aiState.summary}
                </p>
              </div>

              {aiState.has_blocker && aiState.blocker_text && (
                <div className="bg-[#ffdbca] rounded-xl p-4 flex gap-3 items-start mb-4">
                  <span
                    className="material-symbols-outlined text-[#783200]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    warning
                  </span>
                  <div>
                    <p className="text-xs font-bold text-[#783200] uppercase tracking-wider mb-1">
                      Blocage détecté
                    </p>
                    <p className="text-sm text-[#341100]">
                      {aiState.blocker_text}
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={handleReset}
                className="w-full mt-2 border-2 border-[#eaedff] text-[#1f108e] font-bold py-3 rounded-xl hover:bg-[#f2f3ff] transition-colors"
              >
                Ajouter un autre journal
              </button>
            </div>
          </section>
        )}

        {/* Bento cards — shown only on idle */}
        {aiState.stage === "idle" && (
          <div className="bg-[#f2f3ff] p-8 rounded-xl relative overflow-hidden group">
            <div className="relative z-10">
              <h4 className="text-sm font-bold uppercase tracking-widest text-[#1f108e] mb-4">
                Conseils
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {TIPS.map(({ icon, text: tip }) => (
                  <div key={icon} className="flex flex-col gap-2 bg-white/50 p-4 rounded-xl border border-white">
                    <span className="material-symbols-outlined text-[#1f108e]">
                      {icon}
                    </span>
                    <p className="text-sm text-[#464553] font-medium leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -right-12 -bottom-12 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-700 pointer-events-none">
              <span className="material-symbols-outlined text-[16rem]">
                lightbulb
              </span>
            </div>
          </div>
        )}

        {/* Recent logs */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-6">
            <h3
              className="text-xl font-bold"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              3 Derniers Jours
            </h3>
            <a
              href="/app/history"
              className="text-sm font-bold text-[#1f108e] flex items-center gap-1 hover:underline"
            >
              Voir l&apos;historique complet
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
            </a>
          </div>

          {recentLogs.length === 0 ? (
            <div className="bg-[#f2f3ff] p-8 rounded-xl text-center text-[#464553]">
              <span className="material-symbols-outlined text-3xl text-[#c8c4d5] block mb-2">
                edit_note
              </span>
              <p className="text-sm">
                Pas encore de journaux. Écrivez le vôtre ci-dessus !
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-[#f2f3ff] p-6 rounded-xl flex items-center justify-between hover:bg-[#e2e7ff] transition-colors cursor-pointer"
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
                      <p className="font-bold capitalize">
                        {formatDate(log.logged_at)}
                      </p>
                      <p className="text-sm text-[#464553]">
                        {log.ai_summary
                          ? log.ai_summary.slice(0, 70) + "..."
                          : "Texte brut sauvegardé — résumé IA généré"}
                        {log.blocker_note && (
                          <span className="ml-2 inline-block bg-[#ffdbca] text-[#783200] text-xs px-2 py-0.5 rounded-full font-semibold">
                            Blocage
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

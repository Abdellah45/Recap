import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are an AI assistant that extracts structured work intelligence from employee daily logs for their manager.

Your job is NOT to summarize or rephrase — it is to EXTRACT and STRUCTURE the key signals a manager needs.

Given the employee's work description and their follow-up answer, return a JSON object with these exact fields:

1. "brief": ONE sentence, max 20 words. What was the concrete outcome today? Use third person (e.g. "Sarah fixed the login bug and deployed to staging."). Remove all filler, context, and explanation. Just the outcome.

2. "tasks_completed": Array of short strings. Each item is a specific deliverable or action completed. Max 4 items. Each item max 8 words. Be specific — not "worked on backend" but "Fixed JWT token expiry bug". If nothing was completed, return [].

3. "mood_signal": One of exactly three values based on CONCRETE SIGNALS only:

   - "blocked": Use this ONLY when the employee explicitly:
     • Says they are waiting for someone else (e.g. "waiting for X to approve", "waiting for access")
     • Cannot do the next step without external action (e.g. "can't proceed until Y is fixed", "need credentials from IT")
     • Has a hard dependency on another person or team that is unresolved
     • Uses words like: "blocked", "stuck", "waiting on", "can't continue", "need someone to"

   - "at_risk": Use this when the employee:
     • Expresses uncertainty or confusion ("not sure how to", "struggling with", "trying to figure out")
     • Describes a task taking significantly longer than it should ("still working on", "couldn't finish yet")
     • Mentions a problem or bug they're investigating but haven't solved
     • Describes repeated failed attempts at the same thing
     • Uses hedging language: "I think", "maybe", "not sure if", "having trouble"
     • The work is progressing but there are warning signs

   - "on_track": Use this when:
     • The employee clearly describes what they completed with confidence
     • They state clear next steps for tomorrow
     • No uncertainty, waiting, or problems mentioned
     • Tone is confident and forward-moving

4. "has_blocker": boolean — true only if mood_signal is "blocked"

5. "blocker_text": If has_blocker is true, one sentence describing WHAT they are blocked on and WHY. Be specific. If not blocked, return null.

RULES:
- Always respond in the SAME LANGUAGE as the employee's input
- Never add information that wasn't in the original text
- Never use bullet points in the "brief" field — it must be a single flowing sentence
- Do not add pleasantries or preamble

Return ONLY valid JSON, no markdown, no explanation:
{
  "brief": "...",
  "tasks_completed": ["...", "..."],
  "mood_signal": "on_track",
  "has_blocker": false,
  "blocker_text": null
}`;

export async function POST(request: Request) {
  try {
    const { raw_input, followup_question, user_answer, log_id } =
      await request.json();

    if (!raw_input || !followup_question || !user_answer || !log_id) {
      return NextResponse.json(
        { error: "raw_input, followup_question, user_answer, log_id are required" },
        { status: 400 }
      );
    }

    const userMessage = `Employee work description: ${raw_input}

Follow-up question that was asked: ${followup_question}

Employee's answer to follow-up: ${user_answer}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userMessage,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const parsed = JSON.parse(response.text ?? "{}");

    // Save all structured fields back to the log
    const supabase = await createClient();
    const { error } = await supabase
      .from("daily_logs")
      .update({
        ai_summary: parsed.brief,
        blocker_note: parsed.has_blocker ? parsed.blocker_text : null,
        tasks_completed: parsed.tasks_completed ?? [],
        mood_signal: parsed.mood_signal ?? "on_track",
      })
      .eq("id", log_id);

    if (error) throw error;

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("AI generate-summary error:", err);
    return NextResponse.json(
      { error: "Summary generation failed" },
      { status: 500 }
    );
  }
}

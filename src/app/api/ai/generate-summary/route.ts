import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You generate daily work summaries for managers.

Given:
- Employee's raw work description
- Follow-up question that was asked
- Employee's answer to that question

Generate a clean 2-3 sentence summary in plain language.

Rules:
- Write as if briefing a manager who has 10 seconds to read it
- Use third person: "Sarah completed..." not "I completed..."
- Always respond in the SAME LANGUAGE as the employee's input
- If there is a blocker, start the last sentence with "BLOCKER:"
- Never use bullet points, write in flowing sentences
- Keep it under 60 words

Return JSON only:
{
  "summary": "Clean 2-3 sentence summary here",
  "has_blocker": true,
  "blocker_text": "Description if has_blocker is true, else null"
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

    const userMessage = `Work description: ${raw_input}

Follow-up question asked: ${followup_question}

Employee's answer: ${user_answer}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userMessage,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const parsed = JSON.parse(response.text ?? "{}");

    // Save summary + blocker back to the log
    const supabase = await createClient();
    const { error } = await supabase
      .from("daily_logs")
      .update({
        ai_summary: parsed.summary,
        blocker_note: parsed.has_blocker ? parsed.blocker_text : null,
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

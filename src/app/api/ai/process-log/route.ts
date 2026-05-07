import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are a work assistant that helps employees log their daily work.
Your job is to:
1. Read the employee's free-text work description
2. Identify the 2 most important tasks they mentioned
3. Generate ONE single smart follow-up question that covers those tasks

Rules:
- Ask only ONE question, never multiple
- Be conversational and friendly, not formal
- Keep the question under 20 words
- Always respond in the SAME LANGUAGE the employee wrote in
- If they wrote in French, respond in French
- Focus on: was it completed? any blockers? what was the outcome?

Return JSON only:
{
  "tasks_identified": ["task1", "task2"],
  "followup_question": "Your single smart question here"
}`;

export async function POST(request: Request) {
  try {
    const { raw_input } = await request.json();

    if (!raw_input?.trim()) {
      return NextResponse.json(
        { error: "raw_input is required" },
        { status: 400 }
      );
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: raw_input,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    });

    const parsed = JSON.parse(response.text ?? "{}");
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("AI process-log error:", err);
    return NextResponse.json(
      { error: "AI processing failed" },
      { status: 500 }
    );
  }
}

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// gemini-2.0-flash-lite: lightest model, most generous free quota
const MODEL = "gemini-2.0-flash-lite";
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

    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
      },
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent(raw_input);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("AI process-log error:", err);
    return NextResponse.json(
      { error: "AI processing failed" },
      { status: 500 }
    );
  }
}

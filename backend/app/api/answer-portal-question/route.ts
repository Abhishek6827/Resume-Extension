import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { answerPortalQuestion } from "../../../lib/application-outreach";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const {
      question,
      resumeData,
      resumeText,
      jdData,
      rawJdText,
      coverLetter,
      skillBank,
      modelSelection,
      candidateName,
    } = await request.json();

    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Please provide a valid question to answer." },
        { status: 400, headers: corsHeaders }
      );
    }

    const resumeInput = resumeText || resumeData || "";
    const jdInput = jdData || rawJdText || "";

    const answer = await answerPortalQuestion({
      question: question.trim(),
      resume: resumeInput,
      jd: jdInput,
      coverLetter,
      skillBank,
      modelSelection,
      candidateName,
    });

    return NextResponse.json({ success: true, answer }, { headers: corsHeaders });
  } catch (err: unknown) {
    console.error("[answer-portal-question] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { generateCoverLetter } from "../../../lib/cover-letter";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const { resumeData, resumeText, jdData, rawJdText, modelSelection, candidateName } = await request.json();

    const resumeInput = resumeText || resumeData;
    const jdInput = jdData || rawJdText;

    if (!resumeInput || !jdInput) {
      return NextResponse.json(
        { error: "Missing resume or job description" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Call LLM for cover letter
    const content = await generateCoverLetter(resumeInput, jdInput, modelSelection, candidateName);

    return NextResponse.json({ content }, { headers: corsHeaders });
  } catch (err: unknown) {
    console.error("[generate-cover-letter] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}

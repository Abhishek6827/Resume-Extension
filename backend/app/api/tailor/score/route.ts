import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../../lib/cors";
import { scoreResumeWithAI } from "../../../../lib/ai-tailor";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Shorter duration since this is fast

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const { resumeData, jdData } = await request.json();

    if (!resumeData || !jdData) {
      return NextResponse.json(
        { error: "Missing resumeData or jdData" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Call LLM score
    const result = await scoreResumeWithAI(resumeData, jdData);

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (err: unknown) {
    console.error("[tailor/score] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}

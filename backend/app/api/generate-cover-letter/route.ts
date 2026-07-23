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
    const { resumeData, jdData, modelSelection } = await request.json();

    if (!resumeData || !jdData) {
      return NextResponse.json(
        { error: "Missing resumeData or jdData" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Call LLM for cover letter
    const content = await generateCoverLetter(resumeData, jdData, modelSelection);

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

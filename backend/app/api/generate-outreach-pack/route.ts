import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { generateOutreachPack } from "../../../lib/application-outreach";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const {
      resumeData,
      resumeText,
      jdData,
      rawJdText,
      coverLetter,
      modelSelection,
      candidateName,
    } = await request.json();

    const resumeInput = resumeText || resumeData || "";
    const jdInput = jdData || rawJdText || "";

    if (!jdInput && !coverLetter && !resumeInput) {
      return NextResponse.json(
        { error: "Missing context: please provide a job description or cover letter." },
        { status: 400, headers: corsHeaders }
      );
    }

    const outreach = await generateOutreachPack({
      resume: resumeInput,
      jd: jdInput,
      coverLetter,
      modelSelection,
      candidateName,
    });

    return NextResponse.json({ success: true, outreach }, { headers: corsHeaders });
  } catch (err: unknown) {
    console.error("[generate-outreach-pack] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}


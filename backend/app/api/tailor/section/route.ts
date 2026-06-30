import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../../lib/cors";
import {
  tailorSummaryWithAI,
  tailorExperienceWithAI,
  tailorProjectsWithAI,
  tailorSkillsWithAI,
} from "../../../../lib/ai-tailor";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60s for LLM processing

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const { section, sectionData, jdData } = await request.json();

    if (!section || !sectionData || !jdData) {
      return NextResponse.json(
        { error: "Missing section, sectionData, or jdData" },
        { status: 400, headers: corsHeaders }
      );
    }

    let result;
    switch (section) {
      case "summary":
        result = await tailorSummaryWithAI(sectionData, jdData);
        break;
      case "experience":
        result = await tailorExperienceWithAI(sectionData, jdData);
        break;
      case "projects":
        result = await tailorProjectsWithAI(sectionData, jdData);
        break;
      case "skills":
        result = await tailorSkillsWithAI(sectionData, jdData);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown section: ${section}` },
          { status: 400, headers: corsHeaders }
        );
    }

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (err: unknown) {
    console.error(`[tailor/section] Error:`, err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}

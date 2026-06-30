import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { parseResumeFile } from "../../../lib/resume-parser";
import { parseResumeWithAI } from "../../../lib/ai-tailor";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds on Vercel for LLM processing

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const contentType = request.headers.get("content-type") || "";
    let rawText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400, headers: corsHeaders }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      rawText = await parseResumeFile(buffer, file.name, file.type);
    } else {
      // Expect JSON with pasted text
      const body = await request.json();
      rawText = body.text || "";
    }

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "No resume text found" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Call LLM parser
    const structuredResume = await parseResumeWithAI(rawText);

    return NextResponse.json(structuredResume, { headers: corsHeaders });
  } catch (err: unknown) {
    console.error("[parse-resume] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}

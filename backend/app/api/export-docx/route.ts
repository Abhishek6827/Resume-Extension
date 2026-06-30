import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { generateDOCX } from "../../../lib/docx-generator";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const resumeData = await request.json();

    if (!resumeData) {
      return NextResponse.json(
        { error: "Missing resume data" },
        { status: 400, headers: corsHeaders }
      );
    }

    const docxBuffer = await generateDOCX(resumeData);

    const headers = new Headers(corsHeaders);
    headers.set(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    headers.set("Content-Disposition", 'attachment; filename="resume.docx"');

    return new Response(new Uint8Array(docxBuffer), {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    console.error("[export-docx] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}

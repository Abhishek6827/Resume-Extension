import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { generatePDF } from "../../../lib/pdf-generator";

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

    const pdfBuffer = await generatePDF(resumeData);

    // Merge CORS headers with Content-Type and Content-Disposition headers
    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", 'attachment; filename="resume.pdf"');

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    console.error("[export-pdf] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}

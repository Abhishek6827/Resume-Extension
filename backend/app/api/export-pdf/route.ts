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
    const body = await request.json();

    if (!body) {
      return NextResponse.json(
        { error: "Missing request body" },
        { status: 400, headers: corsHeaders }
      );
    }

    // We now just generate a fresh ATS-friendly PDF using the latest resumeData.
    // This perfectly supports live-updates on approval since it just rebuilds the PDF.
    const resumeData = body.resumeData;
    if (!resumeData) {
      return NextResponse.json(
        { error: "No resumeData provided." },
        { status: 400, headers: corsHeaders }
      );
    }

    let pdfBuffer: Buffer;
    try {
      console.log(`[export-pdf] Generating fresh PDF from updated resumeData`);
      pdfBuffer = await generatePDF(resumeData);
      console.log("[export-pdf] PDF generation successful");
    } catch (err) {
      console.error("[export-pdf] PDF generation failed:", err);
      throw err;
    }

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

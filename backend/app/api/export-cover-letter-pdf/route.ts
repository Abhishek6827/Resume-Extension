import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { generateCoverLetterPDF } from "../../../lib/cover-letter-pdf";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const { content, candidateName, downloadName } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "Missing cover letter content" },
        { status: 400, headers: corsHeaders }
      );
    }

    const pdfBuffer = await generateCoverLetterPDF(content, candidateName);
    const filename = downloadName || "Cover_Letter.pdf";

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    console.error("[export-cover-letter-pdf] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}

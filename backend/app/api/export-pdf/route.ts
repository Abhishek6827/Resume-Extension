import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { generatePDF } from "../../../lib/pdf-generator";
import { modifyOriginalPDF } from "../../../lib/pdf-modifier";

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

    let pdfBuffer: Buffer | Uint8Array;

    // If original PDF is provided, modify it directly to preserve formatting
    if (body.originalPdfBase64 && body.changes && body.changes.length > 0) {
      // Extract the base64 data (remove data:application/pdf;base64, prefix if present)
      const base64Data = body.originalPdfBase64.replace(
        /^data:[^;]+;base64,/,
        ""
      );
      const originalBytes = new Uint8Array(
        Buffer.from(base64Data, "base64")
      );

      // Filter to only approved changes
      const approvedChanges = body.changes
        .filter((c: any) => c.status === "approved")
        .map((c: any) => ({
          originalValue: c.originalValue,
          newValue: c.newValue,
        }));

      if (approvedChanges.length > 0) {
        pdfBuffer = await modifyOriginalPDF(originalBytes, approvedChanges);
      } else {
        // No approved changes — return original PDF as-is
        pdfBuffer = Buffer.from(base64Data, "base64");
      }
    } else if (body.originalPdfBase64 && (!body.changes || body.changes.length === 0)) {
      // No changes at all — return original PDF as-is
      const base64Data = body.originalPdfBase64.replace(
        /^data:[^;]+;base64,/,
        ""
      );
      pdfBuffer = Buffer.from(base64Data, "base64");
    } else {
      // Fallback: generate new PDF from structured resume data
      const resumeData = body.resumeData || body;
      pdfBuffer = await generatePDF(resumeData);
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

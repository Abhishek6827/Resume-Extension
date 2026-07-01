import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
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

    // Extract the original PDF base64
    const originalBase64 = body.originalPdfBase64;
    if (!originalBase64) {
      return NextResponse.json(
        { error: "No original PDF provided. Upload a PDF first." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Strip data URL prefix if present
    const base64Data = originalBase64.replace(/^data:[^;]+;base64,/, "");
    const originalBytes = Buffer.from(base64Data, "base64");

    // Get approved changes
    const changes = (body.changes || [])
      .filter((c: any) => c.status === "approved")
      .map((c: any) => ({
        originalValue: c.originalValue,
        newValue: c.newValue,
      }));

    let pdfBuffer: Buffer | Uint8Array;

    if (changes.length > 0) {
      try {
        // Modify the original PDF with approved changes
        console.log(`[export-pdf] Modifying original PDF with ${changes.length} approved changes`);
        pdfBuffer = await modifyOriginalPDF(new Uint8Array(originalBytes), changes);
        console.log("[export-pdf] PDF modification successful");
      } catch (modifyErr) {
        // If modification fails, return original PDF as-is
        console.error("[export-pdf] PDF modification failed, returning original:", modifyErr);
        pdfBuffer = originalBytes;
      }
    } else {
      // No approved changes — return original PDF as-is
      console.log("[export-pdf] No approved changes, returning original PDF");
      pdfBuffer = originalBytes;
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

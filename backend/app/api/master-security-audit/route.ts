import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { runMasterSecurityAudit } from "../../../lib/master-security";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const {
      resumeText,
      coverLetter,
      outreachPack,
      jdText,
      skillBank,
      modelSelection,
    } = await request.json();

    if (!resumeText && !coverLetter && !outreachPack) {
      return NextResponse.json(
        { error: "Missing required assets for master security audit." },
        { status: 400, headers: corsHeaders }
      );
    }

    const report = await runMasterSecurityAudit({
      resumeText: resumeText || "",
      coverLetter: coverLetter || "",
      outreachPack: outreachPack || {
        email: { subject: "", body: "" },
        linkedinConnectionNote: "",
        whatsappMessage: "",
        contactFormNote: "",
      },
      jdText: jdText || "",
      skillBank,
      modelSelection,
    });

    return NextResponse.json({ success: true, report }, { headers: corsHeaders });
  } catch (err: unknown) {
    console.error("[master-security-audit] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}


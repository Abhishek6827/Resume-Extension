import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../../lib/cors";
import { scanGithubProfile } from "../../../../lib/github-scanner";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const body = await request.json();
    const { token, username } = body;

    if (!token && (!username || !username.trim())) {
      return NextResponse.json(
        { error: "Please provide either a GitHub Personal Access Token or a GitHub Username." },
        { status: 400, headers: corsHeaders }
      );
    }

    const skillBank = await scanGithubProfile({ token, username });

    return NextResponse.json(
      { success: true, skillBank },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[github/scan] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to scan GitHub profile" },
      { status: 500, headers: corsHeaders }
    );
  }
}

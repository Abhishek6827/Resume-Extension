import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { scrapeJobDescription } from "../../../lib/url-scraper";
import { parseJDWithAI } from "../../../lib/ai-tailor";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const { text, url } = await request.json();
    let rawText = text || "";

    if (url) {
      console.log(`[parse-jd] Scraping job description from: ${url}`);
      rawText = await scrapeJobDescription(url);
    }

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "No job description text or URL provided" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Call LLM parser
    const structuredJD = await parseJDWithAI(rawText);

    return NextResponse.json(structuredJD, { headers: corsHeaders });
  } catch (err: unknown) {
    console.error("[parse-jd] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}

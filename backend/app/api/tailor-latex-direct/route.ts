import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { callLLM } from "../../../lib/llm-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const body = await request.json();
    const { latex, jdData, modelSelection } = body;

    if (!latex || !latex.trim()) {
      return NextResponse.json({ error: "Missing LaTeX input" }, { status: 400, headers: corsHeaders });
    }
    if (!jdData) {
      return NextResponse.json({ error: "Missing JD data" }, { status: 400, headers: corsHeaders });
    }

    const latexLength = latex.length;

    const systemPrompt = `You are an expert ATS specialist and LaTeX editor. 
Your task is to take a raw LaTeX resume and rewrite its Professional Summary and Work Experience / Project bullet points to perfectly align with the target Job Description.

CRITICAL INSTRUCTIONS:
1. DO NOT CHANGE ANY LaTeX COMMANDS. Leave ALL macros, brackets, formatting (e.g. \\textbf, \\item, \\begin, \\end, \\vspace, \\hspace, \\href) exactly as they are.
2. MAXIMIZE ATS SCORE: Aggressively inject the exact keywords, tools, and methodologies from the Job Description into the plain text prose of the summary and bullet points. Ensure NO critical JD requirement is missed if it can be reasonably mapped to the candidate's existing experience.
3. Rewrite the bullet points to highlight outcomes and responsibilities that perfectly mirror the JD's core needs. Do not invent fake experience, but heavily reframe the existing experience to sound like the ideal candidate.
4. DO NOT add or remove bullet points. Keep the exact same number of items.
4. **STRICT LENGTH CONSTRAINT**: The original LaTeX string has EXACTLY ${latexLength} characters. You must output the ENTIRE tailored LaTeX string such that its total character count is less than or equal to ${latexLength}. This is a hard requirement to ensure the generated PDF does not exceed 1 page or create a bottom gap. Do not make any section significantly longer than before.
5. Return ONLY the raw tailored LaTeX string. Do NOT wrap it in markdown code blocks (\`\`\`latex ... \`\`\`). Do NOT include any explanations or prose before or after. Start immediately with the first LaTeX character and end with the last LaTeX character.`;

    const userMessage = `Job Description:
${JSON.stringify(jdData, null, 2)}

Original LaTeX (Length: ${latexLength} characters):
${latex}`;

    let tailoredLatex = "";
    let attempt = 0;
    const maxAttempts = 3;
    let currentSystemPrompt = systemPrompt;

    while (attempt < maxAttempts) {
      const response = await callLLM({
        systemPrompt: currentSystemPrompt,
        userMessage,
        modelSelection,
        jsonMode: false,
      });

      tailoredLatex = response.content;
      
      // Clean up if the model wrapped it in markdown fences anyway
      if (tailoredLatex.startsWith("```latex\n")) {
        tailoredLatex = tailoredLatex.substring(9);
      } else if (tailoredLatex.startsWith("```latex")) {
        tailoredLatex = tailoredLatex.substring(8);
      } else if (tailoredLatex.startsWith("```\n")) {
        tailoredLatex = tailoredLatex.substring(4);
      } else if (tailoredLatex.startsWith("```")) {
        tailoredLatex = tailoredLatex.substring(3);
      }
      
      if (tailoredLatex.endsWith("\n```")) {
        tailoredLatex = tailoredLatex.substring(0, tailoredLatex.length - 4);
      } else if (tailoredLatex.endsWith("```")) {
        tailoredLatex = tailoredLatex.substring(0, tailoredLatex.length - 3);
      }
      tailoredLatex = tailoredLatex.trim();

      // Sanitize common problematic Unicode characters that pdflatex chokes on
      tailoredLatex = tailoredLatex
        .replace(/\u202F/g, ' ') // Narrow No-Break Space
        .replace(/\u200B/g, '')  // Zero Width Space
        .replace(/\u2011/g, '-') // Non-Breaking Hyphen
        .replace(/\u2013/g, '--') // En Dash
        .replace(/\u2014/g, '---') // Em Dash
        .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
        .replace(/[\u201C\u201D]/g, '"'); // Smart double quotes

      if (tailoredLatex.length <= latexLength) {
        break;
      }
      
      console.warn(`[Tailor LaTeX] Attempt ${attempt + 1} failed length check (${tailoredLatex.length} > ${latexLength}). Retrying...`);
      currentSystemPrompt = systemPrompt + `\n\nWARNING: Your previous response was ${tailoredLatex.length} characters long, which EXCEEDS the absolute maximum limit of ${latexLength} characters. You MUST shorten your response by at least ${tailoredLatex.length - latexLength} characters. Be extremely concise.`;
      attempt++;
    }

    if (tailoredLatex.length > latexLength) {
      throw new Error(`AI failed to adhere to length constraints after ${maxAttempts} attempts (${tailoredLatex.length} > ${latexLength}). Please try again with a different model or shorten your JD.`);
    }

    return NextResponse.json(
      { 
        latex: tailoredLatex,
        originalLength: latexLength,
        generatedLength: tailoredLatex.length
      },
      { headers: corsHeaders }
    );
  } catch (err: unknown) {
    console.error("[tailor-latex-direct] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}

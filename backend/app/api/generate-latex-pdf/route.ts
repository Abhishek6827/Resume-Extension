import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { generateLatex } from "../../../lib/latex-generator";
import type { ResumeData } from "../../../lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for external compilation

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

function sanitizeLatex(raw: string): string {
  let cleaned = raw.trim();

  const codeBlockMatch = cleaned.match(/```(?:latex|tex)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    cleaned = cleaned.replace(/^```(?:latex|tex)?/i, '').replace(/```$/, '').trim();
  }

  const docClassMatch = cleaned.match(/\\documentclass\s*(?:\[[^\]]*\])?\s*\{[^}]+\}/i);
  if (docClassMatch && docClassMatch.index !== undefined && docClassMatch.index > 0) {
    cleaned = cleaned.substring(docClassMatch.index).trim();
  }

  const endDocIndex = cleaned.lastIndexOf('\\end{document}');
  if (endDocIndex !== -1) {
    cleaned = cleaned.substring(0, endDocIndex + 14).trim();
  }

  cleaned = cleaned
    .replace(/\\newcommand\{\\section\}/g, '\\renewcommand{\\section}')
    .replace(/\\newcommand\{\\subsection\}/g, '\\renewcommand{\\subsection}')
    .replace(/\\newcommand\{\\subsubsection\}/g, '\\renewcommand{\\subsubsection}')
    .replace(/\\newcommand\{\\item\}/g, '\\renewcommand{\\item}')
    .replace(/\\to\b/g, 'to')
    .replace(/\\rightarrow\b/g, 'to')
    .replace(/¡/g, 'under ')
    .replace(/<(?=\s*\d|\s*min|\s*ms|\s*\$)/gi, 'under ')
    .replace(/>(?=\s*\d|\s*min|\s*ms|\s*\$)/gi, 'over ')
    .replace(/(\d+)\s*%(?!\w)/g, '$1\\%');

  if (!cleaned.includes("microtype") && cleaned.includes("\\documentclass")) {
    cleaned = cleaned.replace(
      /(\\documentclass(?:\[[^\]]*\])?\{[^}]+\})/,
      "$1\n\\usepackage{microtype}"
    );
  }

  cleaned = cleaned
    .replace(/^\s*%.*$/gm, "")
    .replace(/\n\s*\n+(\\begin\{itemize\})/g, '\n$1')
    .replace(/(\\begin\{itemize\})\n\s*\n+/g, '$1\n')
    .replace(/(\\item[^\n]*)\n\s*\n+(\s*\\item)/g, '$1\n$2')
    .replace(/\n\s*\n+(\\end\{itemize\})/g, '\n$1')
    .replace(/(\\end\{itemize\})\n\s*\n+/g, '$1\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}

function applySqueezeLevel(latex: string, level: number): string {
  let result = latex;

  if (level === 1) {
    // Level 1: Moderate vertical enlargement & itemize spacing squeeze
    if (!result.includes("\\enlargethispage") && result.includes("\\begin{document}")) {
      result = result.replace(/(\\begin\{document\})/, "$1\n\\enlargethispage{3.5\\baselineskip}");
    } else {
      result = result.replace(/\\enlargethispage\{[^}]+\}/, "\\enlargethispage{3.5\\baselineskip}");
    }

    if (result.includes("enumitem")) {
      result = result.replace(
        /\\setlist\[itemize\]\{[^}]*\}/,
        "\\setlist[itemize]{nosep, leftmargin=12pt, topsep=1pt, itemsep=0.5pt, parsep=0pt, label=\\textbullet}"
      );
    }
  } else if (level === 2) {
    // Level 2: Stronger enlargement, section spacing & geometry squeeze
    if (!result.includes("\\enlargethispage") && result.includes("\\begin{document}")) {
      result = result.replace(/(\\begin\{document\})/, "$1\n\\enlargethispage{5\\baselineskip}");
    } else {
      result = result.replace(/\\enlargethispage\{[^}]+\}/, "\\enlargethispage{5\\baselineskip}");
    }

    if (result.includes("geometry")) {
      result = result.replace(
        /\\usepackage\[([^\]]*)\]\{geometry\}/,
        "\\usepackage[top=0.32in,bottom=0.3in,left=0.35in,right=0.35in]{geometry}"
      );
    }

    result = result.replace(
      /\\titlespacing\*?\{\\section\}\{[^}]*\}\{[^}]*\}\{[^}]*\}/g,
      "\\titlespacing{\\section}{0pt}{4pt}{1.5pt}"
    );

    if (!result.includes("enumitem") && result.includes("\\documentclass")) {
      result = result.replace(
        /(\\documentclass(?:\[[^\]]*\])?\{[^}]+\})/,
        "$1\n\\usepackage{enumitem}\n\\setlist[itemize]{nosep, leftmargin=12pt, topsep=1pt, itemsep=0.5pt, parsep=0pt, label=\\textbullet}"
      );
    }
  } else if (level === 3) {
    // Level 3: Max squeeze with line spread compression & tighter margins
    if (!result.includes("\\enlargethispage") && result.includes("\\begin{document}")) {
      result = result.replace(/(\\begin\{document\})/, "$1\n\\enlargethispage{6.5\\baselineskip}");
    } else {
      result = result.replace(/\\enlargethispage\{[^}]+\}/, "\\enlargethispage{6.5\\baselineskip}");
    }

    if (result.includes("geometry")) {
      result = result.replace(
        /\\usepackage\[([^\]]*)\]\{geometry\}/,
        "\\usepackage[top=0.28in,bottom=0.28in,left=0.32in,right=0.32in]{geometry}"
      );
    }

    result = result.replace(
      /\\titlespacing\*?\{\\section\}\{[^}]*\}\{[^}]*\}\{[^}]*\}/g,
      "\\titlespacing{\\section}{0pt}{3pt}{1pt}"
    );

    if (result.includes("\\linespread{")) {
      result = result.replace(/\\linespread\{[^}]+\}/g, "\\linespread{0.92}");
    } else if (result.includes("\\begin{document}")) {
      result = result.replace(/(\\begin\{document\})/, "$1\n\\linespread{0.93}\\selectfont");
    }
  }

  return result;
}

async function compileLatex(latex: string): Promise<{ ok: boolean; status: number; pdfBuffer?: ArrayBuffer; errText?: string }> {
  try {
    const compileUrl = `https://texlive.net/cgi-bin/latexcgi`;
    const formData = new FormData();
    formData.append("filecontents[]", latex);
    formData.append("filename[]", "document.tex");
    formData.append("engine", "pdflatex");
    formData.append("return", "pdf");

    const compileRes = await fetch(compileUrl, {
      method: "POST",
      body: formData,
      headers: {
        "Accept": "application/pdf, text/plain",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!compileRes.ok || !compileRes.headers.get("content-type")?.includes("application/pdf")) {
      const errText = await compileRes.text().catch(() => "Unknown compilation error");
      return { ok: false, status: compileRes.status, errText };
    }

    const pdfBuffer = await compileRes.arrayBuffer();
    return { ok: true, status: compileRes.status, pdfBuffer };
  } catch (err: any) {
    return { ok: false, status: 500, errText: err?.message || String(err) };
  }
}

async function ensureSinglePagePdf(baseLatex: string, initialBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    const pdfDoc = await PDFDocument.load(initialBuffer);
    const initialPages = pdfDoc.getPageCount();

    if (initialPages <= 1) {
      return initialBuffer;
    }

    console.log(`[generate-latex-pdf] Detected ${initialPages} pages. Squeezing to fit onto 1 page...`);
    let bestBuffer = initialBuffer;

    for (let level = 1; level <= 3; level++) {
      const squeezed = applySqueezeLevel(baseLatex, level);
      const res = await compileLatex(squeezed);
      if (res.ok && res.pdfBuffer) {
        bestBuffer = res.pdfBuffer;
        const doc = await PDFDocument.load(res.pdfBuffer);
        const pages = doc.getPageCount();
        console.log(`[generate-latex-pdf] Level ${level} squeeze page count: ${pages}`);
        if (pages === 1) {
          return res.pdfBuffer;
        }
      }
    }

    return bestBuffer;
  } catch (err) {
    console.warn("[generate-latex-pdf] Error during page count inspection:", err);
    return initialBuffer;
  }
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const body = await request.json();
    let latexString = "";

    if (body.latex) {
      latexString = body.latex;
    } else if (body.tailoredResume) {
      latexString = generateLatex(body.tailoredResume as ResumeData);
    } else {
      return NextResponse.json(
        { error: "Missing tailoredResume or latex in request body" },
        { status: 400, headers: corsHeaders }
      );
    }

    latexString = sanitizeLatex(latexString);
    console.log("[generate-latex-pdf] Sending LaTeX string to texlive.net for compilation...");

    const compileResult = await compileLatex(latexString);

    if (!compileResult.ok || !compileResult.pdfBuffer) {
      console.error("[generate-latex-pdf] Compilation failed with status", compileResult.status);
      console.error("[generate-latex-pdf] Error tail:", (compileResult.errText || "").slice(-2000));
      return NextResponse.json(
        { error: "LaTeX compilation failed. Check backend logs.", details: (compileResult.errText || "").slice(-1000) },
        { status: 500, headers: corsHeaders }
      );
    }

    const enforceSinglePage = body.enforceSinglePage !== false;
    const finalBuffer = enforceSinglePage
      ? await ensureSinglePagePdf(latexString, compileResult.pdfBuffer)
      : compileResult.pdfBuffer;

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", 'attachment; filename="tailored-resume.pdf"');

    return new Response(new Uint8Array(finalBuffer), {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    console.error("[generate-latex-pdf] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { generateLatex } from "../../../lib/latex-generator";
import type { ResumeData } from "../../../lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for external compilation

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
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

    // Sanitize common LLM LaTeX syntax mistakes before sending to pdflatex
    const codeBlockMatch = latexString.match(/```(?:latex|tex)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      latexString = codeBlockMatch[1].trim();
    } else {
      latexString = latexString.replace(/^```(?:latex|tex)?/i, '').replace(/```$/, '').trim();
    }
    const docClassIndex = latexString.indexOf('\\documentclass');
    if (docClassIndex > 0) {
      latexString = latexString.substring(docClassIndex).trim();
    }
    const endDocIndex = latexString.lastIndexOf('\\end{document}');
    if (endDocIndex !== -1) {
      latexString = latexString.substring(0, endDocIndex + 14).trim();
    }

    latexString = latexString
      .replace(/\\newcommand\{\\section\}/g, '\\renewcommand{\\section}')
      .replace(/\\newcommand\{\\subsection\}/g, '\\renewcommand{\\subsection}')
      .replace(/\\newcommand\{\\subsubsection\}/g, '\\renewcommand{\\subsubsection}')
      .replace(/\\newcommand\{\\item\}/g, '\\renewcommand{\\item}')
      .replace(/\\to\b/g, 'to')
      .replace(/\\rightarrow\b/g, 'to');

    // Compress LaTeX to avoid 414 Request-URI Too Large (Nginx 8KB limit)
    // Remove comments and compress multiple spaces/newlines
    const compressedLatex = latexString
      .replace(/%.*$/gm, "") // Remove comments
      .replace(/\n\s*\n/g, "\n") // Remove empty lines
      .replace(/([\{\}\\])\s+/g, "$1") // Remove spaces after brackets/commands where safe
      .replace(/\s+([\{\}\\])/g, " $1") 
      .trim();

    // 2. Compile via texlive.net using POST (multipart/form-data)
    console.log("[generate-latex-pdf] Sending LaTeX string to texlive.net for compilation...");
    
    const compileUrl = `https://texlive.net/cgi-bin/latexcgi`;
    const formData = new FormData();
    formData.append("filecontents[]", latexString);
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
      const errText = await compileRes.text();
      console.error("[generate-latex-pdf] Compilation failed with status", compileRes.status);
      console.error("[generate-latex-pdf] Error tail:", errText.slice(-2000)); // Log the END of the log where the error is
      
      // Dump to a file for debugging
      const fs = require('fs');
      fs.writeFileSync('./failed-latex.tex', latexString);
      
      return NextResponse.json(
        { error: "LaTeX compilation failed. Check backend logs.", details: errText.slice(-1000) },
        { status: 500, headers: corsHeaders }
      );
    }

    // 3. Return the compiled PDF Buffer
    const pdfBuffer = await compileRes.arrayBuffer();

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", 'attachment; filename="tailored-resume.pdf"');
    
    // Optional: Also return the raw LaTeX in a custom header so the client can save it if they want
    // But headers have size limits. Let's just return the PDF.
    
    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers,
    });

  } catch (err: unknown) {
    console.error("[generate-latex-pdf] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}

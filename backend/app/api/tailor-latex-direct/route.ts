import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { callLLM, callFastLLM, extractJSON } from "../../../lib/llm-client";
import { sanitizeMissingKeywords } from "../../../lib/skill-bank";
import { ensureLatexSpacing } from "../../../lib/latex-generator";
import { extractNameFromLatex } from "../../../lib/ai-tailor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const AI_MODELS = [
  { id: "nvidia:nvidia/nemotron-3.5-lightning-30b-a3b", name: "Nemotron Lightning (Fast)" },
  { id: "nvidia:nvidia/nemotron-3-super-120b-a12b", name: "Nemotron 120B (Balanced)" },
  { id: "nvidia:nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 550B (Quality)" },
];

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

function cleanLatexResponse(rawText: string): string {
  if (!rawText) return "";
  let cleaned = rawText.trim();

  // 0. Strip think tags if present
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 1. If wrapped in markdown code blocks anywhere in the response, extract the code inside
  const codeBlockMatch = cleaned.match(/```(?:latex|tex)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    // If no complete code block, strip leading/trailing backticks or markdown fence leftovers
    cleaned = cleaned.replace(/^```(?:latex|tex)?/i, '').replace(/```$/, '').trim();
  }

  // 2. Strip any leading conversational text or safety notices before \documentclass if present
  const docClassMatch = cleaned.match(/\\documentclass\s*(?:\[[^\]]*\])?\s*\{[^}]+\}/i);
  if (docClassMatch && docClassMatch.index !== undefined && docClassMatch.index > 0) {
    cleaned = cleaned.substring(docClassMatch.index).trim();
  }

  // 3. Strip any trailing conversational text after \end{document} if present
  const endDocIndex = cleaned.lastIndexOf('\\end{document}');
  if (endDocIndex !== -1) {
    cleaned = cleaned.substring(0, endDocIndex + 14).trim();
  }

  // 4. Sanitize common problematic Unicode characters that pdflatex chokes on
  cleaned = cleaned
    .replace(/\u202F/g, ' ') // Narrow No-Break Space
    .replace(/\u200B/g, '')  // Zero Width Space
    .replace(/\u2011/g, '-') // Non-Breaking Hyphen
    .replace(/\u2013/g, '--') // En Dash
    .replace(/\u2014/g, '---') // Em Dash
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
    .replace(/\\to(?![a-zA-Z])/g, ' to ') // Replace naked math arrow commands with plain text
    .replace(/\\rightarrow(?![a-zA-Z])/g, ' to ')
    .replace(/\\gets(?![a-zA-Z])/g, ' from ')
    .replace(/\\leftarrow(?![a-zA-Z])/g, ' from ')
    .replace(/¡/g, 'under ') // Fix Spanish inverted exclamation mark caused by raw < in LaTeX
    .replace(/<(?=\s*\d|\s*min|\s*ms|\s*\$)/gi, 'under ')
    .replace(/>(?=\s*\d|\s*min|\s*ms|\s*\$)/gi, 'over ');

  // 5. Escape unescaped % signs (e.g. 25% -> 25\%) so LaTeX doesn't comment out the rest of the line
  cleaned = cleaned.replace(/(\d+)\s*%(?!\w)/g, '$1\\%');

  // 6. Strip standalone LaTeX comments and trim redundant formatting bloat
  cleaned = cleaned.replace(/^\s*%.*$/gm, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/[ \t]+$/gm, '');
  cleaned = cleaned.replace(/[ \t]+\\\\/g, '\\\\');

  // 7. Strip unintended blank lines inside itemize environments that add paragraph break spacing
  cleaned = cleaned.replace(/(\\begin\{itemize\})\n\s*\n+/g, '$1\n');
  cleaned = cleaned.replace(/(\\item[^\n]*)\n\s*\n+(\s*\\item)/g, '$1\n$2');
  cleaned = cleaned.replace(/\n\s*\n+(\\end\{itemize\})/g, '\n$1');

  return cleaned.trim();
}

function fallbackKeywordEvaluation(latex: string, jdData: any) {
  const jdText = typeof jdData === 'string' ? jdData : JSON.stringify(jdData);
  const lowerJd = jdText.toLowerCase();
  const lowerLatex = latex.toLowerCase();

  const commonKeywords = [
    "Java", "React", "React.js", "MongoDB", "NoSQL", "REST APIs", "REST API", "Microservices",
    "Agile", "Scalable", "High-performance", "Spring Boot", "TypeScript", "JavaScript",
    "Node.js", "Docker", "Kubernetes", "AWS", "SQL", "PostgreSQL", "Git", "CI/CD", "Python"
  ];

  const matched: string[] = [];
  const missing: string[] = [];

  commonKeywords.forEach((kw) => {
    const kwLower = kw.toLowerCase();
    if (lowerJd.includes(kwLower)) {
      if (lowerLatex.includes(kwLower)) {
        if (!matched.includes(kw)) matched.push(kw);
      } else {
        if (!missing.includes(kw)) missing.push(kw);
      }
    }
  });

  const sanitizedMissing = sanitizeMissingKeywords(missing, matched);
  const total = matched.length + sanitizedMissing.length;
  const score = total > 0 ? Math.round((matched.length / total) * 100) : 85;

  return {
    score,
    reasoning: `Matches ${matched.length} core job competencies (${matched.slice(0, 3).join(', ')}...). ATS alignment is solid.`,
    matchedKeywords: matched,
    missingKeywords: sanitizedMissing
  };
}

async function evaluateTailoredResume(latex: string, jdData: any): Promise<{
  score: number;
  reasoning: string;
  matchedKeywords: string[];
  missingKeywords: string[];
}> {
  // If LaTeX is empty or invalid (does not have \begin{document}), return fallback instantly
  if (!latex || !latex.includes("\\begin{document}")) {
    return {
      score: 0,
      reasoning: "Generated LaTeX is incomplete or invalid.",
      matchedKeywords: [],
      missingKeywords: [],
    };
  }

  const evalSystemPrompt = `You are an expert technical recruiter and ATS (Applicant Tracking System) optimization algorithm. Your job is to evaluate how well a tailored LaTeX resume matches a target Job Description.

CRITICAL EVALUATION RULES:
1. HARD TECHNICAL SKILLS ONLY: "missingKeywords" must ONLY contain fundamentally missing programming languages, technical frameworks, databases, or specific cloud/developer tools (e.g. Go, GraphQL, Docker, Kubernetes).
2. NEVER INCLUDE SOFT TRAITS / GENERIC QUALITIES: Do NOT list generic conversational English descriptors (such as "Accuracy", "Clarity", "Technical Reasoning", "Solution Approaches", "Code Decisions", "Software Defects", "Maintainability", "Scalability", "Performance Bottlenecks", "Attention to Detail") in "missingKeywords".
3. NO VERSION DUPLICATES: Do NOT list version-specific variants (e.g., "Java 8", "Java 17", "Python 3") in "missingKeywords" if the core base skill is present in the resume.
4. If an engineering concept is demonstrated or mentioned anywhere in the resume text, treat it as MATCHED.

You MUST return a JSON object with EXACTLY the following structure. Do NOT wrap it in markdown code blocks. Start and end with the JSON curly braces:
{
  "score": <number from 0 to 100>,
  "reasoning": "<1-2 sentences>",
  "matchedKeywords": ["<list of matched technical skills and core engineering domains>"],
  "missingKeywords": ["<list of strictly missing technical tools/languages only>"]
}`;

  const evalUserMessage = `Job Description:
${JSON.stringify(jdData, null, 2)}

Tailored LaTeX Resume:
${latex}`;

  try {
    let evalTimer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      evalTimer = setTimeout(() => reject(new Error("ATS evaluation timeout")), 12000);
    });

    const response = await Promise.race([
      callFastLLM({
        systemPrompt: evalSystemPrompt,
        userMessage: evalUserMessage,
        temperature: 0.1,
        jsonMode: true,
      }),
      timeoutPromise
    ]).finally(() => {
      if (evalTimer) clearTimeout(evalTimer);
    });

    const parsed = JSON.parse(extractJSON(response.content));
    const fallback = fallbackKeywordEvaluation(latex, jdData);

    const matched = Array.isArray(parsed.matchedKeywords) && parsed.matchedKeywords.length > 0
      ? parsed.matchedKeywords
      : fallback.matchedKeywords;

    const missing = Array.isArray(parsed.missingKeywords) && parsed.missingKeywords.length > 0
      ? parsed.missingKeywords
      : fallback.missingKeywords;

    const sanitizedMissing = sanitizeMissingKeywords(missing, matched);

    return {
      score: typeof parsed.score === 'number' ? parsed.score : fallback.score,
      reasoning: parsed.reasoning || fallback.reasoning,
      matchedKeywords: matched,
      missingKeywords: sanitizedMissing,
    };
  } catch (err) {
    console.warn("[evaluateTailoredResume] Fast fallback used:", (err as any)?.message || err);
    return fallbackKeywordEvaluation(latex, jdData);
  }
}

interface TailoredResult {
  modelId: string;
  modelName: string;
  candidateName?: string;
  latex: string;
  originalLength: number;
  generatedLength: number;
  lengthExceeded: boolean;
  lengthCheck: {
    status: string;
    length: number;
    maxLength: number;
  };
  score: number;
  reasoning: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  error?: string;
}

async function tailorForModel(
  modelId: string,
  modelName: string,
  latex: string,
  latexLength: number,
  jdData: any,
  systemPrompt: string,
  userMessage: string
): Promise<TailoredResult> {
  let tailoredLatex = "";
  let attempt = 0;
  const maxAttempts = 3;
  let currentSystemPrompt = systemPrompt;
  const maxAllowedBudget = latexLength;

  while (attempt < maxAttempts) {
    const response = await callLLM({
      systemPrompt: currentSystemPrompt,
      userMessage,
      modelSelection: { primaryModel: modelId },
      jsonMode: false,
    });

    tailoredLatex = cleanLatexResponse(response.content);

    if (tailoredLatex.length <= maxAllowedBudget) {
      break;
    }

    const excess = tailoredLatex.length - maxAllowedBudget;
    currentSystemPrompt = `You are an expert ATS specialist and LaTeX editor.
CRITICAL 1-PAGE CHARACTER LIMIT OVERFLOW (ATTEMPT ${attempt + 1}/${maxAttempts}):
Your generated LaTeX was ${tailoredLatex.length} characters long, which is ${excess} characters OVER the strict 1-page budget (${maxAllowedBudget} characters).

TO GUARANTEE THE RESUME FITS ON EXACTLY 1 PAGE WHILE RETAINING 100% OF JD KEYWORDS:
1. SWAP IN-PLACE & COMPACT: Keep single-line bullets under 80 characters, and 2-line bullets under 145 characters. Remove unnecessary filler words, but DO NOT drop required JD technologies (GraphQL, Kubernetes, C#, .Net, Java, Docker, etc.).
2. PROJECT TECH HEADERS: Keep strictly to 4-5 core JD technologies per project subtitle.
3. SKILL ROWS: Keep each skill category to 1 single line (max 5-6 tools, max 55-60 chars).
4. SUMMARY: Limit summary to strictly 3 compact lines (~45 words).
5. DO NOT add extra bullets or projects. Keep the exact count as the original template.

You MUST produce the full LaTeX document with total length <= ${maxAllowedBudget} characters.`;
    attempt++;
  }

  const lengthExceeded = tailoredLatex.length > latexLength;
  const evaluation = await evaluateTailoredResume(tailoredLatex, jdData);

  return {
    modelId,
    modelName,
    latex: tailoredLatex,
    originalLength: latexLength,
    generatedLength: tailoredLatex.length,
    lengthExceeded,
    lengthCheck: {
      status: lengthExceeded ? "over" : "fit",
      length: tailoredLatex.length,
      maxLength: latexLength
    },
    score: evaluation.score,
    reasoning: evaluation.reasoning,
    matchedKeywords: evaluation.matchedKeywords,
    missingKeywords: evaluation.missingKeywords,
  };
}

async function tailorForModelSafe(
  modelId: string,
  modelName: string,
  latex: string,
  latexLength: number,
  jdData: any,
  systemPrompt: string,
  userMessage: string
): Promise<TailoredResult> {
  try {
    return await tailorForModel(modelId, modelName, latex, latexLength, jdData, systemPrompt, userMessage);
  } catch (err: any) {
    console.error(`[tailorForModelSafe] Error for model ${modelId}:`, err);
    return {
      modelId,
      modelName,
      latex: "",
      originalLength: latexLength,
      generatedLength: 0,
      lengthExceeded: false,
      lengthCheck: {
        status: "fit",
        length: 0,
        maxLength: latexLength
      },
      score: 0,
      reasoning: `Failed to generate: ${err.message || String(err)}`,
      matchedKeywords: [],
      missingKeywords: [],
      error: err.message || String(err)
    };
  }
}

function formatApiError(err: any): string {
  let message = typeof err === "string" ? err : err?.message || String(err);

  // Parse JSON embedded in error strings (e.g. "413 {"error":{...}}")
  if (message.includes('{"error"')) {
    try {
      const jsonStart = message.indexOf("{");
      const parsed = JSON.parse(message.substring(jsonStart));
      if (parsed?.error?.message) {
        message = parsed.error.message;
      }
    } catch (e) { }
  }

  if (message.includes("tokens per minute") || message.includes("TPM") || message.includes("rate_limit_exceeded") || message.includes("Request too large")) {
    return `Token/Rate Limit Exceeded: ${message}`;
  }
  if (message.includes("Worker local total request limit reached") || message.includes("ResourceExhausted")) {
    return `NVIDIA Server Busy: Request capacity reached (32/32). Please retry in a few moments.`;
  }
  if (message.includes("404")) {
    return `Model Endpoint Unavailable (404): The model endpoint is temporarily offline.`;
  }

  return message;
}

function findRelevantSkillBankItems(skillBank: any, jdData: any) {
  if (!skillBank || !skillBank.skills || skillBank.skills.length === 0) {
    return { relevantSkills: [], relevantProjects: [], matchCount: 0 };
  }

  const jdString = (typeof jdData === "string" ? jdData : JSON.stringify(jdData)).toLowerCase();

  const matchedSkills: any[] = [];
  const otherSkills: any[] = [];

  for (const skill of skillBank.skills) {
    const sName = (skill.name || "").toLowerCase();
    const sRepo = (skill.sourceRepo || "").toLowerCase();
    const sCat = (skill.category || "").toLowerCase();

    const isMatched =
      (sName.length > 2 && jdString.includes(sName)) ||
      (sRepo.length > 2 && jdString.includes(sRepo)) ||
      (sCat.length > 2 && jdString.includes(sCat));

    if (isMatched) {
      matchedSkills.push(skill);
    } else {
      otherSkills.push(skill);
    }
  }

  const relevantSkills = [...matchedSkills, ...otherSkills].slice(0, 20);

  const matchedProjects: any[] = [];
  const otherProjects: any[] = [];

  for (const proj of skillBank.projects || []) {
    const pName = (proj.name || "").toLowerCase();
    const pDesc = (proj.description || "").toLowerCase();
    const pLang = (proj.primaryLanguage || "").toLowerCase();
    const pSkills = (proj.extractedSkills || []).map((s: string) => String(s).toLowerCase());
    const pTopics = (proj.topics || []).map((t: string) => String(t).toLowerCase());

    const isMatched =
      (pName.length > 2 && jdString.includes(pName)) ||
      (pDesc.length > 2 && jdString.includes(pDesc)) ||
      (pLang.length > 2 && jdString.includes(pLang)) ||
      pSkills.some((s: string) => s.length > 2 && jdString.includes(s)) ||
      pTopics.some((t: string) => t.length > 2 && jdString.includes(t));

    if (isMatched) {
      matchedProjects.push(proj);
    } else {
      otherProjects.push(proj);
    }
  }

  const relevantProjects = [...matchedProjects, ...otherProjects].slice(0, 4);

  return { relevantSkills, relevantProjects, matchCount: matchedSkills.length };
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const { latex, jdData, rawJdText, skillBank, modelsToRun } = await request.json();

    if (!latex || !latex.trim()) {
      return NextResponse.json({ error: "Missing LaTeX input" }, { status: 400, headers: corsHeaders });
    }
    if (!jdData) {
      return NextResponse.json({ error: "Missing JD data" }, { status: 400, headers: corsHeaders });
    }

    const latexLength = latex.length;

    let skillBankInstruction = "";
    let selectedSkills: any[] = [];
    let selectedProjects: any[] = [];

    if (skillBank && skillBank.skills && skillBank.skills.length > 0) {
      const { relevantSkills, relevantProjects, matchCount } = findRelevantSkillBankItems(skillBank, jdData);
      selectedSkills = relevantSkills;
      selectedProjects = relevantProjects;

      const topSkills = selectedSkills.map((s: any) => `${s.name}${s.versionDetails ? ` (${s.versionDetails})` : ""} [Repo: ${s.sourceRepo}]`).join(", ");
      const topProjects = selectedProjects.map((p: any) => {
        const stack = (p.extractedSkills || []).length > 0 ? ` [Stack: ${p.extractedSkills.join(", ")}]` : "";
        return `${p.name}${stack}: ${p.description || "Project"}`;
      }).join("; ");

      console.log(`[tailor-latex-direct] Smart JD Skill Lookup: Found ${matchCount} direct JD-matching skills out of ${skillBank.skills.length} total skills.`);

      skillBankInstruction = `

VERIFIED GITHUB SKILL BANK INTEGRATION:
- Verified candidate skills: ${topSkills}
- Verified projects: ${topProjects}
- IN-PLACE REPLACEMENT: Inject relevant skills and swap low-relevance resume projects with matching verified GitHub projects, keeping the exact same LaTeX commands and bullet count.`;
    }
    const mustHave = Array.isArray(jdData.mustHaveSkills) ? jdData.mustHaveSkills : [];
    const niceToHave = Array.isArray(jdData.niceToHaveSkills) ? jdData.niceToHaveSkills : [];
    const keywords = Array.isArray(jdData.keywords) ? jdData.keywords : [];
    const allJdRequirements = Array.from(new Set([...mustHave, ...niceToHave, ...keywords])).filter(Boolean);
    const jdChecklistText = allJdRequirements.length > 0
      ? allJdRequirements.map((req: string) => `- ${req}`).join("\n")
      : "- Align with structured JD requirements";
    const systemPrompt = `You are an elite ATS resume optimizer and senior LaTeX developer.
Your task is to tailor a raw LaTeX resume to achieve 95-100% ATS match alignment with the target Job Description by replacing irrelevant skills and words with 100% of the target JD's required technologies and competencies.

TARGET JD REQUIREMENTS CHECKLIST (EVERY TECHNICAL ITEM MUST BE INJECTED):
${jdChecklistText}

CORE IN-PLACE TAILORING RULES:
1. 100% MANDATORY JD TECHNICAL SKILLS INJECTION:
   - Every single programming language, framework, database, tool, and protocol listed in the Target JD (including GraphQL, Kubernetes, Docker, Java, Spring Boot, C#, .Net, Angular, Node.js, PostgreSQL, etc.) MUST be injected into the resume!
   - Aggressively IDENTIFY and REPLACE tools and phrases in the original LaTeX that are NOT in the JD (e.g., replace Stripe, Zoho, AssemblyAI, WebRTC, Socket.io, Passport.js, Tailwind CSS) with the target JD's required technologies.
   - Place JD-matching skills at the very front of each skill category and project header.

2. PROJECTS SECTION OVERHAUL & ARCHITECTURAL REALISM (CRITICAL):
   - In EVERY project header (the second argument of \\project{ProjectName}{Tech Stack}):
     REPLACE non-JD tools with target JD technologies so each project showcases target JD skills!
     Keep strictly to 4-5 core tools per project subtitle (do NOT cram 8+ tools in one header).
   - STRICT ARCHITECTURAL REALISM & NO COMPETING BACKENDS:
     * NEVER mix competing backend ecosystems in the SAME single project or bullet point (e.g., NEVER write "Java Spring Boot / C# .Net REST APIs" or "Angular/Node.js frontend and C# .Net backend").
     * A single project MUST use ONE coherent, realistic backend stack!
     * If the target JD requires multiple backend technologies (e.g. Java, C#, Node.js, Python), DISTRIBUTE them across different projects in the resume so each project represents a distinct, realistic stack.
   - GITHUB SKILL BANK DYNAMIC SWAPPING:
     * You may swap out any low-relevance project with any matching verified project from the candidate's GitHub Skill Bank, keeping the exact LaTeX \\project{...}{...} command and bullet structure.
   - In project bullet points: describe realistic technical actions with the specific project's allocated stack (e.g., designing GraphQL queries/mutations in .NET/Node, deploying containerized pods in Kubernetes, building Java Spring Boot microservices, optimizing algorithms).

3. TECHNICAL SKILLS SECTION (LOGICAL & COMPACT):
   - Every skill MUST be placed in its logically correct category:
     * Languages: Java, C\\#, TypeScript, JavaScript, Python, C/C++, SQL, Kotlin, Swift
     * Backend: Spring Boot, .Net, Node.js, Express.js, GraphQL, REST APIs, Microservices
     * Frontend: Angular, AngularJS, React.js, HTML5, CSS
     * Cloud \\& DevOps: Kubernetes, Docker, AWS, CI/CD, GitHub Actions, Git
     * Databases: PostgreSQL, MongoDB, MySQL, Database Concepts, SQL
     * Core Concepts: Data Structures, Algorithms, OOPS, Agile/Scrum, Distributed Systems
   - DO NOT dump programming languages into "AI & LLM" or concepts into "Payments & Billing". If the original resume has category labels like "AI & LLM" or "Payments & Billing" that are irrelevant to the target role, rename/replace those labels with standard relevant categories (e.g. \\textbf{Cloud \\& DevOps:}, \\textbf{Core Concepts:}).
   - Keep each skill category line strictly on 1 physical line (max 5-6 core tools, ~50-65 chars).

4. WORK EXPERIENCE & ARCHITECTURAL REALISM:
   - Weave target domain concepts, languages, and methodologies (e.g. Java, C#, .Net, Kubernetes, Docker, GraphQL, Agile/Scrum, Data Structures, Algorithms) directly into action verbs across the bullet points.
   - ARCHITECTURAL REALISM: NEVER mix competing backend technologies in the same sentence or bullet point (e.g., NEVER write "Java Spring Boot / C# .Net services"). Allocate different roles/services to their respective stacks.
   - Maintain the EXACT SAME number of bullet points per job/project as the original template.

5. PROFESSIONAL SUMMARY:
   - Rewrite the summary to highlight target role title and domain focus in strictly 3 compact lines (~45-55 words).

6. STRICT 1-PAGE CHARACTER LIMIT (HARD REQUIREMENT):
   - The original LaTeX has ${latexLength} characters.
   - Your tailored LaTeX MUST be <= ${latexLength} characters (Target budget: ~${Math.round(latexLength * 0.95)} to ${latexLength} characters).
   - DO NOT alter preamble, geometry, margins, packages, or vertical spacing.

7. LATEX FORMATTING RULES:
   - Leave ALL macros, brackets, and custom commands (e.g. \\role, \\project, \\item) intact.
   - DO NOT use raw '<' or '>' in text (write 'under' / 'over'). ALWAYS escape '%' as '\\%' and '&' as '\\&'.
   - Return ONLY the raw tailored LaTeX string. Do NOT wrap in markdown code blocks (\`\`\`latex ... \`\`\`). No preamble explanations or conversational text. Output full document from \\documentclass to \\end{document}.${skillBankInstruction}`;

    const userMessage = `TARGET JOB DESCRIPTION & REQUIREMENTS:
${rawJdText && rawJdText.length < 2000 ? `RAW JOB DESCRIPTION:\n${rawJdText}\n\n` : ""}STRUCTURED JD REQUIREMENTS SUMMARY:
${JSON.stringify(jdData, null, 2)}
${selectedSkills.length > 0 ? `\nVERIFIED CANDIDATE GITHUB SKILL BANK:\n${JSON.stringify({ skills: selectedSkills, projects: selectedProjects }, null, 2)}` : ""}

Original LaTeX (Length: ${latexLength} characters, Target tailored length: <= ${latexLength} characters):
${latex}`;

    console.log(`[tailor-latex-direct] Initializing parallel streaming response...`);

    const targetModels = Array.isArray(modelsToRun) && modelsToRun.length > 0
      ? AI_MODELS.filter(m => modelsToRun.includes(m.id))
      : AI_MODELS;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };

        // Send initial queue state for all models
        targetModels.forEach((m) => {
          sendEvent({ modelId: m.id, progress: 0, phase: "Queued" });
        });

        // Run all models in parallel, updating progress on key milestones
        const promises = targetModels.map(async (model) => {
          try {
            sendEvent({ modelId: model.id, progress: 15, phase: "Parsing JD" });
            sendEvent({ modelId: model.id, progress: 30, phase: "Tailoring Resume" });

            let tailoredLatex = "";
            let attempt = 0;
            const maxAttempts = 3;
            let currentSystemPrompt = systemPrompt;
            const maxAllowedBudget = latexLength;

            let latexResult = "";
            while (attempt < maxAttempts) {
              const response = await callLLM({
                systemPrompt: currentSystemPrompt,
                userMessage,
                modelSelection: { primaryModel: model.id },
                jsonMode: false,
              });

              latexResult = cleanLatexResponse(response.content);

              if (latexResult.length <= maxAllowedBudget) {
                break;
              }

              const excess = latexResult.length - maxAllowedBudget;
              currentSystemPrompt = `You are an expert ATS specialist and LaTeX editor.
CRITICAL 1-PAGE CHARACTER LIMIT OVERFLOW (ATTEMPT ${attempt + 1}/${maxAttempts}):
Your generated LaTeX was ${latexResult.length} characters long, which is ${excess} characters OVER the strict 1-page budget (${maxAllowedBudget} characters).

TO GUARANTEE THE RESUME FITS ON EXACTLY 1 PAGE WHILE RETAINING 100% OF JD KEYWORDS:
1. SWAP IN-PLACE & COMPACT: Keep single-line bullets under 80 characters, and 2-line bullets under 145 characters. Remove unnecessary filler words, but DO NOT drop required JD technologies (GraphQL, Kubernetes, C#, .Net, Java, Docker, etc.).
2. PROJECT TECH HEADERS: Keep strictly to 4-5 core JD technologies per project subtitle.
3. SKILL ROWS: Keep each skill category to 1 single line (max 5-6 tools, max 55-60 chars).
4. SUMMARY: Limit summary to strictly 3 compact lines (~45 words).
5. DO NOT add extra bullets or projects. Keep the exact count as the original template.

You MUST produce the full LaTeX document with total length <= ${maxAllowedBudget} characters.`;
              attempt++;
            }
            tailoredLatex = latexResult;

            const lengthExceeded = tailoredLatex.length > latexLength;

            sendEvent({ modelId: model.id, progress: 80, phase: "ATS Checking" });

            const evaluation = await evaluateTailoredResume(tailoredLatex, jdData);

            // Calculate composite score with length penalty if generated LaTeX exceeds original limit
            let rawScore = evaluation.score;
            if (lengthExceeded) {
              rawScore = Math.max(0, rawScore - 15);
            }
            const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

            const candidateName = extractNameFromLatex(tailoredLatex) || extractNameFromLatex(latex) || "";

            const result: TailoredResult = {
              modelId: model.id,
              modelName: model.name,
              candidateName,
              latex: tailoredLatex,
              originalLength: latexLength,
              generatedLength: tailoredLatex.length,
              lengthExceeded,
              lengthCheck: {
                status: lengthExceeded ? "over" : "fit",
                length: tailoredLatex.length,
                maxLength: latexLength
              },
              score: finalScore,
              reasoning: evaluation.reasoning,
              matchedKeywords: evaluation.matchedKeywords,
              missingKeywords: evaluation.missingKeywords,
            };

            sendEvent({ modelId: model.id, progress: 100, phase: "Ready", result });
          } catch (err: any) {
            console.error(`[Stream Error] Model execution failed for ${model.id}:`, err);
            const errStr = formatApiError(err);
            const candidateName = extractNameFromLatex(latex) || "";
            const errorResult: TailoredResult = {
              modelId: model.id,
              modelName: model.name,
              candidateName,
              latex: "",
              originalLength: latexLength,
              generatedLength: 0,
              lengthExceeded: false,
              lengthCheck: {
                status: "fit",
                length: 0,
                maxLength: latexLength
              },
              score: 0,
              reasoning: `Failed to generate: ${errStr}`,
              matchedKeywords: [],
              missingKeywords: [],
              error: errStr
            };
            sendEvent({ modelId: model.id, progress: 100, phase: "Error", error: errStr, result: errorResult });
          }
        });

        await Promise.all(promises);
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        ...corsHeaders,
      },
    });
  } catch (err: unknown) {
    console.error("[tailor-latex-direct] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { callLLM, callFastLLM, extractJSON } from "../../../lib/llm-client";
import { sanitizeMissingKeywords } from "../../../lib/skill-bank";
import { ensureLatexSpacing } from "../../../lib/latex-generator";
import { extractNameFromLatex } from "../../../lib/ai-tailor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const AI_MODELS = [
  { id: "nvidia:moonshotai/kimi-k3", name: "Kimi K3 (Moonshot AI)" },
  { id: "nvidia:nvidia/nemotron-3-super-120b-a12b", name: "Nemotron 120B (Balanced)" },
  { id: "nvidia:nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 550B (Quality)" },
  { id: "nvidia:deepseek-ai/deepseek-v4-pro-0813", name: "DeepSeek V4 Pro (Quality)" },
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
    skimVerdict: "Clean visual layout and strong technical alignment stop the recruiter's scroll.",
    matchedKeywords: matched,
    missingKeywords: sanitizedMissing.slice(0, 5),
    redFlags: []
  };
}

async function evaluateTailoredResume(latex: string, jdData: any): Promise<{
  score: number;
  reasoning: string;
  skimVerdict: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  redFlags: string[];
}> {
  // If LaTeX is empty or invalid (does not have \begin{document}), return fallback instantly
  if (!latex || !latex.includes("\\begin{document}")) {
    return {
      score: 0,
      reasoning: "Generated LaTeX is incomplete or invalid.",
      skimVerdict: "Document structure invalid or empty.",
      matchedKeywords: [],
      missingKeywords: [],
      redFlags: ["LaTeX document incomplete or missing document body."],
    };
  }

  const companyName = jdData?.company ? `for ${jdData.company}` : "for this target company";
  const targetRole = jdData?.jobTitle ? `for the ${jdData.jobTitle} position` : "";

  const evalSystemPrompt = `You are a senior technical recruiter and hiring bar-raiser ${companyName} reviewing candidates ${targetRole}.
You are scanning 200 resumes in one sitting and spend under 10 seconds per resume.
Evaluate this tailored LaTeX resume against the target Job Description.

CRITICAL EVALUATION RULES:
1. HARD TECHNICAL SKILLS ONLY: "missingKeywords" must ONLY contain fundamentally missing programming languages, technical frameworks, databases, or specific cloud/developer tools (e.g. Go, GraphQL, Docker, Kubernetes).
2. NEVER INCLUDE SOFT TRAITS / GENERIC QUALITIES: Do NOT list generic conversational English descriptors (such as "Accuracy", "Clarity", "Technical Reasoning", "Solution Approaches", "Code Decisions", "Software Defects", "Maintainability", "Scalability", "Performance Bottlenecks", "Attention to Detail") in "missingKeywords".
3. NO VERSION DUPLICATES: Do NOT list version-specific variants (e.g., "Java 8", "Java 17", "Python 3") in "missingKeywords" if the core base skill is present in the resume.
4. If an engineering concept is demonstrated or mentioned anywhere in the resume text, treat it as MATCHED.
5. TOP 5 MISSING KEYWORDS ONLY: Strictly limit "missingKeywords" to the top 5 highest-priority technical requirements that are completely missing.
6. RED FLAGS VERIFICATION: The tailored resume was specifically rewritten to eliminate all candidate red flags and match the target JD. Verify that unquantified bullets, vague duties, passive voice, and missing JD skills have been corrected. If all such red flags have been addressed and no fatal document syntax errors exist, return an empty array [] for "redFlags". NEVER invent arbitrary or subjective nitpicks.
7. RECRUITER 10-SECOND SKIM VERDICT: In 1 punchy sentence, state whether this resume "stops the scroll" or which specific section/bullet risks getting skipped by a fast-scanning hiring manager.

You MUST return a JSON object with EXACTLY the following structure. Do NOT wrap it in markdown code blocks. Start and end with the JSON curly braces:
{
  "score": <number from 0 to 100>,
  "reasoning": "<1-2 sentences summarizing overall ATS match>",
  "skimVerdict": "<1 punchy sentence on 10-second recruiter skim: does it stop the scroll, or what risks being skipped>",
  "matchedKeywords": ["<list of matched technical skills and core engineering domains>"],
  "missingKeywords": ["<list of top 5 strictly missing technical tools/languages only>"],
  "redFlags": ["<fatal flaws only, or empty array [] if resolved>"]
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

    const redFlags = Array.isArray(parsed.redFlags)
      ? parsed.redFlags
      : fallback.redFlags;

    const skimVerdict = typeof parsed.skimVerdict === "string" && parsed.skimVerdict.trim().length > 0
      ? parsed.skimVerdict.trim()
      : fallback.skimVerdict;

    const sanitizedMissing = sanitizeMissingKeywords(missing, matched).slice(0, 5);

    return {
      score: typeof parsed.score === 'number' ? parsed.score : fallback.score,
      reasoning: parsed.reasoning || fallback.reasoning,
      skimVerdict,
      matchedKeywords: matched,
      missingKeywords: sanitizedMissing,
      redFlags,
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
  jobTitle?: string;
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
  skimVerdict?: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  redFlags?: string[];
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
    currentSystemPrompt = `You are an expert ATS specialist and senior LaTeX editor.
CRITICAL 1-PAGE CHARACTER LIMIT OVERFLOW (ATTEMPT ${attempt + 1}/${maxAttempts}):
Your generated LaTeX was ${tailoredLatex.length} characters long, which is ${excess} characters OVER the strict 1-page budget (${maxAllowedBudget} characters).

TO GUARANTEE THE RESUME FITS ON EXACTLY 1 PAGE WHILE RETAINING HIGH CREDIBILITY:
1. SWAP IN-PLACE & COMPACT: Keep single-line bullets under 80 characters, and 2-line bullets under 145 characters. Retain Google XYZ formula (accomplished X, measured by Y, by doing Z). Remove filler words, but retain key technical achievements. NEVER write robotic meta-phrases like "applied Data Structures, Algorithms" or "conducted task estimation".
2. PROJECT TECH HEADERS: Keep strictly to 4-5 core JD technologies per project subtitle.
3. SKILL ROWS: Keep each skill category to 1 single line (max 5-6 core tools, max 55-60 chars). Lead with target JD skills.
4. SUMMARY: Limit summary to strictly 3 compact, focused lines (~45-50 words).
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
    skimVerdict: evaluation.skimVerdict,
    matchedKeywords: evaluation.matchedKeywords,
    missingKeywords: evaluation.missingKeywords,
    redFlags: evaluation.redFlags,
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
      skimVerdict: "",
      matchedKeywords: [],
      missingKeywords: [],
      redFlags: [],
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

  const matchKw = (kw: string) => {
    if (!kw || kw.trim().length < 2) return false;
    const lower = kw.toLowerCase().trim();
    if (lower === "c++" || lower === "c#" || lower === ".net") {
      const esc = lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?:^|[\\s/,()])${esc}(?:$|[\\s/,()])`, "i").test(jdString);
    }
    const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(jdString);
  };

  const matchedSkillsMap = new Map<string, any>();
  const otherSkills: any[] = [];

  for (const skill of skillBank.skills) {
    const sName = (skill.name || "").toLowerCase().trim();
    if (!sName || sName.length < 2) continue;

    const isMatched =
      matchKw(sName) ||
      (sName === "django rest framework" && (matchKw("django") || matchKw("drf") || jdString.includes("rest framework"))) ||
      (sName === "golang" && matchKw("go")) ||
      (sName === "mongo" && matchKw("mongodb")) ||
      (sName === "github" && matchKw("git"));

    if (isMatched) {
      const existing = matchedSkillsMap.get(sName);
      if (!existing) {
        matchedSkillsMap.set(sName, skill);
      } else if (
        (existing.sourceRepo?.toLowerCase().includes("portfolio") || existing.sourceRepo?.toLowerCase().includes("account")) &&
        !skill.sourceRepo?.toLowerCase().includes("portfolio") &&
        !skill.sourceRepo?.toLowerCase().includes("account")
      ) {
        matchedSkillsMap.set(sName, skill);
      }
    } else {
      otherSkills.push(skill);
    }
  }

  const matchedSkills = Array.from(matchedSkillsMap.values());
  const relevantSkills = [...matchedSkills, ...otherSkills].slice(0, 25);

  // Score and rank projects by JD relevance
  const scoredProjects: Array<{ project: any; score: number }> = (skillBank.projects || []).map((proj: any) => {
    let score = 0;
    const pSkills = (proj.extractedSkills || []).map((s: string) => String(s).toLowerCase());

    pSkills.forEach((sk: string) => {
      if (matchKw(sk)) score += 10;
    });

    if (proj.primaryLanguage && matchKw(proj.primaryLanguage.toLowerCase())) {
      score += 15;
    }

    if (proj.description && matchKw("django") && proj.description.toLowerCase().includes("django")) {
      score += 20;
    }

    if (proj.name && matchKw(proj.name.toLowerCase())) {
      score += 5;
    }

    return { project: proj, score };
  });

  const relevantProjects = scoredProjects
    .sort((a, b) => b.score - a.score)
    .map((sp) => sp.project)
    .slice(0, 5);

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

MANDATORY VERIFIED GITHUB SKILL BANK INTEGRATION:
- Verified candidate skills: ${topSkills}
- Verified projects: ${topProjects}
- MANDATORY IN-PLACE INJECTION & SWAPPING:
  1. TECHNICAL SKILLS: If the target JD requires technologies (e.g. Python, Django, REST APIs, Docker, PostgreSQL) that exist in the Verified GitHub Skill Bank, you MUST include them in the Technical Skills section under their proper category.
  2. PROJECTS SECTION: If an existing resume project is low-relevance or lacks target JD technologies, SWAP it out with the most relevant verified GitHub project (e.g. Kanban_WorkBoard for Python/Django/REST APIs). Keep exact LaTeX markup and bullet counts intact.`;
    }
    const mustHave = Array.isArray(jdData.mustHaveSkills) ? jdData.mustHaveSkills : [];
    const niceToHave = Array.isArray(jdData.niceToHaveSkills) ? jdData.niceToHaveSkills : [];
    const keywords = Array.isArray(jdData.keywords) ? jdData.keywords : [];
    const allJdRequirements = Array.from(new Set([...mustHave, ...niceToHave, ...keywords])).filter(Boolean);
    const jdChecklistText = allJdRequirements.length > 0
      ? allJdRequirements.map((req: string) => `- ${req}`).join("\n")
      : "- Align with structured JD requirements";
    const companyTarget = jdData?.company ? `at ${jdData.company}` : "for this target company";
    const roleTarget = jdData?.jobTitle ? `as ${jdData.jobTitle}` : "in this role";
    const systemPrompt = `You are an elite technical recruiter and hiring bar-raiser ${companyTarget} evaluating candidates ${roleTarget}.
Act as a hiring manager scanning 200 resumes in one sitting. You spend under 10 seconds per resume—any skippable fluff, generic duties, passive voice, or unquantified claims are instant red flags that get a candidate rejected immediately.
Your mission is to tailor this raw LaTeX resume to achieve 95-100% ATS match alignment while stopping the recruiter's scroll dead in its tracks through compelling, quantified engineering impact.

TARGET JD REQUIREMENTS CHECKLIST:
${jdChecklistText}

CORE IN-PLACE TAILORING RULES:

0. MANDATORY PROACTIVE ERADICATION OF ALL JD RED FLAGS:
   - Identify every red flag a recruiter would spot against the target JD (unquantified bullets, passive/vague responsibilities, missing JD core tools, missing base programming languages, conflicting tech stacks, robotic phrasing) and FIX THEM ALL DIRECTLY in the generated resume:
   - Red Flag: Unquantified or metric-less bullet points -> FIX by structuring every bullet with Google's XYZ formula: Accomplished [X], as measured by [Y], by doing [Z]. Include concrete production-grade metrics (latency reduction %/ms, RPS throughput, query optimization %, test coverage %, scalability, concurrency, data volume).
   - Red Flag: Passive voice, weak verbs, or vague duties ("responsible for...", "assisted with...", "worked on...", "supported team") -> FIX by replacing with high-impact senior engineering action verbs (Architected, Engineered, Slashed, Optimized, Deployed, Benchmarked, Automated).
   - Red Flag: Missing JD technical keywords, libraries, or tools -> FIX by naturally embedding them as integral parts of the implementation mechanism [Z] across relevant experience bullets, project highlights, and skills categories.
   - Red Flag: Missing foundational programming languages when frameworks are listed (e.g. Django without Python, Spring Boot without Java, .NET without C#) -> FIX by explicitly pairing the base language with the framework.
   - Red Flag: Robotic or meta phrasing ("applied DSA", "demonstrating OOPS", "practiced Agile/Scrum ceremonies") -> FIX by replacing with authentic engineering challenges, architecture design, and measurable results.
   - Red Flag: Conflicting backend ecosystems or messy architectures (e.g., mixing Java Spring Boot and C# .NET in the same bullet or project) -> FIX by maintaining clean, realistic, single-ecosystem architectures.
   - Red Flag: Bloated, unorganized skill lists ("kitchen-sink dumps") -> FIX by categorizing cleanly and leading with target JD requirements first.
   - Red Flag: Generic professional summary -> FIX by sharply aligning title, domain, core stack, and years of experience to the target JD role.
   - The generated resume MUST be 100% free of red flags.

1. STOP THE SCROLL & 10-SECOND RECRUITER SKIM (CRITICAL):
   - Recruiters scan 200 resumes in one sitting. Bullets that read like generic job descriptions ("responsible for...", "assisted with...", "worked on APIs") get skipped in 1 second.
   - FRONT-LOAD IMPACT: The first 3-5 words of every bullet must pack immediate technical punch. Never bury the metric or outcome at the end of the sentence.
   - MANDATORY GOOGLE XYZ FORMULA: Structure bullet points strictly as: Accomplished [X], as measured by [Y], by doing [Z].
     * Will Get Skipped (Passive/Boring): "Responsible for microservices and helped reduce query latency using Redis caching."
     * Stops The Scroll (Google XYZ): "Slashed p99 query latency from 850ms to 420ms (49% drop) by architecting Redis cache layers and composite PostgreSQL indexes."
   - NATURAL KEYWORD EMBEDDING (ABSOLUTE BAN ON KEYWORD STUFFING):
     Seamlessly weave target JD keywords into the functional engineering mechanism [Z]. NEVER append trailing comma-separated buzzwords (e.g. NEVER write ", using Docker, AWS, Git"). Every keyword must be an active architectural component.
   - STRATEGIC VISUAL ANCHORS IN LATEX:
     Sparingly wrap 1-2 core technical tools or standout metrics in \\textbf{...} in key bullet points (e.g., \\textbf{420ms p99 latency}, \\textbf{Kafka pipelines}) so the recruiter's eyes visually anchor onto hard proof points during a quick scan.
   - BAN ON ROBOTIC / META PHRASING:
     NEVER write meta-phrases like "applied Data Structures, Algorithms for...", "conducted task estimation", "practiced Agile/Scrum ceremonies", "demonstrating OOPS concepts", or list software concepts as plain trailing nouns.

2. CAREER CREDIBILITY & ARCHITECTURAL REALISM (NO PAST COMPANY TECH-SWAPPING):
   - Keep historical company work technically authentic. Do NOT completely swap the foundational language/stack of established past employers (e.g., do NOT turn a past Node.js/PostgreSQL startup role into ASP.NET/SQL Server).
   - Instead, align historical experience by highlighting transferable high-value engineering patterns: API latency, microservices, cloud infrastructure, containerization, concurrency, CI/CD pipelines, automated testing, security, and schema optimization.
   - Focus primary target JD stack shifts aggressively in:
     * Professional Summary (sharp, authoritative focus on target role & stack).
     * Founder / Live SaaS / Contract roles (e.g. Chintu AI or client projects where candidate has full architectural ownership).
     * Projects Section (re-align project tech stacks to match target JD stack).
     * Technical Skills Section (prioritize target JD matching skills at the top).

3. PROJECTS SECTION OVERHAUL & COHERENT ARCHITECTURES:
   - In EVERY project header (the second argument of \\project{ProjectName}{Tech Stack}):
     Showcase target JD technologies! Keep strictly to 4-5 core tools per project subtitle (do NOT cram 8+ tools in one header).
   - EXPLICIT BASE LANGUAGE PAIRING (CRITICAL FOR ATS):
     * Whenever featuring a framework (e.g., Django, FastAPI, Flask, Spring Boot, .NET Core), ALWAYS explicitly include the foundational language if required by the JD (e.g. write "Python, Django REST Framework, PostgreSQL, React, Docker" or "Java, Spring Boot", NEVER omit "Python" or "Java" when using its framework).
     * In project bullets, explicitly state the language + framework (e.g., "Engineered full-stack Kanban board with React frontend and Python/Django REST Framework backend...").
   - STRICT ARCHITECTURAL REALISM & NO COMPETING BACKENDS:
     * NEVER mix competing backend ecosystems in the SAME single project or bullet point (e.g., NEVER write "Java Spring Boot / C# .Net REST APIs" or "Angular/Node.js frontend and C# .Net backend").
     * A single project MUST use ONE coherent, realistic stack!
     * If the target JD requires multiple backend technologies (e.g. Java, C#, Node.js, Python), DISTRIBUTE them across different projects in the resume so each project represents a distinct, realistic stack.
   - GITHUB SKILL BANK DYNAMIC SWAPPING:
     * You may swap out any low-relevance project with any matching verified project from the candidate's GitHub Skill Bank, keeping the exact LaTeX \\project{...}{...} command and bullet structure.
   - In project bullet points: describe realistic technical actions with the specific project's allocated stack (e.g., designing GraphQL queries/mutations, deploying containerized pods in Kubernetes, building RESTful microservices, optimizing algorithms).

4. TECHNICAL SKILLS SECTION (FOCUSED, CREDIBLE & COMPACT):
   - Place skills in logically correct categories:
     * Languages: Java, C\\#, TypeScript, JavaScript, Python, C/C++, SQL, Kotlin, Swift
     * Backend: Spring Boot, .NET Core, ASP.NET, Node.js, Express.js, GraphQL, REST APIs, Microservices
     * Frontend: React.js, Next.js, Angular, HTML5, CSS3, Redux
     * Cloud \\& DevOps: Kubernetes, Docker, AWS, Azure, GCP, CI/CD, GitHub Actions, Git
     * Databases: PostgreSQL, MongoDB, MySQL, SQL Server, Redis, Query Optimization
     * Core Concepts: Distributed Systems, High Throughput, Concurrency, System Design, Security, Microservices
   - AVOID KITCHEN-SINK BLOAT: Keep each skill category line strictly on 1 physical line with 5-6 core, high-relevance technologies (~50-65 chars). Do NOT dump every existing technology into one resume. Lead with the target JD's required technologies!
   - MODERN AI / DEVELOPER TOOLS: Do not list simple IDE plugins as standalone skill categories. If including AI tooling, format as practical engineering competencies (e.g. \\textbf{AI \\& LLM Integration:} OpenAI API, LangChain, Prompt Engineering, Vector Search, AI-Assisted Workflows) or combine under \\textbf{Developer Tools:}.

5. PROFESSIONAL SUMMARY:
   - Rewrite the summary to highlight the candidate's target role title, years of experience (3+ years), and primary domain/stack focus in strictly 3 compact lines (~45-55 words).
   - Keep it targeted and cohesive—do not list 6 competing backend frameworks in a single sentence.

6. STRICT 1-PAGE CHARACTER LIMIT (HARD REQUIREMENT):
   - The original LaTeX has ${latexLength} characters.
   - Your tailored LaTeX MUST be <= ${latexLength} characters (Target budget: ~${Math.round(latexLength * 0.95)} to ${latexLength} characters).
   - DO NOT alter preamble, geometry, margins, packages, or vertical spacing.

7. LATEX FORMATTING RULES:
   - Leave ALL macros, brackets, and custom commands (e.g. \\role, \\project, \\item) intact.
   - DO NOT use raw '<' or '>' in text (write 'under' / 'over'). ALWAYS escape '%' as '\\%' and '&' as '\\&'.
   - Return ONLY the raw tailored LaTeX string. Do NOT wrap in markdown code blocks (\`\`\`latex ... \`\`\`). No preamble explanations or conversational text. Output full document from \\documentclass to \\end{document}.${skillBankInstruction}`;

    const skillBankSummary = selectedSkills.length > 0
      ? `\nVERIFIED CANDIDATE GITHUB SKILLS:\n- Skills: ${selectedSkills.map((s: any) => s.name).join(", ")}\n- Projects: ${selectedProjects.map((p: any) => `${p.name} (${(p.extractedSkills || []).join(", ")})`).join("; ")}\n`
      : "";

    const userMessage = `TARGET JOB DESCRIPTION & REQUIREMENTS:
${jdChecklistText}
${skillBankSummary}
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
        const promises = targetModels.map(async (model, index) => {
          try {
            if (index > 0) {
              await new Promise((r) => setTimeout(r, index * 600));
            }
            sendEvent({ modelId: model.id, progress: 15, phase: "Parsing JD" });
            sendEvent({ modelId: model.id, progress: 30, phase: "Tailoring Resume" });

            let modelTimer: NodeJS.Timeout | null = null;
            const modelTimeoutPromise = new Promise<never>((_, reject) => {
              modelTimer = setTimeout(() => reject(new Error(`Model ${model.name} timed out after 600 seconds`)), 600000);
            });

            const generateWithRetry = async (): Promise<string> => {
              const maxAttempts = 3;
              let currentPrompt = systemPrompt;
              let tailored = "";

              for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const response = await callLLM({
                  systemPrompt: currentPrompt,
                  userMessage,
                  modelSelection: { primaryModel: model.id },
                  jsonMode: false,
                });

                tailored = cleanLatexResponse(response.content);

                if (tailored.length <= latexLength) {
                  break;
                }

                // Last attempt — no point building a retry prompt
                if (attempt >= maxAttempts - 1) break;

                const excess = tailored.length - latexLength;
                console.warn(`[Stream Retry] Model ${model.name} exceeded budget by ${excess} chars (${tailored.length}/${latexLength}). Attempt ${attempt + 2}/${maxAttempts}...`);

                sendEvent({ modelId: model.id, progress: 30 + (attempt + 1) * 15, phase: `Compacting (retry ${attempt + 1})` });

                currentPrompt = `You are an expert ATS specialist and senior LaTeX editor.
CRITICAL 1-PAGE CHARACTER LIMIT OVERFLOW (ATTEMPT ${attempt + 2}/${maxAttempts}):
Your generated LaTeX was ${tailored.length} characters long, which is ${excess} characters OVER the strict 1-page budget (${latexLength} characters).

TO GUARANTEE THE RESUME FITS ON EXACTLY 1 PAGE WHILE RETAINING HIGH CREDIBILITY:
1. SWAP IN-PLACE & COMPACT: Keep single-line bullets under 80 characters, and 2-line bullets under 145 characters. Retain Google XYZ formula (accomplished X, measured by Y, by doing Z). Remove filler words, but retain key technical achievements. NEVER write robotic meta-phrases like "applied Data Structures, Algorithms" or "conducted task estimation".
2. PROJECT TECH HEADERS: Keep strictly to 4-5 core JD technologies per project subtitle.
3. SKILL ROWS: Keep each skill category to 1 single line (max 5-6 core tools, max 55-60 chars). Lead with target JD skills.
4. SUMMARY: Limit summary to strictly 3 compact, focused lines (~45-50 words).
5. DO NOT add extra bullets or projects. Keep the exact count as the original template.
6. DO NOT alter preamble, geometry, margins, packages, or vertical spacing.

You MUST produce the full LaTeX document with total length <= ${latexLength} characters.
Return ONLY the raw tailored LaTeX string from \\documentclass to \\end{document}. No markdown fences, no explanations.`;
              }

              return tailored;
            };

            const tailoredLatex = await Promise.race([generateWithRetry(), modelTimeoutPromise]).finally(() => {
              if (modelTimer) clearTimeout(modelTimer);
            });

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
            const jobTitle = jdData?.jobTitle || "";

            const result: TailoredResult = {
              modelId: model.id,
              modelName: model.name,
              candidateName,
              jobTitle,
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
              skimVerdict: evaluation.skimVerdict,
              matchedKeywords: evaluation.matchedKeywords,
              missingKeywords: evaluation.missingKeywords,
              redFlags: (evaluation.redFlags && evaluation.redFlags.some(f => f.toLowerCase().includes("fatal") || f.toLowerCase().includes("incomplete"))) ? evaluation.redFlags : [],
            };

            sendEvent({ modelId: model.id, progress: 100, phase: "Ready", result });
          } catch (err: any) {
            console.error(`[Stream Error] Model execution failed for ${model.id}:`, err);
            const errStr = formatApiError(err);
            const candidateName = extractNameFromLatex(latex) || "";
            const jobTitle = jdData?.jobTitle || "";
            const errorResult: TailoredResult = {
              modelId: model.id,
              modelName: model.name,
              candidateName,
              jobTitle,
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
              skimVerdict: "",
              matchedKeywords: [],
              missingKeywords: [],
              redFlags: [],
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

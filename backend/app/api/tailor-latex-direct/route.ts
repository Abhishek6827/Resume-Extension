import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { callLLM, callFastLLM, extractJSON } from "../../../lib/llm-client";
import { sanitizeMissingKeywords } from "../../../lib/skill-bank";
import { ensureLatexSpacing } from "../../../lib/latex-generator";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const AI_MODELS = [
  { id: "nvidia:z-ai/glm-5.2", name: "GLM-5.2 (Balanced)" },
  { id: "nvidia:nvidia/nemotron-3.5-lightning-30b-a3b", name: "Nemotron Lightning (Fast)" },
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

CRITICAL KEYWORD RULE:
- Do NOT list version-specific variants (e.g., "Java 8", "Java 17", "Java 21", "Python 3") in "missingKeywords" if the core base skill/technology (e.g. "Java", "Python") is already present/matched in the candidate's resume.
- Only list fundamentally missing technologies or skills in "missingKeywords".

You MUST return a JSON object with EXACTLY the following structure. Do NOT wrap it in markdown code blocks. Start and end with the JSON curly braces:
{
  "score": <number from 0 to 100>,
  "reasoning": "<1-2 sentences>",
  "matchedKeywords": ["<list>"],
  "missingKeywords": ["<list>"]
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
  const maxAllowedBudget = Math.round(latexLength * 0.90);

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
    currentSystemPrompt = systemPrompt + `\n\nCRITICAL 1-PAGE OVERFLOW WARNING (ATTEMPT ${attempt + 1}/${maxAttempts}): Your generated LaTeX was ${tailoredLatex.length} characters long, which is ${excess} characters over the strict 1-page budget (${maxAllowedBudget} chars). To ensure the resume fits on EXACTLY 1 page without spilling onto page 2:
1. Keep the EXACT same skill category headers and count as the original template (do NOT create new category rows).
2. Limit each skill line to max 4-5 core tools (max 50-60 chars per line).
3. Limit project tech stack subtitles to max 3-4 tools (max 35 chars) so headers never wrap.
4. Keep all single-line bullets under 85 characters.
You MUST shorten your response to ~${Math.round(latexLength * 0.86)} characters.`;
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

  const relevantSkills = [...matchedSkills, ...otherSkills].slice(0, 25);

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

  const relevantProjects = [...matchedProjects, ...otherProjects].slice(0, 5);

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
        return `${p.name}${stack}: ${p.description || "Full-stack project"}`;
      }).join("; ");

      console.log(`[tailor-latex-direct] Smart JD Skill Lookup: Found ${matchCount} direct JD-matching skills out of ${skillBank.skills.length} total skills.`);

      skillBankInstruction = `

MANDATORY GITHUB SKILL BANK CONSULTATION, INJECTION & PROJECT SWAPPING:
The candidate has verified technical skills and real project achievements extracted directly from their GitHub codebase (prioritized by relevance to this Job Description):
- VERIFIED TECHNICAL SKILLS: ${topSkills}
- VERIFIED GITHUB PROJECTS: ${topProjects}

STRICT INSTRUCTIONS FOR SKILL BANK INTEGRATION & REPLACEMENT:
1. AUTOMATIC SKILL INJECTION & PRUNING IN \\section*{Technical Skills}:
   - Any JD-required technology verified in the candidate's GitHub Skill Bank (e.g., Django, Django REST Framework, FastAPI, PostgreSQL, Docker, AWS, etc.) MUST be injected into the appropriate category in \\section*{Technical Skills}.
   - PRUNE IRRELEVANT SKILLS: To stay strictly within the 1-page character limit, DROP / REMOVE tools from the original LaTeX that have zero relevance to the target Job Description. Always prioritize JD-matching verified skills over unrelated tools.

2. SMART PROJECT SWAPPING / REPLACEMENT (MANDATORY WHEN RELEVANT):
   - Compare candidate's existing LaTeX projects against the target Job Description.
   - If an existing project in the LaTeX resume has low relevance to the target JD, and the candidate has a high-relevance Verified GitHub Project (e.g. \`Kanban_WorkBoard\` with Django & React for a Python/Django/Full-Stack role), YOU MUST SWAP / REPLACE the least-relevant project in the resume with the matching GitHub project!
   - Format the swapped project using the EXACT same LaTeX commands, macros, and syntax as the original template (e.g., \\project{Kanban WorkBoard}{...}{Django, Django REST Framework, React, PostgreSQL} or corresponding macro).
   - Write 2-3 strong, quantifiable engineering bullet points highlighting core JD competencies (e.g., REST API endpoints, JWT auth, database queries, responsive UI).

3. CONTEXTUAL REWRITING:
   - For all retained projects and work experience, weave the verified JD-matching technologies and architectural concepts directly into the bullet points.`;
    }
    const mustHave = Array.isArray(jdData.mustHaveSkills) ? jdData.mustHaveSkills : [];
    const niceToHave = Array.isArray(jdData.niceToHaveSkills) ? jdData.niceToHaveSkills : [];
    const keywords = Array.isArray(jdData.keywords) ? jdData.keywords : [];
    const allJdRequirements = Array.from(new Set([...mustHave, ...niceToHave, ...keywords])).filter(Boolean);
    const jdChecklistText = allJdRequirements.length > 0
      ? allJdRequirements.map((req: string) => `- ${req}`).join("\n")
      : "- See structured JD requirements summary below";
    const systemPrompt = `You are an expert ATS specialist and LaTeX editor. 
Your task is to take a raw LaTeX resume and rewrite its Professional Summary, Work Experience & Project tech-stack subtitles, and bullet points to perfectly align with the target Job Description by consulting the candidate's Verified GitHub Skill Bank.

MANDATORY 100% JD KEYWORD INJECTION & ATS SCORE MAXIMIZATION (TARGET SCORE: 90%+):
The ATS evaluator strictly checks keyword coverage against the target Job Description. To achieve a 90%+ ATS score and eliminate all "Areas for Improvement", you MUST ensure that EVERY SINGLE technical skill, framework, database, tool, cloud platform, and security concept listed below is explicitly present in the tailored resume:

TARGET JD REQUIREMENTS CHECKLIST TO INJECT (100% COVERAGE MANDATORY):
${jdChecklistText}

STRICT INSTRUCTIONS FOR COMPLETE COVERAGE & ELIMINATING AREAS FOR IMPROVEMENT:
1. TECHNICAL SKILLS SECTION (100% INJECTION & PRUNING - PRESERVE EXACT ORIGINAL CATEGORIES):
   - PRESERVE ORIGINAL CATEGORIES: You MUST use ONLY the exact skill category headers present in the candidate's original LaTeX resume (e.g. Languages, Frontend, Backend, Databases, Tools). DO NOT create new category rows (e.g. do NOT invent new separate rows for 'AI & LLM', 'Auth & Security', 'Payments & Billing' if they were not in the original resume).
   - Distribute all required JD keywords and verified GitHub skills into the candidate's existing categories.
   - Place JD-matching keywords at the VERY BEGINNING of each category line.
   - Prune/drop irrelevant existing skills so each category line contains AT MOST 4-5 high-priority tools (MAX 50-60 CHARACTERS PER LINE). NEVER let a skill line wrap to 2 physical lines!
   - NEVER repeat sub-tools or synonyms on the same line (e.g., do NOT write "AWS, CloudWatch, CloudWatch Logs, CloudWatch dashboards, CloudWatch alerting, SNS" — simply write "AWS (CloudWatch, SNS), Docker, Git, CI/CD").

2. CONTEXTUAL WEAVING & PROJECT SWAPPING:
   - Update Project Tech Stack subtitles (e.g. \\project{Name}{Tech Stack}) to prominently feature these JD technologies.
   - If an existing resume project has low relevance to the JD, SWAP it out for a matching Verified GitHub project (e.g., Kanban WorkBoard for Django/Python).
   - Rewrite bullet points in Work Experience and Projects to describe using these technologies in realistic architectural contexts (e.g., "Architected containerized microservices orchestrated via Kubernetes and deployed IaC modules using Terraform...", "Integrated GraphQL API endpoints and SSO authentication pipelines...", "Engineered vector search pipelines using Pinecone vector database...").

CRITICAL INSTRUCTIONS:
0. IMMUTABLE TEMPLATE RULE: You MUST use the exact original LaTeX provided by the user as your base template. DO NOT invent your own generic LaTeX template. DO NOT change the \\documentclass, margins, geometry, packages, custom commands (e.g., \\role, \\project), or any formatting whatsoever. Use the user's provided LaTeX EXACTLY.
1. DO NOT CHANGE ANY LaTeX COMMANDS. Leave ALL macros, brackets, formatting (e.g. \\textbf, \\item, \\begin, \\end, \\vspace, \\hspace, \\href) exactly as they are.
2. MANDATORY SUMMARY TRANSFORMATION (TOP OF RESUME ATS IMPACT):
   - You MUST rewrite the candidate's Professional Summary at the very top of the document to explicitly highlight the primary architectural scope, domain competencies, and scale required by the target Job Description!
   - For example, if the JD asks for "large-scale distributed systems", "data structures & algorithms", and "accessible technologies", your tailored summary MUST explicitly incorporate those competencies (e.g. "Full-stack software engineer with 3+ years of experience architecting large-scale distributed systems and accessible web applications using Java, Python, and TypeScript. Proven track record of optimizing algorithmic complexity, designing high-throughput microservices handling massive scale, and deploying containerized workloads on AWS with robust CI/CD pipelines.").
3. THREE-PILLAR ATS INJECTION (TECH STACK + ARCHITECTURAL COMPETENCIES + OPERATIONAL WORKFLOWS):
   - Pillar 1 (Hard Tools & Tech Stack): Prioritize matching tools from the candidate's Verified Skill Bank. Inject 100% of all required JD tools (e.g. Docker, AWS, Kubernetes, Redis, GraphQL, Terraform/IaC, SSO, Vector DBs, CI/CD, MongoDB, Django) into Technical Skills, project headers, and work experience ecosystems.
   - Pillar 2 (Core Domain & Architectural Competencies - MANDATORY): Top-tier JDs (like Google, Amazon, Microsoft) require high-level engineering concepts such as "Data Structures & Algorithms", "Large-Scale Distributed Systems", "Massive Scale / High Throughput", "Low Latency / Concurrency", "Accessible Technologies (WCAG/a11y)", "Fault Tolerance", or "Security/RBAC". You MUST identify ALL such architectural and domain requirements in the JD and WEAVE THEM DIRECTLY as concrete engineering actions and measurable outcomes inside the Work Experience and Project bullet points!
   - Pillar 3 (Operational Workflows & Responsibilities - MANDATORY): JDs explicitly list operational responsibilities such as "Debugging / Triaging System Issues", "Rigorous Testing / Testability", "Technical Documentation", "Design Reviews", "Code Reviews", and "Core Infrastructure / Developer Platforms". You MUST weave these specific operational workflow terms into at least 2-3 bullet points across Work Experience & Projects (e.g., "Led design reviews and code reviews to improve testability, documentation, and system efficiency...", "Triaged and debugged complex production issues across hardware, network, and service operations...").
   - Examples of weaving Pillar 2 & 3 domain competencies without artificial suffixes:
     * Data Structures & Algorithms: "Refactored core data ingestion pipelines by applying advanced tree/hash data structures and algorithmic complexity optimizations, reducing search latency from O(n) to O(1) and cutting CPU utilization by 40%."
     * Large-Scale Distributed Systems / Massive Scale: "Architected high-throughput distributed microservices on AWS/Kubernetes communicating via asynchronous event queues, sustaining 10k+ concurrent requests at massive scale with 99.99% availability."
     * Accessible Technologies: "Developed responsive, accessible web interfaces adhering to WCAG 2.1 AA standards and ARIA best practices, ensuring seamless screen-reader compatibility and keyboard navigation across all user flows."
     * Operational Workflows (Debugging/Testing/Docs/Reviews): "Triaged and debugged production service issues while conducting rigorous code reviews and design reviews, improving testability, documentation, and system reliability across core team workflows."
4. ABSOLUTE BAN ON LAZY SUFFIXES AND META-COMMENTARY ("DEMONSTRATING EXPERTISE IN..."):
   - NEVER tack on clumsy, artificial suffixes at the end of sentences or bullets! You are STRICTLY BANNED from appending phrases like ", demonstrating expertise in...", ", showcasing proficiency in...", ", demonstrating large-scale system design...", ", showcasing expertise in...", or ", while supporting X".
   - WHY THIS IS BANNED: Appending ", demonstrating expertise in data structures" to an unchanged bullet point is lazy, artificial, and rejected by recruiters and human reviewers.
   - SHOW, DON'T TELL (GENUINE REWRITING REQUIRED): You MUST genuinely rewrite the core engineering action verbs and architectural workflow of the bullet point itself!
   - BAD (LAZY SUFFIX - FORBIDDEN): "Replaced scheduled polling with a webhook pipeline using RabbitMQ, reducing lag from 20 min to 3 min, demonstrating expertise in data structures and algorithms."
   - GOOD (GENUINE ARCHITECTURAL REWRITING - REQUIRED): "Engineered high-throughput webhook event pipelines using RabbitMQ and custom hash-map caching data structures, optimizing algorithmic complexity to cut failure detection latency from 20 min to 3 min."
5. MANDATORY PROJECT TECH STACK & BULLET REWRITING OR PROJECT SWAPPING (ANTI-LINE-WRAP):
   - You MUST update BOTH the Project Tech Stack subtitles/headers (the tools listed next to or under each project name, e.g. in \\project{Name}{Sub}{Tech Stack} or \\textit{Tools}) AND the project bullet points!
   - SMART PROJECT SWAPPING: If an existing resume project has low relevance to the target JD, SWAP/REPLACE that project with the most relevant Verified GitHub Project (e.g. swap an unrelated app for Kanban_WorkBoard if the JD requires Django/Python). Maintain the exact same LaTeX syntax/macro format as the original template.
   - UPDATE TECH STACK SUBTITLES (MAX 3-4 TOOLS): In \\project{Name}{Tech Stack} or \\role{...}{...}{...}, list AT MOST 3-4 primary technologies (max 35-40 characters total for the tech stack portion). NEVER list 7-8 tools on one header line, because it will horizontally collide with the title and wrap across 2 physical lines, ruining the 1-page layout!
   - REWRITE BULLET POINTS: Rewrite the project bullet points to incorporate the JD's required technologies and architectural workflows cleanly.
6. STRICT PURITY OF TECHNICAL SKILLS SECTION (TOOLS ONLY, NO SOFT SKILLS):
   - The comma-separated "Technical Skills" section is reserved EXCLUSIVELY for specific programming languages, frameworks, libraries, databases, cloud platforms, and developer tools (e.g. Java, Python, TypeScript, React, Spring Boot, Django, Docker, PostgreSQL, AWS, Git, gRPC, Redis, Kafka).
   - NEVER put soft engineering concepts, responsibilities, or domain phrases (such as "Code Review", "Debugging", "Data Storage", "System Design", "UI Design", "Mobile Development", "Infrastructure", "Security", "Distributed Computing", "Information Retrieval") into the Technical Skills lists! Those concepts belong exclusively inside Work Experience and Project bullet points as actions and outcomes.
6b. REPLACE IRRELEVANT SKILLS WITH JD SKILLS:
   - Preserve candidate's exact existing skill categories (Languages, Frontend, Backend, Databases, Tools).
   - PRUNE / DROP irrelevant tools from \\section*{Technical Skills} that have zero relevance to the target JD to make room for high-priority JD keywords and verified GitHub skills (e.g. prioritize Django, Python, Docker over unused tools).
   - Place JD-matching skills FIRST in each line.
6c. DEDUPLICATION RULE:
   - A skill MUST ONLY appear in ONE category. Do not list the same skill (e.g., Python, Java) across multiple categories. Pick the single most relevant category for it.
6d. REORDER SKILLS FOR IMPACT:
   - Within each skill category, you MUST reorder the skills so that the JD-aligned/required skills appear FIRST, before the non-JD skills.
7. COHESIVE TECH-STACK REALISM (RESPECT 'OR' LISTS, NO FRANKEN-STACKS):
   - When a Job Description lists multiple alternative technologies separated by "or", slashes, or commas (e.g., "Java, Python, Golang, or C++" or "PostgreSQL/MySQL/MongoDB" or "AWS/GCP/Azure"), DO NOT stuff all of them into the same project or sentence!
   - Every project and work experience role must maintain a cohesive, realistic engineering ecosystem. Do NOT create "Franken-stacks" where incompatible or redundant languages are mashed together in a single bullet point (e.g. DO NOT claim a single web app backend was built with "Java Spring Boot AND C++ parsing utilities" simultaneously!).
   - Pick the ONE or TWO technologies from an "or" list that best match that specific project's primary ecosystem. If you want to showcase a different language or database required by the JD, introduce it in a separate, distinct project or role where that tool makes natural architectural sense (e.g., C++/Python in AI/compute pipelines, Java/Node in web API servers).
8. EVEN SKILL DISTRIBUTION & ARCHITECTURAL SPREADING (DO NOT DUMP EVERYTHING IN ROLE #1 OR PROJECT #1):
   - AVOID FRONT-LOADING: When injecting required JD skills, do NOT dump all of them into the very first Work Experience entry or the very first Project!
   - DISTRIBUTE EQUITABLY: Spread the required keywords, technologies, and architectural concepts evenly across ALL your Work Experience entries and ALL your Project descriptions.
   - MATCH EACH SKILL TO THE MOST RELEVANT PROJECT: Review all available projects and roles before generating. For example, assign backend/database scaling to your SaaS platform project, assign NLP/AI/compute optimizations (like Python/C++) to your AI pipeline project, and assign real-time/networking skills to your websocket project. Every single project and role should showcase 2-3 distinct, relevant JD competencies rather than overloading one project with 10 skills!
9. MAINTAIN CLEAN STRUCTURE: Keep the standard resume density (typically 2-3 projects and 3-4 bullets per role/project). If swapping a project with a GitHub project, keep the same number of project items as the original template.
10. **STRICT 1-PAGE GUARANTEE (CRITICAL: VISUAL LINE BUDGET & COMPACTNESS)**:
    - The original input document has exactly ${latexLength} characters and fits on EXACTLY 1 PAGE.
    - LaTeX vertical height is strictly governed by VISUAL LINE WRAPPING. To guarantee the document NEVER overflows onto a 2nd page:
      a) **SKILLS MUST BE 1 LINE PER CATEGORY**: Keep the EXACT same number of category lines as the original template (e.g. 4-5 lines max). Each line must contain max 4-5 tools (max 50-60 characters total) so it NEVER wraps onto a 2nd line!
      b) **PROJECT HEADERS MUST BE 1 LINE**: Tech stack subtitles (e.g. \\project{Name}{Tech Stack}) must contain at most 3-4 core tools (max 35-40 chars) so the header fits on 1 physical line without wrapping.
      c) **COMPACT PUNCHY BULLETS (STRICT LINE BUDGET)**:
         * Single-line bullets: MUST be 70-85 characters max. Never expand a 1-line bullet into 2 lines!
         * Two-line bullets: MUST be 140-160 characters max. Never expand a 2-line bullet into 3 lines!
      d) **SUMMARY BUDGET**: Keep the professional summary strictly to 3 compact lines (~50-65 words).
      e) **TARGET CHARACTER BUDGET**: Produce a tailored LaTeX of ~${Math.round(latexLength * 0.85)} to ${Math.round(latexLength * 0.89)} characters (Target: ~${Math.round(latexLength * 0.88)} characters). Outputting more than ${Math.round(latexLength * 0.90)} characters will cause page overflow!
    - ZERO SPACING / PREAMBLE ALTERATION: DO NOT insert extra \\vspace, do NOT add blank lines between items, do NOT insert extra newlines, do NOT alter preamble, line spreads, margins, or fonts. ONLY update textual content.
11. DO NOT use raw '<' or '>' symbols (e.g. "< 3 min", "> 90 ms") or naked math commands in plain text. Always write plain English words like "under 3 min", "over 90 ms", "to". Raw '<' renders as Spanish inverted exclamation mark '¡' in LaTeX! ALWAYS escape '%' signs as '\\%' (e.g., "25\\%" instead of "25%"), otherwise LaTeX will treat it as a comment and truncate the line!
12. NEVER use \\newcommand for commands that already exist in standard LaTeX (such as \\section, \\subsection, \\item, \\textbf). Leave existing section definitions untouched or use \\renewcommand.
13. Return ONLY the raw tailored LaTeX string. Do NOT wrap it in markdown code blocks (\`\`\`latex ... \`\`\`). Do NOT include any explanations or prose before or after. Start immediately with the first LaTeX character and end with the last LaTeX character.
14. NEVER use placeholders, ellipses (...), or comments like "(unchanged)" or "(rest of document remains same)". You MUST output the full, complete, compilable LaTeX document from \\documentclass to \\end{document} without missing or skipping any section.
15. PRESERVE VERTICAL SPACING & PREAMBLE: DO NOT modify the LaTeX preamble (everything before \\begin{document}). Leave all \\titlespacing, \\documentclass, \\usepackage, and custom command definitions EXACTLY as they were pasted. NEVER remove any \\vspace, \\vspace*, \\hspace, \\medskip, \\smallskip, or blank lines between sections. Ensure proper vertical spacing is maintained exactly as provided in the original input!${skillBankInstruction}`;

    const userMessage = `TARGET JOB DESCRIPTION & REQUIREMENTS:
${rawJdText && rawJdText.length < 2000 ? `RAW JOB DESCRIPTION:\n${rawJdText}\n\n` : ""}STRUCTURED JD REQUIREMENTS SUMMARY:
${JSON.stringify(jdData, null, 2)}
${selectedSkills.length > 0 ? `\nVERIFIED CANDIDATE GITHUB SKILL BANK (SMART RELEVANT LOOKUP):\n${JSON.stringify({ skills: selectedSkills, projects: selectedProjects }, null, 2)}` : ""}

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
            const maxAllowedBudget = Math.round(latexLength * 0.90);

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
              currentSystemPrompt = systemPrompt + `\n\nCRITICAL 1-PAGE OVERFLOW WARNING (ATTEMPT ${attempt + 1}/${maxAttempts}): Your generated LaTeX was ${latexResult.length} characters long, which is ${excess} characters over the strict 1-page budget (${maxAllowedBudget} chars). To ensure the resume fits on EXACTLY 1 page without spilling onto page 2:
1. Keep the EXACT same skill category headers and count as the original template (do NOT create new category rows).
2. Limit each skill line to max 4-5 core tools (max 50-60 chars per line).
3. Limit project tech stack subtitles to max 3-4 tools (max 35 chars) so headers never wrap.
4. Keep all single-line bullets under 85 characters.
You MUST shorten your response to ~${Math.round(latexLength * 0.86)} characters.`;
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

            const result: TailoredResult = {
              modelId: model.id,
              modelName: model.name,
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
            const errorResult: TailoredResult = {
              modelId: model.id,
              modelName: model.name,
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

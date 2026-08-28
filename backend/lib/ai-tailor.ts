import { callLLM, callFastLLM, extractJSON } from "./llm-client";
import type { ResumeData, JDData, TailoredResult, TailoredChange, ScoreResult, ExperienceEntry, ProjectEntry, SkillsData, ModelSelection } from "./types";
import { sanitizeMissingKeywords } from "./skill-bank";

function ensureNewestFirst(resume: ResumeData) {
  if (!resume.experience || resume.experience.length < 2) return;
  
  const getYear = (duration: string): number => {
    const match = duration.match(/\b(20\d{2}|19\d{2})\b/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const firstYear = getYear(resume.experience[0].duration || "");
  const lastYear = getYear(resume.experience[resume.experience.length - 1].duration || "");

  if (firstYear > 0 && lastYear > 0 && firstYear < lastYear) {
    resume.experience.reverse();
    if (resume.projects) {
      resume.projects.reverse();
    }
  }
}

/**
 * Extract candidate full name from raw LaTeX source code via regex patterns.
 */
export function extractNameFromLatex(text: string): string | null {
  if (!text) return null;

  const clean = (str: string) => {
    if (!str) return "";
    return str
      .replace(/\\(?:textbf|textit|textnormal|mbox|small|large|Large|LARGE|huge|Huge|scshape|bfseries|itshape|selectfont|fontsize|sc|bf)\s*\{?([^}]*)\}?/gi, "$1")
      .replace(/\\[a-zA-Z]+/g, " ")
      .replace(/[\{\}\[\]\\]/g, " ")
      .replace(/[^a-zA-Z0-9\s\.\-']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const isValidName = (name: string) => {
    if (!name || name.length < 2 || name.length > 50) return false;
    const lower = name.toLowerCase();
    if (lower.includes("documentclass") || lower.includes("usepackage") || lower.includes("begin") || lower.includes("resume") || lower.includes("curriculum") || lower.includes("vitae") || lower.includes("experience") || lower.includes("education")) {
      return false;
    }
    return /[a-zA-Z]/.test(name);
  };

  // 1. \name{First}{Last}
  const nameTwoArgsMatch = text.match(/\\name\s*\{([^}]+)\}\s*\{([^}]+)\}/i);
  if (nameTwoArgsMatch) {
    const res = clean(`${nameTwoArgsMatch[1]} ${nameTwoArgsMatch[2]}`);
    if (isValidName(res)) return res;
  }

  // 1b. \firstname{First}\familyname{Last} or \firstname{First} \lastname{Last}
  const firstLastMatch = text.match(/\\(?:first|given)name\s*\{([^}]+)\}[\s\S]*?\\(?:family|last)name\s*\{([^}]+)\}/i);
  if (firstLastMatch) {
    const res = clean(`${firstLastMatch[1]} ${firstLastMatch[2]}`);
    if (isValidName(res)) return res;
  }

  // 1c. \namesection{First}{Last}{...}
  const nameSectionMatch = text.match(/\\namesection\s*\{([^}]+)\}\s*\{([^}]+)\}/i);
  if (nameSectionMatch) {
    const res = clean(`${nameSectionMatch[1]} ${nameSectionMatch[2]}`);
    if (isValidName(res)) return res;
  }

  // 2. Explicit macro definitions: \name{...}, \author{...}, \fullname{...}, \cvname{...}, \candidate{...}
  const explicitMacroMatch = text.match(/\\(?:name|author|fullname|cvname|candidate|profileName)\s*\{([^}]+)\}/i);
  if (explicitMacroMatch) {
    const res = clean(explicitMacroMatch[1]);
    if (isValidName(res)) return res;
  }

  // 3. \newcommand{\name}{Full Name} or \newcommand{\myname}{Full Name}
  const newcmdMatch = text.match(/\\newcommand\s*\{\s*\\(?:my)?name\s*\}\s*\{([^}]+)\}/i);
  if (newcmdMatch) {
    const res = clean(newcmdMatch[1]);
    if (isValidName(res)) return res;
  }

  // 4. \header{Full Name}{...}
  const headerMatch = text.match(/\\header\s*\{([^}]+)\}/i);
  if (headerMatch) {
    const res = clean(headerMatch[1]);
    if (isValidName(res)) return res;
  }

  // 5. Look inside the first header/center block of \begin{document}
  const docBodyIdx = text.indexOf("\\begin{document}");
  const searchArea = docBodyIdx !== -1 ? text.substring(docBodyIdx, docBodyIdx + 2000) : text;

  // 5a. \textbf{\Huge ...} or \textbf{\LARGE ...} or \textbf{\Large ...}
  const textbfHugeMatch = searchArea.match(/\\textbf\s*\{\s*\\(?:Huge|huge|LARGE|Large|large)\s*(?:\\scshape\s*)?\{?([^\\\}]+)\}?\s*\}/i);
  if (textbfHugeMatch) {
    const res = clean(textbfHugeMatch[1]);
    if (isValidName(res)) return res;
  }

  // 5b. {\Huge\textbf{...}} or {\LARGE\textbf{...}} or {\Huge ...} or {\LARGE ...}
  const hugeTextbfMatch = searchArea.match(/\{\s*\\(?:Huge|huge|LARGE|Large|large)\s*(?:\\(?:textbf|scshape|bfseries)\s*\{?|\s+)([^\\\}]+)\}?\s*\}/i);
  if (hugeTextbfMatch) {
    const res = clean(hugeTextbfMatch[1]);
    if (isValidName(res)) return res;
  }

  // 5c. {\Huge \scshape Name} or {\LARGE Name}
  const hugeGeneralMatch = searchArea.match(/\{\s*\\(?:Huge|huge|LARGE|Large)\s+([^}\\\n]+)\}/i);
  if (hugeGeneralMatch) {
    const res = clean(hugeGeneralMatch[1]);
    if (isValidName(res)) return res;
  }

  // 5d. \begin{center} ... \textbf{Full Name} \\ or {\LARGE ...}
  const centerMatch = searchArea.match(/\\begin\{center\}\s*\\(?:textbf|Huge|LARGE|Large)\s*(?:\{|\s+)([^\\\}\n]+)(?:\}|\s*\\\\)/i);
  if (centerMatch) {
    const res = clean(centerMatch[1]);
    if (isValidName(res)) return res;
  }

  // 5e. \begin{center}\s*{\s*([^}\n]+)\s*}
  const centerBraceMatch = searchArea.match(/\\begin\{center\}\s*\{+([^\\\}\n]{3,40})\}+/i);
  if (centerBraceMatch) {
    const res = clean(centerBraceMatch[1]);
    if (isValidName(res)) return res;
  }

  return null;
}

export function cleanLatexName(name: string): string {
  if (!name) return "";
  return name
    .replace(/\\(?:name|author|fullname|textbf|textit|textnormal|mbox|small|large|Large|LARGE|huge|Huge|scshape)\s*\{([^}]*)\}/gi, "$1")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/[\{\}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * AI-assisted parse of raw resume text into structured ResumeData JSON.
 */
export async function parseResumeWithAI(rawText: string, modelSelection?: ModelSelection): Promise<ResumeData> {
  const systemPrompt = `You are an expert resume parsing assistant.
Your task is to take raw text from a resume and convert it into a structured JSON object according to the specified schema.
Extract all details accurately. Do not invent details.

CRITICAL, MANDATORY INSTRUCTIONS:
1. You MUST extract EVERY SINGLE job, project, skill, and bullet point from the original text.
2. DO NOT reorganize or sort the experience or projects. Keep them in the EXACT SAME ORDER as they appear in the original text.
3. DO NOT extract bullet points as standalone projects.
4. DO NOT SUMMARIZE. DO NOT SHORTEN. DO NOT OMIT ANYTHING. 
5. Missing even a single bullet point or project will cause a critical system failure.
6. For all textual fields (summary, highlights, descriptions), copy the exact verbatim text character-for-character.
7. If the resume text is in LaTeX format (e.g. containing \\documentclass, \\name{...}, \\author{...}), parse and extract the candidate's actual full name without LaTeX macros or backslashes.

Return ONLY a valid JSON object matching this exact structure (no markdown wrapper, no prose):
{
  "name": "Extract candidate full name",
  "title": "Extract professional title (e.g. Software Engineer, Product Manager). If not explicit, infer from experience.",
  "contact": {
    "email": "Email address or empty string",
    "phone": "Phone number or empty string",
    "linkedin": "LinkedIn profile URL or username or empty string",
    "github": "GitHub profile URL or username or empty string",
    "website": "Personal portfolio/website URL or empty string",
    "location": "City, State or City, Country or empty string"
  },
  "summary": "Professional summary or objective. MUST extract this verbatim from the text. Do not rephrase, summarize, or rewrite.",
  "experience": [
    {
      "role": "Job title / role",
      "company": "Company/organization name",
      "duration": "Dates (e.g., Jun 2021 - Present)",
      "location": "Location or empty string",
      "scope": "Short summary of scope/impact (e.g. 'Solo-built and operating...'). Extract verbatim if present, else empty string.",
      "highlights": [
        "Bullet point 1. Extract verbatim. Do not rewrite, modify, or merge."
      ]
    }
  ],
  "education": [
    {
      "degree": "Degree (e.g., B.S. Computer Science)",
      "institution": "Institution name",
      "year": "Year of graduation (e.g., 2021)",
      "gpa": "GPA if present, else empty string"
    }
  ],
  "skills": {
    "Category Name (Extract all skill categories exactly as they appear in the resume, e.g. 'Payments & Billing', 'Languages', 'AI & LLM')": ["Skill names in this category"]
  },
  "certifications": ["Certification names"],
  "projects": [
    {
      "name": "Project name",
      "description": "Short description. Extract verbatim.",
      "tech": ["React", "TypeScript"],
      "highlights": [
        "Highlight bullet point 1. Extract verbatim."
      ]
    }
  ],
  "achievements": ["Major awards, achievements, or publications"]
}

CRITICAL REMINDER: You will be penalized if you drop any experience bullet points, leave out any projects, or summarize any text. The output array lengths must match the number of items in the raw text exactly.
`;

  try {
    // We use the user's selected model if provided, otherwise default to a highly capable model
    // for the initial PDF text extraction. Note: some models like Cerebras might hallucinate here.
    const response = await callLLM({
      systemPrompt,
      userMessage: `Resume text:\n${rawText}`,
      modelSelection,
    });

    const jsonStr = extractJSON(response.content);
    // Fix invalid JSON escape sequences from LaTeX content (e.g. \textbf → \\textbf)
    const sanitized = jsonStr.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
    const resume = JSON.parse(sanitized) as ResumeData;

    // Fallback LaTeX candidate name extraction & cleaning
    if (!resume.name || resume.name.trim() === "" || resume.name.includes("\\")) {
      const extractedName = extractNameFromLatex(rawText);
      if (extractedName) {
        resume.name = extractedName;
      }
    }
    if (resume.name) {
      resume.name = cleanLatexName(resume.name);
    }

    ensureNewestFirst(resume);
    return resume;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse resume with AI: ${msg}`);
  }
}

/**
 * AI-assisted parse of Job Description text into structured JDData JSON.
 */
export async function parseJDWithAI(rawText: string, modelSelection?: ModelSelection): Promise<JDData> {
  const systemPrompt = `You are an expert job description parsing assistant.
Your task is to take raw text from a Job Description (JD) and perform an EXHAUSTIVE extraction of ALL technical requirements, programming languages, tools, domain competencies, and responsibilities into a structured JSON object.

CRITICAL INSTRUCTION: Extract every programming language (e.g., Java, Python, Golang, C#, C++, JavaScript, TypeScript), framework, database, cloud tool, container platform, and core technical requirement. For keywords, extract specific architectural paradigms (e.g. Distributed Systems, High Throughput, Concurrency, Microservices, CI/CD, Large-Scale System Design, Security) rather than generic text fragments. Do NOT summarize or leave out details.

Return ONLY a valid JSON object matching this exact structure (no markdown wrapper, no prose):
{
  "jobTitle": "Job Title",
  "company": "Company name if present, else empty string",
  "mustHaveSkills": ["EVERY programming language, framework, database, tool, or mandatory technical skill mentioned in minimum or core qualifications"],
  "niceToHaveSkills": ["Desired or preferred skills, degrees, or optional qualifications"],
  "responsibilities": ["List of core engineering responsibilities, architecture workflows, and system ownership"],
  "keywords": ["List of domain & architectural concepts, e.g. Distributed Systems, High Throughput, Microservices, Concurrency, CI/CD, Cloud Architecture, Query Optimization, Security"]
}
`;

  try {
    const response = await callFastLLM({
      systemPrompt,
      userMessage: `Job Description:\n${rawText}`,
      modelSelection: { primaryModel: "groq:openai/gpt-oss-120b" },
      maxTokens: 2048,
    });

    const jsonStr = extractJSON(response.content);
    return JSON.parse(jsonStr) as JDData;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse job description with AI: ${msg}`);
  }
}

/**
 * Generates a list of individual changes by diffing original vs tailored resume.
 * Each change has a unique id, section, field path, label, and original/new values.
 */
function generateChanges(
  original: ResumeData,
  tailored: ResumeData
): TailoredChange[] {
  const changes: TailoredChange[] = [];
  let counter = 0;

  const addChange = (
    section: string,
    field: string,
    label: string,
    originalValue: string,
    newValue: string
  ) => {
    if (originalValue.trim() !== newValue.trim()) {
      counter++;
      changes.push({
        id: `change-${counter}`,
        section,
        field,
        label,
        originalValue,
        newValue,
        status: "pending",
      });
    }
  };

  // Title
  addChange("title", "title", "Professional Title", original.title || "", tailored.title || "");

  // Summary
  addChange("summary", "summary", "Professional Summary", original.summary || "", tailored.summary || "");

  // Experience — compare each job's highlights individually
  const maxExp = Math.max(original.experience?.length || 0, tailored.experience?.length || 0);
  for (let i = 0; i < maxExp; i++) {
    const origJob = original.experience?.[i];
    const tailJob = tailored.experience?.[i];
    if (!origJob || !tailJob) continue;

    const maxBullets = Math.min(origJob.highlights?.length || 0, tailJob.highlights?.length || 0);
    for (let j = 0; j < maxBullets; j++) {
      const origBullet = origJob.highlights?.[j] || "";
      const tailBullet = tailJob.highlights?.[j] || "";
      addChange(
        "experience",
        `experience[${i}].highlights[${j}]`,
        `${origJob.role} at ${origJob.company} — Bullet ${j + 1}`,
        origBullet,
        tailBullet
      );
    }
  }

  // Projects — compare each project's description and highlights
  const maxProj = Math.max(original.projects?.length || 0, tailored.projects?.length || 0);
  for (let i = 0; i < maxProj; i++) {
    const origProj = original.projects?.[i];
    const tailProj = tailored.projects?.[i];
    if (!origProj || !tailProj) continue;

    addChange(
      "projects",
      `projects[${i}].description`,
      `${origProj.name} — Description`,
      origProj.description || "",
      tailProj.description || ""
    );

    // Diff project tech stacks
    const origTech = (origProj.tech || []).join(", ");
    const tailTech = (tailProj.tech || []).join(", ");
    addChange(
      "projects",
      `projects[${i}].tech`,
      `${origProj.name} — Tech Stack`,
      origTech,
      tailTech
    );

    const maxProjBullets = Math.min(origProj.highlights?.length || 0, tailProj.highlights?.length || 0);
    for (let j = 0; j < maxProjBullets; j++) {
      const origBullet = origProj.highlights?.[j] || "";
      const tailBullet = tailProj.highlights?.[j] || "";
      addChange(
        "projects",
        `projects[${i}].highlights[${j}]`,
        `${origProj.name} — Bullet ${j + 1}`,
        origBullet,
        tailBullet
      );
    }
  }

  // Skills — compare ALL categories dynamically as joined strings
  if (original.skills && tailored.skills) {
    const allKeys = new Set([
      ...Object.keys(original.skills),
      ...Object.keys(tailored.skills)
    ]);

    for (const key of allKeys) {
      const origVal = ((original.skills as Record<string, string[]>)[key] || []).join(", ");
      const tailVal = ((tailored.skills as Record<string, string[]>)[key] || []).join(", ");
      addChange("skills", `skills.${key}`, `Skills — ${key}`, origVal, tailVal);
    }
  }

  return changes;
}

 /**
 * AI Tailor Logic: Scores the resume against the JD (Fast).
 */
export async function scoreResumeWithAI(
  resume: ResumeData,
  jd: JDData,
  modelSelection?: ModelSelection
): Promise<ScoreResult> {
  const systemPrompt = `You are an expert ATS (Applicant Tracking System) specialist.
Your goal is to evaluate a candidate's resume against a Job Description (JD).

CRITICAL KEYWORD RULE:
- Do NOT list version-specific variants (e.g., "Java 8", "Java 17", "Java 21", "Python 3") in "missingKeywords" if the core base skill/technology (e.g. "Java", "Python") is already present/matched in the candidate's resume.

Return ONLY a valid JSON object matching this exact structure:
{
  "atsScore": "Estimate a realistic ATS score (0-100)",
  "scoreReasoning": "Brief constructive reasoning for the score",
  "matchedKeywords": ["Keywords from JD present in resume"],
  "missingKeywords": ["Keywords from JD missing from resume"]
}
`;

  try {
    const response = await callLLM({
      systemPrompt,
      userMessage: `Job Description:\n${JSON.stringify(jd)}\n\nCandidate Resume:\n${JSON.stringify(resume)}`,
      modelSelection,
    });

    const jsonStr = extractJSON(response.content);
    const parsed = JSON.parse(jsonStr) as ScoreResult;
    const matched = Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords : [];
    const missing = Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [];
    const sanitizedMissing = sanitizeMissingKeywords(missing, matched);

    return {
      ...parsed,
      matchedKeywords: matched,
      missingKeywords: sanitizedMissing,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to score resume: ${msg}`);
  }
}

/**
 * AI Tailor Logic: Rewrites the Summary section.
 */
export async function tailorSummaryWithAI(
  summary: string,
  jd: JDData,
  modelSelection?: ModelSelection
): Promise<{ summary: string }> {
  const systemPrompt = `You are an expert resume optimizer and senior technical recruiter. Rewrite the candidate's Professional Summary to align with the target role and key JD requirements.
CRITICAL SAFETY & PHRASING RULES:
1. NEVER invent experience, degrees, or false credentials.
2. Keep it targeted, concise, and professional (strictly 3-4 lines, 50-65 words).
3. TARGETED STACK FOCUS: Focus sharply on the primary tech stack and domain relevant to the target role. Do NOT list 6 competing backend ecosystems or 3 cloud providers in a single sentence.
4. Highlight technical depth, API architecture, high throughput, and end-to-end engineering ownership.

Return ONLY a valid JSON object matching this exact structure:
{
  "summary": "Tailored professional summary"
}
`;

  const response = await callLLM({
    systemPrompt,
    userMessage: `Job Description:\n${JSON.stringify(jd)}\n\nOriginal Summary:\n${summary}`,
    modelSelection,
  });

  return JSON.parse(extractJSON(response.content));
}

/**
 * AI Tailor Logic: Rewrites the Experience section.
 */
export async function tailorExperienceWithAI(
  experience: ExperienceEntry[],
  jd: JDData,
  modelSelection?: ModelSelection
): Promise<{ experience: ExperienceEntry[] }> {
  const mustHave = Array.isArray(jd.mustHaveSkills) ? jd.mustHaveSkills : [];
  const niceToHave = Array.isArray(jd.niceToHaveSkills) ? jd.niceToHaveSkills : [];
  const keywords = Array.isArray(jd.keywords) ? jd.keywords : [];
  const allJdRequirements = Array.from(new Set([...mustHave, ...niceToHave, ...keywords])).filter(Boolean);

  const systemPrompt = `You are an expert technical recruiter and senior software engineer. Rewrite the candidate's Work Experience bullet points to align deeply with the target Job Description while maintaining senior-level credibility.

CRITICAL MANDATORY INSTRUCTIONS:
1. ABSOLUTE BAN ON ROBOTIC / META PHRASING:
   - NEVER write meta-descriptions like "applied Data Structures, Algorithms for...", "conducted task estimation", "practiced Agile/Scrum ceremonies", "demonstrating OOPS", or list software concepts as awkward trailing clauses.
   - Express engineering depth through authentic technical actions, concrete architecture, and measurable outcomes (e.g. "Optimized high-traffic query latency from 850ms to 550ms by adding composite indexing and query caching", "Architected idempotent webhook event pipeline cutting failure detection from 20m to 3m").

2. CAREER CREDIBILITY & ARCHITECTURAL REALISM:
   - Keep historical company work authentic. Do NOT completely swap the core language/database of established past employers (e.g., do not turn a past Node.js/Postgres startup job into ASP.NET/SQL Server).
   - Align past company roles by highlighting transferable senior engineering patterns: API latency, microservices, cloud infrastructure, containerization, concurrency, CI/CD pipelines, automated testing, security, and schema optimization.
   - For Founder / SaaS / Contract roles where candidate had full ownership (e.g. Chintu AI), actively showcase relevant target JD architectures and technologies.

3. ARCHITECTURAL REALISM (NO COMPETING BACKEND SLASH-MIXING):
   - NEVER mix competing backend technologies in the same sentence or bullet point (e.g., NEVER write "Java Spring Boot / C# .Net services"). Allocate different services/roles to their respective stacks.

4. PRESERVE STRUCTURE & LENGTH:
   - DO NOT reorder jobs. Preserve the exact same number of bullet points in the "highlights" array as the original.
   - Keep character length/word count of each tailored bullet point within +/- 15% of the original bullet point.
   - ABSOLUTE BAN ON LAZY SUFFIXES: Do NOT append lazy suffixes like ", demonstrating expertise in...". Truly rewrite the engineering action verbs.

Return ONLY a valid JSON object matching this exact structure:
{
  "experience": [
    {
      "role": "Same role as original",
      "company": "Same company as original",
      "duration": "Same duration",
      "location": "Same location",
      "scope": "Same scope as original",
      "highlights": [
        "Tailored bullet point 1",
        "Tailored bullet point 2"
      ]
    }
  ]
}
`;

  const response = await callLLM({
    systemPrompt,
    userMessage: `TARGET JD REQUIREMENTS CHECKLIST TO INJECT:\n${allJdRequirements.map(s => `- ${s}`).join("\n")}\n\nFull Job Description:\n${JSON.stringify(jd)}\n\nOriginal Experience:\n${JSON.stringify(experience)}`,
    modelSelection,
  });

  return JSON.parse(extractJSON(response.content));
}

/**
 * AI Tailor Logic: Rewrites the Projects section.
 */
export async function tailorProjectsWithAI(
  projects: ProjectEntry[],
  jd: JDData,
  modelSelection?: ModelSelection
): Promise<{ projects: ProjectEntry[] }> {
  const mustHave = Array.isArray(jd.mustHaveSkills) ? jd.mustHaveSkills : [];
  const niceToHave = Array.isArray(jd.niceToHaveSkills) ? jd.niceToHaveSkills : [];
  const keywords = Array.isArray(jd.keywords) ? jd.keywords : [];
  const allJdRequirements = Array.from(new Set([...mustHave, ...niceToHave, ...keywords])).filter(Boolean);

  const systemPrompt = `You are an expert resume optimizer and senior software engineer. Rewrite the candidate's Projects section to align deeply with the target JD.

CRITICAL MANDATORY RULES:
1. TARGET JD TECH INJECTION: In project "tech" arrays, showcase target JD technologies (e.g. GraphQL, Kubernetes, Java, Spring Boot, C#, .NET Core, PostgreSQL, Docker, AWS).
2. EXPLICIT BASE LANGUAGE PAIRING (CRITICAL FOR ATS):
   - Whenever featuring a backend framework (e.g. Django, FastAPI, Flask, Spring Boot, .NET Core), ALWAYS explicitly include the foundational programming language if required by the JD (e.g. write "Python, Django REST Framework, PostgreSQL, React, Docker" or "Java, Spring Boot", NEVER omit "Python" or "Java" when using its framework).
   - In project bullet points, explicitly state the language + framework (e.g. "React frontend and Python/Django REST Framework backend...").
3. STRICT ARCHITECTURAL REALISM & COHERENT STACKS:
   - NEVER mix competing backend frameworks in the SAME project (e.g., NEVER write "Java Spring Boot / C# .Net REST APIs").
   - A single project MUST use ONE coherent, realistic stack!
   - If the target JD requires multiple technologies (e.g. Java, C#, Node.js, Python), DISTRIBUTE them across different projects in the resume.
4. Limit each project's "tech" array to strictly 4-5 core technologies.
5. GITHUB SKILL BANK DYNAMIC SWAPPING: You may swap out any low-relevance project with any matching verified project from the candidate's GitHub Skill Bank.
6. In project bullet points: describe realistic technical actions (e.g., designing GraphQL queries/mutations, deploying containerized pods in Kubernetes, building RESTful microservices, query tuning).
7. BAN ON ROBOTIC PHRASING: Never write "applied Data Structures, Algorithms" or similar meta-phrases. Express depth through real features.
8. Preserve the exact same number of bullet points in the "highlights" array. Keep character length within +/- 15% of original.

Return ONLY a valid JSON object matching this exact structure:
{
  "projects": [
    {
      "name": "Same project name",
      "description": "Tailored description",
      "tech": ["Top JD skills and relevant technologies (max 5)"],
      "highlights": [
        "Tailored bullet point 1"
      ]
    }
  ]
}
`;

  const response = await callLLM({
    systemPrompt,
    userMessage: `TARGET JD REQUIREMENTS CHECKLIST TO INJECT:\n${allJdRequirements.map(s => `- ${s}`).join("\n")}\n\nFull Job Description:\n${JSON.stringify(jd)}\n\nOriginal Projects:\n${JSON.stringify(projects)}`,
    modelSelection,
  });

  return JSON.parse(extractJSON(response.content));
}

/**
 * AI Tailor Logic: Filters the Skills section.
 */
export async function tailorSkillsWithAI(
  skills: SkillsData,
  jd: JDData,
  modelSelection?: ModelSelection
): Promise<{ skills: SkillsData }> {
  const mustHave = Array.isArray(jd.mustHaveSkills) ? jd.mustHaveSkills : [];
  const niceToHave = Array.isArray(jd.niceToHaveSkills) ? jd.niceToHaveSkills : [];
  const keywords = Array.isArray(jd.keywords) ? jd.keywords : [];
  const allJdRequirements = Array.from(new Set([...mustHave, ...niceToHave, ...keywords])).filter(Boolean);

  const systemPrompt = `You are an expert resume optimizer. Reorder and refine the candidate's Skills section to match the target Job Description while keeping it sharp and credible.

CRITICAL MANDATORY RULES:
1. LOGICAL CATEGORY PLACEMENT: Place skills into their proper logical categories:
   - Languages: Java, C#, TypeScript, JavaScript, Python, C/C++, SQL
   - Backend: Spring Boot, .NET Core, Node.js, Express.js, GraphQL, REST APIs, Microservices
   - Frontend: React.js, Next.js, Angular, HTML5, CSS3, Redux
   - Cloud & DevOps: Kubernetes, Docker, AWS, Azure, GCP, CI/CD, GitHub Actions, Git
   - Databases: PostgreSQL, MongoDB, MySQL, SQL Server, Redis, Query Optimization
   - Core Concepts: Distributed Systems, High Throughput, Concurrency, Large-Scale Design, Security
2. JD SKILLS FIRST: Within each skill category, place JD-matching skills at the VERY BEGINNING.
3. AVOID KITCHEN-SINK BLOAT: Limit each category strictly to 5 to 6 highly relevant skills to keep the resume clean and credible. Do not dump every possible language or framework.
4. MODERN AI & TOOLS: If including AI or developer tooling, use professional category names (e.g. "AI & LLM Integration: OpenAI API, LangChain, Prompt Engineering, Vector Search" or "Developer Tools: Git, Docker, Postman, Linux") rather than listing IDE plugins as core standalone categories.
5. DEDUPLICATION RULE: A skill MUST ONLY appear in ONE category.

Return ONLY a valid JSON object matching this exact structure:
{
  "skills": {
    "<Category Name>": ["JD-matching skills first, followed by candidate's core skills", "max 6 total"]
  }
}
`;

  const response = await callLLM({
    systemPrompt,
    userMessage: `TARGET JD REQUIREMENTS CHECKLIST TO INJECT:\n${allJdRequirements.map(s => `- ${s}`).join("\n")}\n\nFull Job Description:\n${JSON.stringify(jd)}\n\nOriginal Skills:\n${JSON.stringify(skills)}`,
    modelSelection,
  });

  return JSON.parse(extractJSON(response.content));
}

/**
 * AI Tailor Logic: Rewrites resume sections to align with Job Description.
 * Rule: NEVER invent experience, titles, companies, dates, or degrees.
 */
export async function tailorResume(
  resume: ResumeData,
  jd: JDData,
  modelSelection?: ModelSelection
): Promise<TailoredResult> {
  try {
    console.log(`[tailor] Starting modular/batched tailoring pipeline in parallel...`);

    // Run tailoring steps in parallel using Promise.all for maximum speed
    const [tailoredSummaryObj, tailoredExperienceObj, tailoredProjectsObj, tailoredSkillsObj] = await Promise.all([
      tailorSummaryWithAI(resume.summary || "", jd, modelSelection),
      tailorExperienceWithAI(resume.experience || [], jd, modelSelection),
      tailorProjectsWithAI(resume.projects || [], jd, modelSelection),
      tailorSkillsWithAI(resume.skills || {}, jd, modelSelection),
    ]);

    // Programmatically align and reconstruct the tailored resume using original skeleton to prevent structural deletions/shuffling
    const tailoredResume: ResumeData = {
      ...resume,
      title: resume.title, // Keep original title
      summary: tailoredSummaryObj.summary,
      experience: (resume.experience || []).map((origExp, i) => {
        // Robust matching: check index-to-index first if lengths match, fallback to fuzzy search
        const matchedExp = (tailoredExperienceObj.experience?.length === resume.experience?.length)
          ? tailoredExperienceObj.experience?.[i]
          : tailoredExperienceObj.experience?.find(
              e => (e.company && origExp.company && (e.company.toLowerCase().includes(origExp.company.toLowerCase()) || origExp.company.toLowerCase().includes(e.company.toLowerCase()))) || 
                   (e.role && origExp.role && (e.role.toLowerCase().includes(origExp.role.toLowerCase()) || origExp.role.toLowerCase().includes(e.role.toLowerCase())))
            );

        const highlights = (origExp.highlights || []).map((origHl, hlIndex) => {
          const tailoredHl = matchedExp?.highlights?.[hlIndex];
          return (tailoredHl && tailoredHl.trim().length > 0) ? tailoredHl : origHl;
        });

        return {
          ...origExp,
          scope: matchedExp?.scope || origExp.scope,
          highlights,
        };
      }),
      projects: (resume.projects || []).map((origProj, i) => {
        // Robust matching: check index-to-index first if lengths match, fallback to fuzzy search
        const matchedProj = (tailoredProjectsObj.projects?.length === resume.projects?.length)
          ? tailoredProjectsObj.projects?.[i]
          : tailoredProjectsObj.projects?.find(
              p => p.name && origProj.name && (p.name.toLowerCase().includes(origProj.name.toLowerCase()) || origProj.name.toLowerCase().includes(p.name.toLowerCase()))
            );

        const highlights = (origProj.highlights || []).map((origHl, hlIndex) => {
          const tailoredHl = matchedProj?.highlights?.[hlIndex];
          return (tailoredHl && tailoredHl.trim().length > 0) ? tailoredHl : origHl;
        });

        return {
          ...origProj,
          description: matchedProj?.description || origProj.description,
          tech: (matchedProj?.tech && Array.isArray(matchedProj.tech) && matchedProj.tech.length > 0)
            ? matchedProj.tech
            : origProj.tech,
          highlights,
        };
      }),
      skills: (() => {
        const finalSkills: Record<string, string[]> = {};
        const rawSkills = (tailoredSkillsObj.skills || {}) as Record<string, string[]>;
        const seenSkills = new Set<string>();
        
        const cleanList = (list: string[]) => {
          const unique: string[] = [];
          for (const item of list) {
            const normalized = item.trim().toLowerCase();
            if (normalized && !seenSkills.has(normalized)) {
              seenSkills.add(normalized);
              unique.push(item.trim());
            }
            if (unique.length >= 6) break;
          }
          return unique;
        };

        if (Object.keys(rawSkills).length > 0) {
          Object.entries(rawSkills).forEach(([category, list]) => {
            if (Array.isArray(list) && list.length > 0) {
              const cleaned = cleanList(list);
              if (cleaned.length > 0) {
                finalSkills[category] = cleaned;
              }
            }
          });
        } else {
          Object.entries(resume.skills || {}).forEach(([category, originalList]) => {
            if (Array.isArray(originalList) && originalList.length > 0) {
              finalSkills[category] = cleanList(originalList);
            }
          });
        }

        return finalSkills as SkillsData;
      })(),
    };

    // Calculate ATS score and keywords using the final tailored resume
    console.log(`[tailor] Calculating ATS Score and Keywords...`);
    const scoreResult = await scoreResumeWithAI(tailoredResume, jd, modelSelection);

    // Post-process: diff original vs tailored to generate per-field changes
    const changes = generateChanges(resume, tailoredResume);

    return {
      tailoredResume,
      atsScore: scoreResult.atsScore ?? 80,
      scoreReasoning: scoreResult.scoreReasoning ?? "Good match",
      matchedKeywords: scoreResult.matchedKeywords ?? [],
      missingKeywords: scoreResult.missingKeywords ?? [],
      changes,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to tailor resume: ${msg}`);
  }
}

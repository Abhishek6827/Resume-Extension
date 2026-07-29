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

  const clean = (str: string) =>
    str
      .replace(/\\(?:textbf|textit|textnormal|mbox|small|large|Large|LARGE|huge|Huge|scshape)\s*\{([^}]*)\}/gi, "$1")
      .replace(/\\[a-zA-Z]+/g, "")
      .replace(/[\{\}]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  // 1. \name{First}{Last}
  const nameTwoArgsMatch = text.match(/\\name\s*\{([^}]+)\}\s*\{([^}]+)\}/i);
  if (nameTwoArgsMatch) {
    const res = clean(`${nameTwoArgsMatch[1]} ${nameTwoArgsMatch[2]}`);
    if (res && res.length < 60) return res;
  }

  // 2. \name{Full Name}
  const nameOneArgMatch = text.match(/\\name\s*\{([^}]+)\}/i);
  if (nameOneArgMatch) {
    const res = clean(nameOneArgMatch[1]);
    if (res && res.length < 60) return res;
  }

  // 3. \author{Full Name}
  const authorMatch = text.match(/\\author\s*\{([^}]+)\}/i);
  if (authorMatch) {
    const res = clean(authorMatch[1]);
    if (res && res.length < 60) return res;
  }

  // 4. \fullname{Full Name}
  const fullnameMatch = text.match(/\\fullname\s*\{([^}]+)\}/i);
  if (fullnameMatch) {
    const res = clean(fullnameMatch[1]);
    if (res && res.length < 60) return res;
  }

  // 5. \newcommand{\name}{Full Name}
  const newcmdMatch = text.match(/\\newcommand\s*\{\s*\\(?:my)?name\s*\}\s*\{([^}]+)\}/i);
  if (newcmdMatch) {
    const res = clean(newcmdMatch[1]);
    if (res && res.length < 60) return res;
  }

  // 6. {\Huge Full Name} or {\LARGE Full Name}
  const hugeMatch = text.match(/\{\s*\\(?:Huge|huge|LARGE|Large)\s+([^}]+)\}/i);
  if (hugeMatch) {
    const res = clean(hugeMatch[1]);
    if (res && !res.includes("\\") && res.length < 60) return res;
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
      modelSelection: modelSelection || { primaryModel: "groq:llama-3.3-70b-versatile" },
    });

    const jsonStr = extractJSON(response.content);
    const resume = JSON.parse(jsonStr) as ResumeData;

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
Your task is to take raw text from a Job Description (JD) and extract key requirements into a structured JSON object.

Return ONLY a valid JSON object matching this exact structure (no markdown wrapper, no prose):
{
  "jobTitle": "Job Title",
  "company": "Company name if present, else empty string",
  "mustHaveSkills": ["Key technical skills explicitly required or marked mandatory"],
  "niceToHaveSkills": ["Desired or preferred skills"],
  "responsibilities": ["Main responsibilities/tasks listed"],
  "keywords": ["Key industries, tools, methodologies, or standard keywords/buzzwords in the JD"]
}
`;

  try {
    const response = await callFastLLM({
      systemPrompt,
      userMessage: `Job Description:\n${rawText}`,
      modelSelection,
    });

    try {
      const jsonStr = extractJSON(response.content);
      return JSON.parse(jsonStr) as JDData;
    } catch (parseErr) {
      console.warn(`[parseJDWithAI] Primary model (${modelSelection?.primaryModel}) produced invalid JSON. Retrying with default Fast LLM...`, parseErr);
      const fallbackResponse = await callFastLLM({
        systemPrompt,
        userMessage: `Job Description:\n${rawText}`,
      });
      const jsonStr = extractJSON(fallbackResponse.content);
      return JSON.parse(jsonStr) as JDData;
    }
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

  // Skills — compare each category as a joined string
  if (original.skills && tailored.skills) {
    const categories: Array<{ key: keyof typeof original.skills; label: string }> = [
      { key: "languages", label: "Skills — Languages" },
      { key: "frameworks", label: "Skills — Frameworks" },
      { key: "tools", label: "Skills — Tools/Databases" },
      { key: "other", label: "Skills — Other" },
    ];

    for (const cat of categories) {
      const origVal = (original.skills[cat.key] || []).join(", ");
      const tailVal = (tailored.skills[cat.key] || []).join(", ");
      addChange("skills", `skills.${cat.key}`, cat.label, origVal, tailVal);
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
  const systemPrompt = `You are an expert resume optimizer. Rewrite the candidate's Professional Summary to align with the target role and key JD requirements.
CRITICAL SAFETY RULES:
1. NEVER invent experience, skills, or degrees.
2. Keep it concise, punchy, and professional.
3. **CRITICAL LENGTH CONSTRAINT**: Ensure the tailored professional summary is of a similar length (number of lines, approximately 4 lines, 70-85 words) as the original summary to avoid creating layout gaps or page overflow. Keep word/character count within +/- 15% of the original.
4. MANDATORY DOMAIN & ARCHITECTURAL WEAVING: You MUST rewrite the summary to explicitly incorporate the highest-priority architectural scale, domain competencies, and core requirements from the Job Description (e.g. large-scale distributed systems, data structures & algorithms, accessible technologies, Java/Python/TypeScript/Angular/HTML/CSS, design/code reviews, triage/debugging)!

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
  const systemPrompt = `You are an expert resume optimizer. Rewrite the candidate's Work Experience bullet points to align with the JD's responsibilities and keywords.
CRITICAL SAFETY RULES:
1. NEVER invent any work experience, company names, dates, or locations.
2. Keep all factual details (companies, degrees, years, roles) exactly the same.
3. You may rewrite, reorder, and refine phrasing of bullet points to naturally incorporate JD keywords and core responsibilities (e.g., data structures & algorithms, large-scale distributed systems, accessible technologies, Java, Python, Angular, HTML/CSS, code reviews, design reviews, triage & debugging).
4. Highlight outcomes and metrics if present.
5. DO NOT reorder the jobs themselves. Keep the exact same array length and order.
6. You MUST preserve the exact same number of bullet points in the "highlights" array for each work experience entry as the original. Do not merge bullet points, do not split bullet points, and do not add or delete bullet points. Rewrite each original bullet point at its exact corresponding index.
7. **CRITICAL LENGTH CONSTRAINT**: For each tailored bullet point, keep its character length/word count within +/- 15% of the original bullet point. Do NOT turn a 1-line bullet into a 2-line bullet, and do NOT turn a 2-line bullet into a 1-line bullet.
8. ABSOLUTE BAN ON LAZY SUFFIXES ("DEMONSTRATING EXPERTISE IN..."): You are STRICTLY BANNED from appending lazy meta-commentary suffixes like ", demonstrating expertise in...", ", showcasing proficiency in...", or ", demonstrating large-scale system design..." at the end of bullet points! You MUST genuinely rewrite the core engineering action verbs and architectural details of the bullet point itself.

Return ONLY a valid JSON object matching this exact structure (keep the same array length and structure, just rewrite the highlights and preserve scope):
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
    userMessage: `Job Description:\n${JSON.stringify(jd)}\n\nOriginal Experience:\n${JSON.stringify(experience)}`,
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
  const systemPrompt = `You are an expert resume optimizer. Rewrite the candidate's Projects section to align deeply with the target JD.
CRITICAL SAFETY & REPLACEMENT RULES:
1. FORCEFULLY INJECT TOP JD SKILLS: Across the projects, replace older/irrelevant skills and tech stack descriptions with top JD-required technologies (e.g. Java, Python, Angular, JavaScript, TypeScript, HTML, CSS, Data Structures & Algorithms, Large-Scale Distributed Systems, Accessible Technologies). At least 7-8 core JD skills must be explicitly represented across the Projects section.
2. Each project must highlight 2-3 distinct JD skills in its tech list and bullet points.
3. DO NOT reorder the projects. Keep the exact same array length and order.
4. You MUST preserve the exact same number of bullet points in the "highlights" array for each project entry as the original. Do not merge, split, add, or delete bullet points.
5. **CRITICAL LENGTH CONSTRAINT**: Keep the character length/word count of each tailored bullet point and project description within +/- 15% of the original to maintain single-page budget.
6. ABSOLUTE BAN ON LAZY SUFFIXES: Do NOT append lazy suffixes like ", demonstrating expertise in...". Truly rewrite the engineering details.

Return ONLY a valid JSON object matching this exact structure (keep the same array length and structure):
{
  "projects": [
    {
      "name": "Same project name",
      "description": "Tailored description",
      "tech": ["Top JD skills and relevant technologies"],
      "highlights": [
        "Tailored bullet point 1"
      ]
    }
  ]
}
`;

  const response = await callLLM({
    systemPrompt,
    userMessage: `Job Description:\n${JSON.stringify(jd)}\n\nOriginal Projects:\n${JSON.stringify(projects)}`,
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
  const systemPrompt = `You are an expert resume optimizer. Reorder and refine the candidate's Skills section to perfectly match the target Job Description.
CRITICAL MANDATORY RULES:
1. JD SKILLS FIRST & AT THE TOP: Within each skill category, place JD-matching skills at the VERY BEGINNING (first items in the array). Do NOT append them at the end.
2. CATEGORY REORDERING: Order the skill categories so that categories containing core JD requirements (e.g., Languages, Frontend, Backend, Data Structures & System Design) appear at the VERY TOP of the Skills section.
3. LEARNING/WORKING KNOWLEDGE: If JD requires specific languages (e.g., Golang, C++) that are in the candidate's background/scope, list them cleanly as "Golang (Learning)", "C++ (Working Knowledge)" at the top of Languages.
4. DO NOT REMOVE relevant existing skills, but ensure top JD skills appear first so recruiters immediately see JD alignment.
5. **CRITICAL LENGTH CONSTRAINT**: Keep the total number of skills per category approximately the same to maintain layout balance.

Return ONLY a valid JSON object matching this exact structure:
{
  "skills": {
    "Category Name": ["JD-matching skills first, followed by other skills"]
  }
}
`;

  const response = await callLLM({
    systemPrompt,
    userMessage: `Job Description:\n${JSON.stringify(jd)}\n\nOriginal Skills:\n${JSON.stringify(skills)}`,
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
    console.log(`[tailor] Starting modular/batched tailoring pipeline sequentially...`);

    // Run tailoring steps sequentially (one-by-one) to prevent API rate limits, 
    // context exhaustion, and ensure maximum precision/stability per request.
    const tailoredSummaryObj = await tailorSummaryWithAI(resume.summary || "", jd, modelSelection);
    const tailoredExperienceObj = await tailorExperienceWithAI(resume.experience || [], jd, modelSelection);
    const tailoredProjectsObj = await tailorProjectsWithAI(resume.projects || [], jd, modelSelection);
    const tailoredSkillsObj = await tailorSkillsWithAI(resume.skills || {}, jd, modelSelection);

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
          highlights,
        };
      }),
      skills: (() => {
        const finalSkills: Record<string, string[]> = {};
        Object.entries(resume.skills || {}).forEach(([category, originalList]) => {
          const rawSkills = tailoredSkillsObj.skills as any;
          const tailoredList = rawSkills?.[category] || 
                               rawSkills?.[category.toLowerCase()] ||
                               rawSkills?.[category.replace(/&/g, "and")] ||
                               rawSkills?.[category.replace(/and/g, "&")];
          
          if (tailoredList && Array.isArray(tailoredList)) {
            finalSkills[category] = tailoredList;
          } else {
            finalSkills[category] = originalList || [];
          }
        });
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

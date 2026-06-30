import { callLLM, extractJSON } from "./llm-client";
import type { ResumeData, JDData, TailoredResult, TailoredChange, ScoreResult, ExperienceEntry, ProjectEntry, SkillsData } from "./types";

/**
 * AI-assisted parse of raw resume text into structured ResumeData JSON.
 */
export async function parseResumeWithAI(rawText: string): Promise<ResumeData> {
  const systemPrompt = `You are an expert resume parsing assistant.
Your task is to take raw text from a resume and convert it into a structured JSON object according to the specified schema.
Extract all details accurately. Do not invent details.

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
  "summary": "Professional summary or objective",
  "experience": [
    {
      "role": "Job title / role",
      "company": "Company/organization name",
      "duration": "Dates (e.g., Jun 2021 - Present)",
      "location": "Location or empty string",
      "highlights": [
        "Bullet point 1",
        "Bullet point 2"
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
    "languages": ["programming languages e.g. JavaScript, Python"],
    "frameworks": ["frameworks / libraries e.g. React, Node.js"],
    "tools": ["dev tools, databases e.g. Git, Docker, Postgres"],
    "other": ["soft skills or other tech categories"]
  },
  "certifications": ["Certification names"],
  "projects": [
    {
      "name": "Project name",
      "description": "Short description",
      "tech": ["React", "TypeScript"],
      "highlights": [
        "Highlight bullet point 1",
        "Highlight bullet point 2"
      ]
    }
  ],
  "achievements": ["Major awards, achievements, or publications"]
}
`;

  try {
    const response = await callLLM({
      systemPrompt,
      userMessage: `Resume text:\n${rawText}`,
    });

    const jsonStr = extractJSON(response.content);
    return JSON.parse(jsonStr) as ResumeData;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse resume with AI: ${msg}`);
  }
}

/**
 * AI-assisted parse of Job Description text into structured JDData JSON.
 */
export async function parseJDWithAI(rawText: string): Promise<JDData> {
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
    const response = await callLLM({
      systemPrompt,
      userMessage: `Job Description:\n${rawText}`,
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

    const maxBullets = Math.max(origJob.highlights?.length || 0, tailJob.highlights?.length || 0);
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

    const maxProjBullets = Math.max(origProj.highlights?.length || 0, tailProj.highlights?.length || 0);
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
  jd: JDData
): Promise<ScoreResult> {
  const systemPrompt = `You are an expert ATS (Applicant Tracking System) specialist.
Your goal is to evaluate a candidate's resume against a Job Description (JD).

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
    });

    const jsonStr = extractJSON(response.content);
    return JSON.parse(jsonStr) as ScoreResult;
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
  jd: JDData
): Promise<{ summary: string }> {
  const systemPrompt = `You are an expert resume optimizer. Rewrite the candidate's Professional Summary to align with the target role and key JD requirements.
CRITICAL SAFETY RULES:
1. NEVER invent experience, skills, or degrees.
2. Keep it concise, punchy, and professional.

Return ONLY a valid JSON object matching this exact structure:
{
  "summary": "Tailored professional summary"
}
`;

  const response = await callLLM({
    systemPrompt,
    userMessage: `Job Description:\n${JSON.stringify(jd)}\n\nOriginal Summary:\n${summary}`,
  });

  return JSON.parse(extractJSON(response.content));
}

/**
 * AI Tailor Logic: Rewrites the Experience section.
 */
export async function tailorExperienceWithAI(
  experience: ExperienceEntry[],
  jd: JDData
): Promise<{ experience: ExperienceEntry[] }> {
  const systemPrompt = `You are an expert resume optimizer. Rewrite the candidate's Work Experience bullet points to align with the JD's responsibilities and keywords.
CRITICAL SAFETY RULES:
1. NEVER invent any work experience, company names, dates, or locations.
2. Keep all factual details (companies, degrees, years, roles) exactly the same.
3. You may rewrite, reorder, and refine phrasing of bullet points to naturally incorporate keywords and highlight relevant aspects of the candidate's actual experience.
4. Highlight outcomes and metrics if present.

Return ONLY a valid JSON object matching this exact structure (keep the same array length and structure, just rewrite the highlights):
{
  "experience": [
    {
      "role": "Same role as original",
      "company": "Same company as original",
      "duration": "Same duration",
      "location": "Same location",
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
  });

  return JSON.parse(extractJSON(response.content));
}

/**
 * AI Tailor Logic: Rewrites the Projects section.
 */
export async function tailorProjectsWithAI(
  projects: ProjectEntry[],
  jd: JDData
): Promise<{ projects: ProjectEntry[] }> {
  const systemPrompt = `You are an expert resume optimizer. Rewrite the candidate's Projects section to align with the JD.
CRITICAL SAFETY RULES:
1. NEVER invent any projects, features, or tech stack not present in the original.
2. You may refine phrasing of descriptions and bullet points to naturally incorporate keywords.

Return ONLY a valid JSON object matching this exact structure (keep the same array length and structure):
{
  "projects": [
    {
      "name": "Same project name",
      "description": "Tailored description",
      "tech": ["Same tech stack"],
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
    userMessage: `Job Description:\n${JSON.stringify(jd)}\n\nOriginal Projects:\n${JSON.stringify(projects)}`,
  });

  return JSON.parse(extractJSON(response.content));
}

/**
 * AI Tailor Logic: Filters the Skills section.
 */
export async function tailorSkillsWithAI(
  skills: SkillsData,
  jd: JDData
): Promise<{ skills: SkillsData }> {
  const systemPrompt = `You are an expert resume optimizer. Filter and categorize the candidate's Skills, prioritizing those from the original list that are also present in the JD.
CRITICAL SAFETY RULES:
1. NEVER add skills to the candidate's skills list that are not present in the original resume.
2. Only reorganize or select the most relevant existing skills.

Return ONLY a valid JSON object matching this exact structure:
{
  "skills": {
    "languages": ["Relevant languages"],
    "frameworks": ["Relevant frameworks"],
    "tools": ["Relevant tools"],
    "other": ["Relevant other skills"]
  }
}
`;

  const response = await callLLM({
    systemPrompt,
    userMessage: `Job Description:\n${JSON.stringify(jd)}\n\nOriginal Skills:\n${JSON.stringify(skills)}`,
  });

  return JSON.parse(extractJSON(response.content));
}

/**
 * AI Tailor Logic: Rewrites resume sections to align with Job Description.
 * Rule: NEVER invent experience, titles, companies, dates, or degrees.
 */
export async function tailorResume(
  resume: ResumeData,
  jd: JDData
): Promise<TailoredResult> {
  const systemPrompt = `You are an expert resume optimizer and ATS (Applicant Tracking System) specialist.
Your goal is to optimize a candidate's resume to match a specific Job Description (JD) to improve ATS compatibility.

CRITICAL SAFETY RULES:
1. NEVER invent any work experience, company names, dates, locations, projects, degrees, or certifications.
2. NEVER add skills to the candidate's skills list that are not present in the original resume or clearly justified/proven by the existing text.
3. Keep all factual details (companies, degrees, years, roles) exactly the same.
4. You may rewrite, reorder, and refine phrasing of bullet points, projects, and summaries to naturally incorporate keywords and highlight the most relevant aspects of the candidate's actual experience.
5. Highlight outcomes, metrics (if present in original), and technical stack alignment.

Optimization Guidelines:
- Professional Summary: Rewrite it to align with the target role and key JD requirements using the candidate's existing background.
- Work Experience: Highlight and rephrase highlights (bullet points) to align with the JD's responsibilities and keywords. Ensure the wording matches closely without modifying the actual tasks performed.
- Skills: Filter and categorize skills, prioritizing those from the original list that are also present in the JD. Do NOT add new skills.
- ATS Score: Estimate a realistic ATS score (0-100) comparing the tailored resume to the JD. Provide constructive reasoning and list matched and missing keywords (missing keywords represent skills/requirements in the JD that are not present in the candidate's resume, which the user could address honestly if they have it).

Return ONLY a valid JSON object matching this exact structure (no markdown wrapper, no prose):
{
  "tailoredResume": {
    "name": "${resume.name}",
    "title": "Optimized Job Title (aligning candidate title with JD if candidate's background matches)",
    "contact": {
      "email": "${resume.contact.email}",
      "phone": "${resume.contact.phone}",
      "linkedin": "${resume.contact.linkedin}",
      "github": "${resume.contact.github}",
      "website": "${resume.contact.website}",
      "location": "${resume.contact.location}"
    },
    "summary": "Rewritten summary",
    "experience": [
      {
        "role": "Original role name",
        "company": "Original company name",
        "duration": "Original duration",
        "location": "Original location",
        "highlights": [
          "Rewritten bullet point 1",
          "Rewritten bullet point 2"
        ]
      }
    ],
    "education": [
      {
        "degree": "Original degree",
        "institution": "Original institution",
        "year": "Original year",
        "gpa": "Original GPA if present"
      }
    ],
    "skills": {
      "languages": ["Original languages sorted by JD relevance"],
      "frameworks": ["Original frameworks sorted by JD relevance"],
      "tools": ["Original tools sorted by JD relevance"],
      "other": ["Original other skills sorted by JD relevance"]
    },
    "certifications": ["Original certifications"],
    "projects": [
      {
        "name": "Original project name",
        "description": "Rewritten description",
        "tech": ["Original tech list"],
        "highlights": [
          "Rewritten project bullet point 1"
        ]
      }
    ],
    "achievements": ["Original achievements"]
  },
  "atsScore": 85,
  "scoreReasoning": "Provide detail on how the resume matches the JD, highlight strengths and areas where the candidate is a strong fit.",
  "matchedKeywords": ["Keywords/skills present in both the resume and JD"],
  "missingKeywords": ["Keywords/skills present in the JD but not found in the candidate's resume (gaps they could address with real experience, not fabrication)"]
}
`;

  const userMessage = `ORIGINAL RESUME JSON:
${JSON.stringify(resume, null, 2)}

TARGET JOB DESCRIPTION JSON:
${JSON.stringify(jd, null, 2)}
`;

  try {
    const response = await callLLM({
      systemPrompt,
      userMessage,
      temperature: 0.2,
    });

    const jsonStr = extractJSON(response.content);
    const rawResult = JSON.parse(jsonStr) as Omit<TailoredResult, "changes">;

    // Post-process: diff original vs tailored to generate per-field changes
    const changes = generateChanges(resume, rawResult.tailoredResume);

    return {
      ...rawResult,
      changes,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to tailor resume: ${msg}`);
  }
}

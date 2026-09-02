import { callLLM } from "./llm-client";
import type { ResumeData, JDData, ModelSelection } from "./types";

function formatJdSection(jd: JDData | string): string {
  if (typeof jd === "string") return jd.trim();
  return [
    jd.jobTitle ? `Job Title: ${jd.jobTitle}` : "",
    jd.company ? `Company: ${jd.company}` : "",
    jd.mustHaveSkills?.length ? `Must Have Skills: ${jd.mustHaveSkills.join(", ")}` : "",
    jd.responsibilities?.length ? `Responsibilities: ${jd.responsibilities.join(", ")}` : "",
    jd.keywords?.length ? `Keywords: ${jd.keywords.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

function formatResumeSection(resume: ResumeData | string, defaultName: string): { text: string; name: string } {
  if (typeof resume === "string") return { text: resume.trim(), name: defaultName };
  const name = resume.name || defaultName;
  const text = [
    `Name: ${name}`,
    `Contact: ${JSON.stringify(resume.contact || {}, null, 2)}`,
    `Summary: ${resume.summary || ""}`,
    `Experience: ${JSON.stringify(resume.experience || [], null, 2)}`,
    `Projects: ${JSON.stringify(resume.projects || [], null, 2)}`,
    `Skills: ${JSON.stringify(resume.skills || {}, null, 2)}`,
  ].join("\n");
  return { text, name };
}

export async function generateCoverLetter(
  resume: ResumeData | string,
  jd: JDData | string,
  modelSelection?: ModelSelection,
  candidateName?: string
): Promise<string> {
  const systemPrompt = `You are an expert executive recruiter and elite cover letter writer. 
Your task is to write a highly professional, ATS-optimized cover letter for a candidate applying to a job.

CRITICAL TRUTHFULNESS & ANTI-HALLUCINATION RULES:
1. STRICT YEARS OF EXPERIENCE GROUNDING (NO INFLATION):
   - You MUST accurately use the candidate's exact years of experience explicitly stated in the resume summary (e.g. if resume says "3+ years", use "3+ years").
   - NEVER inflate, exaggerate, or fabricate years of experience (e.g., NEVER claim "over 5 years", "5+ years", or "five years" to match a senior JD requirement if the resume says 3+ years).
   - Do NOT count academic degree years as professional software engineering experience.
2. STRICT RESUME FACT ALIGNMENT:
   - Only cite companies, projects, metrics, and technologies that actually exist in the candidate's resume.
   - Do NOT invent fictitious employers, unverified metrics, or fake responsibilities.
3. STRUCTURE & FORMATTING:
   - Output plain text with clear paragraphs. Do NOT wrap in markdown code blocks or backticks.
   - Do NOT use placeholders like [Date], [Hiring Manager], or [Company Name]. Infer Company Name and Job Title from the Job Description.
   - Keep the letter focused and concise (3-4 paragraphs).
   - Paragraph 1: Target position, candidate's authentic professional profile with exact years of experience, and core value proposition.
   - Paragraphs 2-3: Highlight 2-3 standout, proven achievements from the resume directly relevant to the JD requirements.
   - Closing Paragraph: Formally express enthusiasm and availability for a 1-on-1 interview or completing a technical assessment.`;

  const jdSection = formatJdSection(jd);
  const hasResume = typeof resume === "string" ? resume.trim().length > 0 : true;
  const { text: resumeSection, name } = formatResumeSection(resume, candidateName || "Candidate");

  const resumeBlock = hasResume
    ? `\n--- CANDIDATE RESUME (${name}) ---\n${resumeSection}\n`
    : "";

  const userMessage = `
--- JOB DESCRIPTION ---
${jdSection}
${resumeBlock}
Please write the cover letter now. Only output the cover letter text, no other conversation.
`;

  const response = await callLLM({
    systemPrompt,
    userMessage,
    modelSelection,
    jsonMode: false,
    maxTokens: 2500,
  });

  return response.content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

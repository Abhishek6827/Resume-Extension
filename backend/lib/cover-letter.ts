import { callLLM } from "./llm-client";
import type { ResumeData, JDData, ModelSelection } from "./types";

export async function generateCoverLetter(
  resume: ResumeData | string,
  jd: JDData | string,
  modelSelection?: ModelSelection,
  candidateName?: string
): Promise<string> {
  const systemPrompt = `You are an expert executive recruiter and resume writer. 
Your task is to write a highly professional, ATS-friendly cover letter for a candidate applying to a job.
The cover letter MUST NOT use any placeholders like [Date], [Hiring Manager], or [Company Name] except if absolutely necessary and impossible to infer from the provided JD. 
Try to infer the Company Name and Job Title from the Job Description.
Format the cover letter in plain text with clear paragraphs. Do NOT wrap it in markdown code blocks.
The cover letter should be concise (around 3-4 paragraphs) and highlight the candidate's most relevant experience based on the JD.
In the closing paragraph, formally convey availability and enthusiasm for a 1-on-1 meeting/interview, or completing a technical assessment/assignment to demonstrate capabilities.`;

  let jdSection = "";
  if (typeof jd === "string") {
    jdSection = jd.trim();
  } else {
    jdSection = [
      jd.jobTitle ? `Job Title: ${jd.jobTitle}` : "",
      jd.company ? `Company: ${jd.company}` : "",
      jd.mustHaveSkills && jd.mustHaveSkills.length > 0 ? `Must Have Skills: ${jd.mustHaveSkills.join(", ")}` : "",
      jd.responsibilities && jd.responsibilities.length > 0 ? `Responsibilities: ${jd.responsibilities.join(", ")}` : "",
      jd.keywords && jd.keywords.length > 0 ? `Keywords: ${jd.keywords.join(", ")}` : "",
    ].filter(Boolean).join("\n");
  }

  let resumeSection = "";
  let name = candidateName || "Candidate";
  if (typeof resume === "string") {
    resumeSection = resume.trim();
  } else {
    if (resume.name) name = resume.name;
    resumeSection = [
      `Name: ${resume.name || "Candidate"}`,
      `Contact: ${JSON.stringify(resume.contact || {}, null, 2)}`,
      `Summary: ${resume.summary || ""}`,
      `Experience: ${JSON.stringify(resume.experience || [], null, 2)}`,
      `Projects: ${JSON.stringify(resume.projects || [], null, 2)}`,
      `Skills: ${JSON.stringify(resume.skills || {}, null, 2)}`,
    ].join("\n");
  }

  const userMessage = `
--- JOB DESCRIPTION ---
${jdSection}

--- CANDIDATE RESUME (${name}) ---
${resumeSection}

Please write the cover letter now. Only output the cover letter text, no other conversation.
`;

  const response = await callLLM({
    systemPrompt,
    userMessage,
    modelSelection,
    jsonMode: false,
    maxTokens: 2500,
  });

  const finalContent = response.content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  return finalContent;
}

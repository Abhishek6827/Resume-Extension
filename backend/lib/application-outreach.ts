import { callOutreachLLMWithFallback } from "./llm-client";
import { stripMarkdownFormatting } from "./cover-letter";
import type { ResumeData, JDData, ModelSelection } from "./types";

export interface OutreachPack {
  email: {
    subject: string;
    body: string;
  };
  linkedinConnectionNote: string;
  whatsappMessage: string;
  contactFormNote: string;
}

export interface OutreachOptions {
  resume: ResumeData | string;
  jd: JDData | string;
  coverLetter?: string;
  modelSelection?: ModelSelection;
  candidateName?: string;
}

export interface PortalQuestionOptions {
  question: string;
  resume: ResumeData | string;
  jd?: JDData | string;
  coverLetter?: string;
  skillBank?: any;
  modelSelection?: ModelSelection;
  candidateName?: string;
}

const CANONICAL_CANDIDATE_FACTS = `
VERIFIED CANDIDATE PROFILE & FACT GROUNDING:
- Candidate: Abhishek Tiwari
- Location: Lucknow, India (Open to Remote / Relocation within India. NEVER relocates internationally; International = Remote from India only).
- Phone: +91 70816 60941
- Email: abhishektiwari6827@gmail.com
- Portfolio: portfolio.getchintu.com
- Live SaaS: getchintu.com
- GitHub: github.com/abhishek6827
- LinkedIn: linkedin.com/in/abhishek-tiwariiii

CANONICAL WORK EXPERIENCE & REAL METRICS:
1. CHINTU AI | Feb 2026 – Present | Remote, India
   - Founder & Lead Full Stack Engineer
   - Solo-built and operating live SaaS platform serving 1,200+ registered users and 25k+ monthly requests with 99.8% uptime.
   - React.js frontend, Node.js and Python microservices, normalized MySQL/PostgreSQL with sub-120ms p95 latency.
   - Razorpay webhook event pipeline with HMAC signature validation and idempotent transaction processing (100% financial reconciliation).
2. Indian Capital and Investment (Coimbatore) Limited (ICICL) | Nov 2025 – Jan 2026 | Remote, India
   - Full Stack & Data Engineer — Contract
   - Built transactional payment webhook pipeline in Java (Maven) and Node.js, slashing failure detection latency from 20m to under 3m.
   - Optimized PostgreSQL queries via EXPLAIN ANALYZE, eliminating full-table scans and boosting analytical query speed by 60%.
3. Vasnaani Sanskaran | Aug 2024 – Oct 2025 | Noida, India
   - Full Stack Software Developer
   - Shipped 4 production web applications with React.js, Node.js, Java, MySQL.
   - Introduced memoized Redux selectors, eliminating full-tree re-renders and improving frontend performance by 25%.
4. Hoping Minds | Jan 2024 – Jun 2024 | Mohali, India
   - Software Developer Intern
   - Rebuilt learning portal components in React.js consuming Python REST APIs, boosting Lighthouse mobile scores from 68 to 94.

KEY SIDE PROJECTS:
- AI Resume Tailor & LaTeX Cloud Platform (React, Node.js, Docker, Multi-provider LLM cascade).
- Network Telemetry & Infrastructure Monitoring Engine (Node.js, Java Maven, MySQL, threshold alerting).
- SynapseAI (Dynamic context compression engine, 90% token reduction).
`;

const ZERO_AI_TONE_INSTRUCTIONS = `
CRITICAL ZERO-AI HUMAN WRITING INVARIANT:
- Must read 100% human-crafted by a sharp, practical software engineer.
- ABSOLUTELY FORBIDDEN AI BUZZWORDS & TROPES:
  delve, dive deep, crucial, pivotal, vital, paramount, testament, tapestry, beacon, multifaceted,
  nuanced, plethora, landscape, realm, ecosystem, furthermore, moreover, in conclusion, to summarize,
  it is worth noting, serves as, showcases, underscores, aligns with, robust, comprehensive, seamless,
  thrilled to apply, perfect fit, dynamic team, synergy.
- Write with high burstiness (varying sentence lengths), natural contractions (I've, didn't, it's, there's),
  direct conversational cadence, and concrete proof-of-craft metrics.
- Output clean plain text. NO markdown asterisks (**bold**), NO backticks, NO robotic headers.
`;

function formatJd(jd: JDData | string | undefined): string {
  if (!jd) return "";
  if (typeof jd === "string") return jd.trim();
  return [
    jd.jobTitle ? `Job Title: ${jd.jobTitle}` : "",
    jd.company ? `Company: ${jd.company}` : "",
    jd.mustHaveSkills?.length ? `Must Have Skills: ${jd.mustHaveSkills.join(", ")}` : "",
    jd.responsibilities?.length ? `Responsibilities: ${jd.responsibilities.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

function formatResume(resume: ResumeData | string, defaultName: string): string {
  if (typeof resume === "string") return resume.trim() || defaultName;
  return JSON.stringify(resume, null, 2);
}

export async function generateOutreachPack(options: OutreachOptions): Promise<OutreachPack> {
  const { resume, jd, coverLetter, modelSelection, candidateName = "Abhishek Tiwari" } = options;

  const jdText = formatJd(jd);
  const resumeText = formatResume(resume, candidateName);

  const systemPrompt = `You are an elite developer outreach specialist crafting high-converting application messages.
You will generate 4 application outreach assets in a strict valid JSON format.

${ZERO_AI_TONE_INSTRUCTIONS}

${CANONICAL_CANDIDATE_FACTS}

REQUIRED ASSETS:
1. EMAIL:
   - subject: Strictly 35–50 characters max (e.g. "[Role] — Abhishek Tiwari").
   - body: Strictly 100–160 words, single-mobile-screen fit, 4 blocks:
     Block 1: Direct hook & target role.
     Block 2: 2-3 bullet points with real production metrics (e.g. CHINTU AI 1,200+ users / 99.8% uptime, ICICL webhook lag 20m->3m).
     Block 3: Location / relocation readiness (Lucknow, India; open to domestic relocation or remote).
     Block 4: Low-friction CTA and clean signature.
2. LINKEDIN_CONNECTION_NOTE:
   - Exactly one connection invite note.
   - Strictly UNDER 300 characters total.
   - Crisp, peer-to-peer developer tone, mentions the specific role/craft, zero corporate fluff.
3. WHATSAPP_MESSAGE:
   - 3-4 lines max for WhatsApp chat to a founder or recruiter.
   - Direct greeting, role applying for, 1-line proof of work (getchintu.com / 1,200+ users), portfolio link, and open invite to chat.
4. CONTACT_FORM_NOTE:
   - 50-80 words.
   - High-density proof of craft for generic job portal "Why you?" or "Tell us about yourself" boxes.

OUTPUT FORMAT:
Respond with a single valid JSON object with EXACT keys:
{
  "email": {
    "subject": "...",
    "body": "..."
  },
  "linkedinConnectionNote": "...",
  "whatsappMessage": "...",
  "contactFormNote": "..."
}
Do NOT wrap in markdown fences. Output pure JSON only.`;

  const userMessage = `
--- JOB DESCRIPTION ---
${jdText || "General Software Engineering Position"}

--- RESUME & CONTEXT ---
${resumeText}

${coverLetter ? `--- ALIGNED COVER LETTER CONTEXT ---\n${coverLetter}\n` : ""}

Generate the outreach package now in JSON format.
`;

  const response = await callOutreachLLMWithFallback({
    systemPrompt,
    userMessage,
    modelSelection,
    jsonMode: true,
    maxTokens: 2500,
  });

  try {
    const rawCleaned = response.content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const parsed = JSON.parse(rawCleaned);
    return {
      email: {
        subject: stripMarkdownFormatting(parsed?.email?.subject || "Full Stack Developer Application — Abhishek Tiwari"),
        body: stripMarkdownFormatting(parsed?.email?.body || ""),
      },
      linkedinConnectionNote: stripMarkdownFormatting(parsed?.linkedinConnectionNote || "").slice(0, 298),
      whatsappMessage: stripMarkdownFormatting(parsed?.whatsappMessage || ""),
      contactFormNote: stripMarkdownFormatting(parsed?.contactFormNote || ""),
    };
  } catch {
    const firstBrace = response.content.indexOf("{");
    const lastBrace = response.content.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      const jsonSnippet = response.content.substring(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonSnippet);
      return {
        email: {
          subject: stripMarkdownFormatting(parsed?.email?.subject || "Full Stack Developer Application — Abhishek Tiwari"),
          body: stripMarkdownFormatting(parsed?.email?.body || ""),
        },
        linkedinConnectionNote: stripMarkdownFormatting(parsed?.linkedinConnectionNote || "").slice(0, 298),
        whatsappMessage: stripMarkdownFormatting(parsed?.whatsappMessage || ""),
        contactFormNote: stripMarkdownFormatting(parsed?.contactFormNote || ""),
      };
    }
    throw new Error("Failed to parse outreach pack response from LLM.");
  }
}

export async function answerPortalQuestion(options: PortalQuestionOptions): Promise<string> {
  const { question, resume, jd, coverLetter, skillBank, modelSelection, candidateName = "Abhishek Tiwari" } = options;

  const jdText = formatJd(jd);
  const resumeText = formatResume(resume, candidateName);

  let skillBankText = "";
  if (skillBank && Array.isArray(skillBank.skills)) {
    const topSkills = skillBank.skills.slice(0, 20).map((s: any) => s.name || s).join(", ");
    skillBankText = `\nVerified GitHub Skill Bank: ${topSkills}\n`;
  }

  const systemPrompt = `You are Abhishek Tiwari answering a job portal / career site application question.
You answer directly, truthfully, and with 100% human authenticity.

${ZERO_AI_TONE_INSTRUCTIONS}

${CANONICAL_CANDIDATE_FACTS}

INSTRUCTIONS:
1. Ground every statement in Abhishek Tiwari's verified background (CHINTU AI, ICICL, Vasnaani Sanskaran, Hoping Minds, live links).
2. Directly answer what the user's question asks. If the question contains a custom prompt or length constraint (e.g., "in under 100 words" or "focus on backend"), strictly obey it.
3. Keep the tone natural, confident, and precise. No robotic corporate throat-clearing.
4. Output clean plain text ready to be pasted directly into the portal form textbox. No markdown asterisks (**bold**).`;

  const userMessage = `
--- APPLICATION QUESTION / PROMPT ---
${question}

--- JOB DESCRIPTION CONTEXT ---
${jdText || "Not specified"}

--- CANDIDATE RESUME CONTEXT ---
${resumeText}
${skillBankText}
${coverLetter ? `--- COVER LETTER CONTEXT ---\n${coverLetter}\n` : ""}

Answer the question directly now. Output only the answer text.
`;

  const response = await callOutreachLLMWithFallback({
    systemPrompt,
    userMessage,
    modelSelection,
    jsonMode: false,
    maxTokens: 2000,
  });

  const rawCleaned = response.content.replace(/<think>[\s\S]*?<\/think>/gi, "");
  return stripMarkdownFormatting(rawCleaned);
}


import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import { callLLM, callFastLLM, extractJSON } from "../../../lib/llm-client";
import { sanitizeMissingKeywords } from "../../../lib/skill-bank";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const AI_MODELS = [
  { id: "nvidia:nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 550B (Quality)" },
  { id: "openrouter:openrouter/free", name: "Auto Free Model (OpenRouter)" },
  { id: "nvidia:z-ai/glm-5.2", name: "GLM-5.2 (Balanced)" },
  { id: "cerebras:gpt-oss-120b", name: "Cerebras GPT-OSS 120B (Fast)" },
  { id: "cerebras:gemma-4-31b", name: "Cerebras Gemma 4 31B (Ultra Fast)" },
  { id: "groq:llama-3.3-70b-versatile", name: "Groq Llama-70B (Fast)" },
  { id: "groq:qwen/qwen3.6-27b", name: "Groq Qwen 3.6 27B (Fast)" }
];

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
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

  const reasoning = matched.length > 0
    ? `The resume aligns strongly with key requirements including ${matched.slice(0, 5).join(", ")}, with opportunities to further emphasize ${sanitizedMissing.slice(0, 3).join(", ") || "niche Domain terms"}.`
    : "ATS evaluation completed with automated keyword matching.";

  return {
    score,
    reasoning,
    matchedKeywords: matched,
    missingKeywords: sanitizedMissing,
  };
}

async function evaluateTailoredResume(latex: string, jdData: any): Promise<{
  score: number;
  reasoning: string;
  matchedKeywords: string[];
  missingKeywords: string[];
}> {
  const evalSystemPrompt = `You are an expert ATS (Applicant Tracking System) grader.
Your task is to analyze the tailored LaTeX resume and evaluate its alignment with the target Job Description.

CRITICAL KEYWORD RULE:
- Do NOT list version-specific variants (e.g., "Java 8", "Java 17", "Java 21", "Python 3") in "missingKeywords" if the core base skill/technology (e.g. "Java", "Python") is already present/matched in the candidate's resume.
- Only list fundamentally missing technologies or skills in "missingKeywords".

You MUST return a JSON object with EXACTLY the following structure. Do NOT wrap it in markdown code blocks. Start and end with the JSON curly braces:
{
  "score": <number from 0 to 100 representing how well the resume aligns with the JD (skills, requirements, keywords)>,
  "reasoning": "<1-2 sentences explaining why the score was given>",
  "matchedKeywords": ["<list of important keywords from the JD that are matched in the resume>"],
  "missingKeywords": ["<list of key JD requirements or skills that are missing, weak, or could be better highlighted>"]
}`;

  const evalUserMessage = `Job Description:
${JSON.stringify(jdData, null, 2)}

Tailored LaTeX Resume:
${latex}`;

  try {
    let evalTimer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      evalTimer = setTimeout(() => reject(new Error("ATS evaluation timeout")), 90000);
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
    console.error("[evaluateTailoredResume] Error or timeout:", err);
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

  while (attempt < maxAttempts) {
    const response = await callLLM({
      systemPrompt: currentSystemPrompt,
      userMessage,
      modelSelection: { primaryModel: modelId },
      jsonMode: false,
    });

    tailoredLatex = response.content;
    
    // Clean up if the model wrapped it in markdown fences anyway
    if (tailoredLatex.startsWith("```latex\n")) {
      tailoredLatex = tailoredLatex.substring(9);
    } else if (tailoredLatex.startsWith("```latex")) {
      tailoredLatex = tailoredLatex.substring(8);
    } else if (tailoredLatex.startsWith("```\n")) {
      tailoredLatex = tailoredLatex.substring(4);
    } else if (tailoredLatex.startsWith("```")) {
      tailoredLatex = tailoredLatex.substring(3);
    }
    
    if (tailoredLatex.endsWith("\n```")) {
      tailoredLatex = tailoredLatex.substring(0, tailoredLatex.length - 4);
    } else if (tailoredLatex.endsWith("```")) {
      tailoredLatex = tailoredLatex.substring(0, tailoredLatex.length - 3);
    }
    tailoredLatex = tailoredLatex.trim();

    // Sanitize common problematic Unicode characters that pdflatex chokes on
    tailoredLatex = tailoredLatex
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
      .replace(/\\leftarrow(?![a-zA-Z])/g, ' from ');

    if (tailoredLatex.length <= latexLength) {
      break;
    }
    
    currentSystemPrompt = systemPrompt + `\n\nWARNING: Your previous response was ${tailoredLatex.length} characters long, which EXCEEDS the absolute maximum limit of ${latexLength} characters. You MUST shorten your response by at least ${tailoredLatex.length - latexLength} characters. Be extremely concise.`;
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
    } catch (e) {}
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

    const isMatched =
      (pName.length > 2 && jdString.includes(pName)) ||
      (pDesc.length > 2 && jdString.includes(pDesc));

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
    const body = await request.json();
    const { latex, jdData, skillBank, modelsToRun } = body;

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
      const topProjects = selectedProjects.map((p: any) => `${p.name}: ${p.description}`).join("; ");
      
      console.log(`[tailor-latex-direct] Smart JD Skill Lookup: Found ${matchCount} direct JD-matching skills out of ${skillBank.skills.length} total skills.`);

      skillBankInstruction = `

MANDATORY GITHUB SKILL BANK CONSULTATION & INJECTION:
The candidate has verified technical skills and real project achievements extracted directly from their GitHub codebase (prioritized by relevance to this Job Description):
- VERIFIED TECHNICAL SKILLS: ${topSkills}
- VERIFIED GITHUB PROJECTS: ${topProjects}

STRICT INSTRUCTIONS FOR SKILL BANK INTEGRATION:
1. YOU MUST CONSULT THIS SKILL BANK FIRST. Whenever the Job Description requires a skill, tool, framework, or architecture (e.g. Java, Spring Boot, MongoDB, Docker, REST API, Microservices, TypeScript, Go), check if it exists in the candidate's Verified Skill Bank.
2. IF FOUND IN SKILL BANK, YOU MUST INJECT IT into the resume's Professional Summary and Work Experience bullet points.
3. Integrate these verified skills naturally into existing bullet points as concrete technical achievements matching the JD requirements. Do NOT list raw keywords blindly—weave them into project responsibilities and outcomes.`;
    }

    const systemPrompt = `You are an expert ATS specialist and LaTeX editor. 
Your task is to take a raw LaTeX resume and rewrite its Professional Summary and Work Experience / Project bullet points to perfectly align with the target Job Description by consulting the candidate's Verified GitHub Skill Bank.

CRITICAL INSTRUCTIONS:
1. DO NOT CHANGE ANY LaTeX COMMANDS. Leave ALL macros, brackets, formatting (e.g. \\textbf, \\item, \\begin, \\end, \\vspace, \\hspace, \\href) exactly as they are.
2. MAXIMIZE ATS SCORE: Aggressively inject the exact keywords, tools, and methodologies from the Job Description into the plain text prose of the summary and bullet points. Ensure NO critical JD requirement is missed if it can be reasonably mapped to the candidate's existing experience or Verified Skill Bank.
3. Rewrite the bullet points to highlight outcomes and responsibilities that perfectly mirror the JD's core needs. Do not invent fake experience, but heavily reframe the existing experience to sound like the ideal candidate.
4. DO NOT add or remove bullet points. Keep the exact same number of items.
5. **STRICT LENGTH CONSTRAINT**: The original LaTeX string has EXACTLY ${latexLength} characters. You must output the ENTIRE tailored LaTeX string such that its total character count is less than or equal to ${latexLength}. This is a hard requirement to ensure the generated PDF does not exceed 1 page or create a bottom gap. Do not make any section significantly longer than before.
6. DO NOT use mathematical LaTeX commands (e.g., \\to, \\rightarrow, \\gets) in plain text. Always use plain English words (e.g., "to", "leads to") instead. pdflatex will fail to compile if you use math symbols outside of math mode.
7. NEVER use \\newcommand for commands that already exist in standard LaTeX (such as \\section, \\subsection, \\item, \\textbf). Leave existing section definitions untouched or use \\renewcommand.
8. Return ONLY the raw tailored LaTeX string. Do NOT wrap it in markdown code blocks (\`\`\`latex ... \`\`\`). Do NOT include any explanations or prose before or after. Start immediately with the first LaTeX character and end with the last LaTeX character.${skillBankInstruction}`;

    const userMessage = `Job Description:
${JSON.stringify(jdData, null, 2)}
${selectedSkills.length > 0 ? `\nVERIFIED CANDIDATE GITHUB SKILL BANK (SMART RELEVANT LOOKUP):\n${JSON.stringify({ skills: selectedSkills, projects: selectedProjects }, null, 2)}` : ""}

Original LaTeX (Length: ${latexLength} characters):
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

            let latexResult = "";
            while (attempt < maxAttempts) {
              const response = await callLLM({
                systemPrompt: currentSystemPrompt,
                userMessage,
                modelSelection: { primaryModel: model.id },
                jsonMode: false,
              });

              latexResult = response.content;
              
              // Clean code fences if added by model
              if (latexResult.startsWith("```latex\n")) {
                latexResult = latexResult.substring(9);
              } else if (latexResult.startsWith("```latex")) {
                latexResult = latexResult.substring(8);
              } else if (latexResult.startsWith("```\n")) {
                latexResult = latexResult.substring(4);
              } else if (latexResult.startsWith("```")) {
                latexResult = latexResult.substring(3);
              }
              if (latexResult.endsWith("\n```")) {
                latexResult = latexResult.substring(0, latexResult.length - 4);
              } else if (latexResult.endsWith("```")) {
                latexResult = latexResult.substring(0, latexResult.length - 3);
              }
              latexResult = latexResult.trim();

              // Clean bad unicode characters
              latexResult = latexResult
                .replace(/\u202F/g, ' ')
                .replace(/\u200B/g, '')
                .replace(/\u2011/g, '-')
                .replace(/\u2013/g, '--')
                .replace(/\u2014/g, '---')
                .replace(/[\u2018\u2019]/g, "'")
                .replace(/[\u201C\u201D]/g, '"')
                .replace(/\\to(?![a-zA-Z])/g, ' to ')
                .replace(/\\rightarrow(?![a-zA-Z])/g, ' to ')
                .replace(/\\gets(?![a-zA-Z])/g, ' from ')
                .replace(/\\leftarrow(?![a-zA-Z])/g, ' from ');

              if (latexResult.length <= latexLength) {
                break;
              }
              
              currentSystemPrompt = systemPrompt + `\n\nWARNING: Your previous response was ${latexResult.length} characters long, which EXCEEDS the absolute maximum limit of ${latexLength} characters. You MUST shorten your response by at least ${latexResult.length - latexLength} characters. Be extremely concise.`;
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

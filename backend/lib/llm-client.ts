// ─── Multi-Provider LLM Client ─────────────────────────────
// Provider chain: Groq (fast) → NVIDIA Kimi-K2.6 (quality) → OpenRouter (fallback)
// Same proven pattern as Chintu's answer/route.ts

import Groq from "groq-sdk";
import OpenAI from "openai";
import type { LLMResponse } from "./types";

interface LLMCallOptions {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  modelSelection?: import("./types").ModelSelection;
  jsonMode?: boolean;
}

/**
 * Strip <think>...</think> tags from model responses (some models include reasoning)
 */
function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/**
 * Extract JSON object from a response that may be wrapped in markdown fences
 */
export function extractJSON(text: string): string {
  const cleaned = stripThinkTags(text);
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    // Repair common trailing commas issue before returning
    return jsonMatch[0].replace(/,\s*([\}\]])/g, "$1");
  }
  
  // Auto-repair truncated JSON (e.g. unterminated string or missing closing braces)
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace !== -1) {
    let str = cleaned.substring(firstBrace);
    const quoteMatches = str.match(/(?<!\\)"/g) || [];
    if (quoteMatches.length % 2 !== 0) {
      str += '"';
    }
    const openBraces = (str.match(/\{/g) || []).length;
    const closeBraces = (str.match(/\}/g) || []).length;
    for (let i = 0; i < openBraces - closeBraces; i++) {
      str += "}";
    }
    return str.replace(/,\s*([\}\]])/g, "$1");
  }

  throw new Error("No JSON object found in LLM response");
}

function isVersatileModel(modelId?: string): boolean {
  if (!modelId) return false;
  const lower = modelId.toLowerCase();
  return lower.includes("versatile") || lower.includes("ersatile");
}

/**
 * Try Groq provider (primary — fast inference)
 */
async function tryGroq(options: LLMCallOptions, forceModel?: string): Promise<LLMResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  // Compress whitespace to save precious tokens and bypass strict limits
  const cleanedUserMessage = options.userMessage
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  const groq = new Groq({ apiKey, maxRetries: 3, timeout: 60000 });
  const modelToUse = forceModel || "llama-3.3-70b-versatile";
  
  try {
    const response = await groq.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: cleanedUserMessage },
      ],
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 3500,
      ...(options.jsonMode !== false && { response_format: { type: "json_object" } }),
    });

    const msg = response.choices[0]?.message as any;
    let content = msg?.content || msg?.reasoning || msg?.reasoning_content || "";

    if (content.includes("\\documentclass")) {
      const docIdx = content.indexOf("\\documentclass");
      content = content.substring(docIdx);
    } else if (content.includes("<think>")) {
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    }

    if (!content) throw new Error("Empty Groq response");

    return { content, provider: "groq", model: modelToUse };
  } catch (err: any) {
    const isRateOrSizeLimit = 
      err.status === 413 || 
      err.status === 429 || 
      (err.message && (
        err.message.includes("limit") || 
        err.message.includes("large") || 
        err.message.includes("TPM") ||
        err.message.includes("rate_limit_exceeded")
      ));

    // Fallback to Cerebras if Groq token/rate limit is hit
    if (isRateOrSizeLimit) {
      console.warn(`[LLM] Groq (${modelToUse}) token/rate limit hit (${err.message}). Falling back to Cerebras gpt-oss-120b for recovery...`);
      return await tryCerebras(options, "gpt-oss-120b");
    }

    throw err;
  }
}

/**
 * Try NVIDIA provider (primary — high quality inference)
 */
async function tryNvidia(options: LLMCallOptions, forceModel?: string): Promise<LLMResponse> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY not set");

  const modelToUse = forceModel || "nvidia/nemotron-3-ultra-550b-a55b";
  const isGlm = modelToUse.includes("glm");

  const nvidia = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey,
    timeout: 280000, // 280s to fail gracefully before Next.js 300s hard limit
    maxRetries: 0, // No retries because we only have 300s total execution time
  });

  // Compress whitespace to save tokens
  const cleanedUserMessage = options.userMessage
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  try {
    const requestOptions: any = {
      model: modelToUse,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: cleanedUserMessage },
      ],
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 8000,
      stream: false,
    };

    if (modelToUse === "nvidia/nemotron-3.5-lightning-30b-a3b") {
      requestOptions.temperature = 1;
      requestOptions.top_p = 0.95;
      requestOptions.max_tokens = 16384;
      requestOptions.extra_body = {
        chat_template_kwargs: { enable_thinking: true },
        reasoning_budget: 16384,
      };
    }

    // stream: false avoids SSE chunk stalls on NIM endpoints
    const completion = await nvidia.chat.completions.create(requestOptions);

    const content = completion.choices[0]?.message?.content || "";
    if (!content) throw new Error("Empty NVIDIA response");

    return { content, provider: "nvidia", model: modelToUse };
  } catch (err: any) {
    if (isVersatileModel(modelToUse)) {
      console.warn(`[LLM] NVIDIA model (${modelToUse}) failed or timed out (${err.message}). Falling back to Cerebras gpt-oss-120b...`);
      return await tryCerebras(options, "gpt-oss-120b");
    }
    throw err;
  }
}

/**
 * Try OpenRouter provider (fallback 2 — wide model access)
 */
async function tryOpenRouter(options: LLMCallOptions, forceModel?: string): Promise<LLMResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    timeout: 90000, // 90s timeout for OpenRouter queues
    maxRetries: 3,
  });

  const modelToUse = forceModel || "openrouter/free";

  try {
    const completion = await openrouter.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.userMessage },
      ],
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 8000,
      stream: false,
    });

    const msg = completion.choices[0]?.message;
    const response = msg?.content || (msg as any)?.reasoning || (msg as any)?.reasoning_content || "";

    if (!response) throw new Error("Empty OpenRouter response");

    return { content: response, provider: "openrouter", model: modelToUse };
  } catch (err: any) {
    console.warn(`[LLM] OpenRouter model (${modelToUse}) failed or rate limited (${err.message}). Falling back to Cerebras gpt-oss-120b...`);
    try {
      return await tryCerebras(options, "gpt-oss-120b");
    } catch {
      return await tryGroq(options, "llama-3.3-70b-versatile");
    }
  }
}

/**
 * Try Cerebras provider (primary — incredibly fast inference)
 */
async function tryCerebras(options: LLMCallOptions, forceModel?: string): Promise<LLMResponse> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) throw new Error("CEREBRAS_API_KEY not set");

  const cerebras = new OpenAI({
    baseURL: "https://api.cerebras.ai/v1",
    apiKey,
    timeout: 45000,
    maxRetries: 3,
  });

  // Compress whitespace to save precious tokens
  const cleanedUserMessage = options.userMessage
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  const modelToUse = forceModel || "gpt-oss-120b";

  const response = await cerebras.chat.completions.create({
    model: modelToUse,
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: cleanedUserMessage },
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 8000,
    ...(options.jsonMode !== false && { response_format: { type: "json_object" } }),
  });

  const content = response.choices[0]?.message?.content || "";
  if (!content) throw new Error("Empty Cerebras response");

  return { content, provider: "cerebras", model: modelToUse };
}

/**
 * Call LLM with automatic provider fallback chain based on ModelSelection.
 */
export async function callLLM(options: LLMCallOptions): Promise<LLMResponse> {
  const errors: string[] = [];
  const primary = options.modelSelection?.primaryModel;

  // 1. Try Primary Model if specified
  if (primary) {
    try {
      console.log(`[LLM] Trying Primary Model (${primary})...`);
      let result;
      if (primary.startsWith("cerebras:")) {
        const modelId = primary.substring(primary.indexOf(":") + 1);
        result = await tryCerebras(options, modelId);
      } else if (primary.startsWith("groq:")) {
        const modelId = primary.substring(primary.indexOf(":") + 1);
        result = await tryGroq(options, modelId);
      } else if (primary.startsWith("openrouter:")) {
        const modelId = primary.substring(primary.indexOf(":") + 1);
        result = await tryOpenRouter(options, modelId);
      } else {
        const modelId = primary.startsWith("nvidia:") ? primary.substring(primary.indexOf(":") + 1) : primary;
        result = await tryNvidia(options, modelId);
      }
      console.log(`[LLM] Success with Primary Model (${primary})`);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[LLM] Selected Model (${primary}) failed: ${message}`);
      if (!isVersatileModel(primary)) {
        throw err;
      }
      errors.push(`Primary Model (${primary}): ${message}`);
    }
  }

  // 1.5 Try Fallback Model if specified
  if (options.modelSelection?.fallbackModel) {
    const fallback = options.modelSelection.fallbackModel;
    try {
      console.log(`[LLM] Trying Fallback Model (${fallback})...`);
      let result;
      if (fallback.startsWith("cerebras:")) {
        const modelId = fallback.substring(fallback.indexOf(":") + 1);
        result = await tryCerebras(options, modelId);
      } else if (fallback.startsWith("groq:")) {
        const modelId = fallback.substring(fallback.indexOf(":") + 1);
        result = await tryGroq(options, modelId);
      } else if (fallback.startsWith("openrouter:")) {
        const modelId = fallback.substring(fallback.indexOf(":") + 1);
        result = await tryOpenRouter(options, modelId);
      } else {
        const modelId = fallback.startsWith("nvidia:") ? fallback.substring(fallback.indexOf(":") + 1) : fallback;
        result = await tryNvidia(options, modelId);
      }
      console.log(`[LLM] Success with Fallback Model (${fallback})`);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[LLM] Fallback Model (${fallback}) failed: ${message}`);
      errors.push(`Fallback Model (${fallback}): ${message}`);
    }
  }

  // 2. Global fallbacks if no user selection or user-selected models failed
  const globalProviders = [
    { name: "NVIDIA (Default Nemotron)", fn: () => tryNvidia(options, "nvidia/nemotron-3-ultra-550b-a55b") },
    { name: "Groq", fn: () => tryGroq(options) },
    { name: "Cerebras", fn: () => tryCerebras(options) },
  ];

  for (const provider of globalProviders) {
    try {
      console.log(`[LLM] Trying ${provider.name}...`);
      const result = await provider.fn();
      console.log(`[LLM] Success with ${provider.name}`);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[LLM] ${provider.name} failed: ${message}`);
      errors.push(`${provider.name}: ${message}`);
    }
  }

  throw new Error(`All LLM providers failed:\n${errors.join("\n")}`);
}

/**
 * Call LLM prioritizing speed (Cerebras → Groq → NVIDIA) for large payload tasks (like full resume parsing) to prevent Vercel Serverless timeouts.
 * Always tries the user's Primary Model first if provided.
 */
export async function callFastLLM(options: LLMCallOptions): Promise<LLMResponse> {
  const errors: string[] = [];
  const primary = options.modelSelection?.primaryModel;

  // 1. Try Primary Model if specified
  if (primary) {
    try {
      console.log(`[LLM Fast] Trying Primary Model (${primary})...`);
      let result;
      if (primary.startsWith("cerebras:")) {
        const modelId = primary.substring(primary.indexOf(":") + 1);
        result = await tryCerebras(options, modelId);
      } else if (primary.startsWith("groq:")) {
        const modelId = primary.substring(primary.indexOf(":") + 1);
        result = await tryGroq(options, modelId);
      } else if (primary.startsWith("openrouter:")) {
        const modelId = primary.substring(primary.indexOf(":") + 1);
        result = await tryOpenRouter(options, modelId);
      } else {
        const modelId = primary.startsWith("nvidia:") ? primary.substring(primary.indexOf(":") + 1) : primary;
        result = await tryNvidia(options, modelId);
      }
      console.log(`[LLM Fast] Success with Primary Model (${primary})`);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[LLM Fast] Selected Model (${primary}) failed: ${message}`);
      // Internal utilities like Parse JD should always fallback to ensure reliability
      errors.push(`Primary Model (${primary}): ${message}`);
    }
  }

  // 1.5 Try Fallback Model if specified
  if (options.modelSelection?.fallbackModel) {
    const fallback = options.modelSelection.fallbackModel;
    try {
      console.log(`[LLM Fast] Trying Fallback Model (${fallback})...`);
      let result;
      if (fallback.startsWith("cerebras:")) {
        const modelId = fallback.substring(fallback.indexOf(":") + 1);
        result = await tryCerebras(options, modelId);
      } else if (fallback.startsWith("groq:")) {
        const modelId = fallback.substring(fallback.indexOf(":") + 1);
        result = await tryGroq(options, modelId);
      } else if (fallback.startsWith("openrouter:")) {
        const modelId = fallback.substring(fallback.indexOf(":") + 1);
        result = await tryOpenRouter(options, modelId);
      } else {
        const modelId = fallback.startsWith("nvidia:") ? fallback.substring(fallback.indexOf(":") + 1) : fallback;
        result = await tryNvidia(options, modelId);
      }
      console.log(`[LLM Fast] Success with Fallback Model (${fallback})`);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[LLM Fast] Fallback Model (${fallback}) failed: ${message}`);
      errors.push(`Fallback Model (${fallback}): ${message}`);
    }
  }

  // 2. Global fallbacks (Speed priority)

  const globalProviders = [
    { name: "Cerebras", fn: () => tryCerebras(options) },
    { name: "Groq", fn: () => tryGroq(options) },
    { name: "NVIDIA (Fallback Nemotron)", fn: () => tryNvidia(options, "nvidia/nemotron-3-ultra-550b-a55b") },
  ];

  for (const provider of globalProviders) {
    try {
      console.log(`[LLM Fast] Trying ${provider.name}...`);
      const result = await provider.fn();
      console.log(`[LLM Fast] Success with ${provider.name}`);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[LLM Fast] ${provider.name} failed: ${message}`);
      errors.push(`${provider.name}: ${message}`);
    }
  }

  throw new Error(`All Fast LLM providers failed:\n${errors.join("\n")}`);
}


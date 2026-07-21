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
  throw new Error("No JSON object found in LLM response");
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

  const groq = new Groq({ apiKey, maxRetries: 1, timeout: 12000 });
  const modelToUse = forceModel || "llama-3.3-70b-versatile";
  
  try {
    const response = await groq.chat.completions.create({
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

    if (isRateOrSizeLimit) {
      console.warn(`[LLM] Groq Llama token/rate limit hit. Falling back to Cerebras gpt-oss-120b for recovery...`);
      return await tryCerebras(options, "gpt-oss-120b");
    }

    throw err;
  }
}

/**
 * Try NVIDIA provider using dynamic model choice
 */
async function tryNvidia(options: LLMCallOptions, forceModel?: string): Promise<LLMResponse> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY not set");

  const nvidia = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey,
    timeout: 60000, // 60 seconds max per request to prevent 15 minute hangs
    maxRetries: 0, // Fail fast if the model is down or invalid
  });

  // Compress whitespace to save precious tokens
  const cleanedUserMessage = options.userMessage
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  const modelToUse = forceModel || "nvidia/nemotron-3-ultra-550b-a55b";

  const stream = await nvidia.chat.completions.create({
    model: modelToUse,
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: cleanedUserMessage },
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 8000,
    stream: true,
  });

  let content = "";
  for await (const chunk of stream) {
    content += chunk.choices[0]?.delta?.content || "";
  }

  if (!content) throw new Error("Empty NVIDIA response");

  return { content, provider: "nvidia", model: modelToUse };
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
    timeout: 30000,
  });

  const modelToUse = forceModel || "openrouter/free";

  try {
    // Stream the response to get reasoning tokens in usage
    const stream = await openrouter.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.userMessage },
      ],
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 8000,
      stream: true,
      stream_options: { include_usage: true },
      ...(options.jsonMode !== false && { response_format: { type: "json_object" } }),
    });

    let response = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        response += content;
      }

      // Usage information comes in the final chunk (OpenAI style)
      if (chunk.usage) {
        const reasoning = (chunk.usage as any).completion_tokens_details?.reasoning_tokens;
        if (reasoning !== undefined) {
          console.log(`\n[LLM] OpenRouter ${modelToUse} Reasoning tokens:`, reasoning);
        }
      }
    }

    if (!response) throw new Error("Empty OpenRouter response");

    return { content: response, provider: "openrouter", model: modelToUse };
  } catch (err: any) {
    throw err;
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
    timeout: 12000,
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

  // 1. Try Primary Model if specified
  if (options.modelSelection?.primaryModel) {
    const primary = options.modelSelection.primaryModel;
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

  // 1. Try Primary Model if specified
  if (options.modelSelection?.primaryModel) {
    const primary = options.modelSelection.primaryModel;
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


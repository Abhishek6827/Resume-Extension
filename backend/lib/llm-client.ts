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
      response_format: { type: "json_object" },
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
      console.warn(`[LLM] Groq gpt-oss-120b token/rate limit hit. Falling back to llama-3.3-70b-versatile for recovery...`);
      const retryResponse = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: options.systemPrompt },
          { role: "user", content: cleanedUserMessage },
        ],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 8000,
        response_format: { type: "json_object" },
      });

      const content = retryResponse.choices[0]?.message?.content || "";
      if (!content) throw new Error("Empty Groq response on fallback retry");

      return { content, provider: "groq", model: "llama-3.3-70b-versatile" };
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

  const modelToUse = forceModel || "moonshotai/kimi-k2.6";

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
async function tryOpenRouter(options: LLMCallOptions): Promise<LLMResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    timeout: 30000,
  });

  const response = await openrouter.chat.completions.create({
    model: "openrouter/free",
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userMessage },
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 8000,
  });

  const content = response.choices[0]?.message?.content || "";
  if (!content) throw new Error("Empty OpenRouter response");

  return { content, provider: "openrouter", model: "openrouter/free" };
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
    response_format: { type: "json_object" },
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
        const modelId = primary.split(":")[1];
        result = await tryCerebras(options, modelId);
      } else if (primary.startsWith("groq:")) {
        const modelId = primary.split(":")[1];
        result = await tryGroq(options, modelId);
      } else {
        const modelId = primary.startsWith("nvidia:") ? primary.split(":")[1] : primary;
        result = await tryNvidia(options, modelId);
      }
      console.log(`[LLM] Success with Primary Model (${primary})`);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[LLM] Primary Model (${primary}) failed: ${message}. Falling back to default providers...`);
      errors.push(`Primary (${primary}): ${message}`);
    }
  }

  // 2. Global fallbacks if no user selection
  const globalProviders = [
    { name: "NVIDIA (Default Kimi)", fn: () => tryNvidia(options, "moonshotai/kimi-k2.6") },
    { name: "Cerebras", fn: () => tryCerebras(options) },
    { name: "Groq", fn: () => tryGroq(options) },
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
        const modelId = primary.split(":")[1];
        result = await tryCerebras(options, modelId);
      } else if (primary.startsWith("groq:")) {
        const modelId = primary.split(":")[1];
        result = await tryGroq(options, modelId);
      } else {
        const modelId = primary.startsWith("nvidia:") ? primary.split(":")[1] : primary;
        result = await tryNvidia(options, modelId);
      }
      console.log(`[LLM Fast] Success with Primary Model (${primary})`);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[LLM Fast] Primary Model (${primary}) failed: ${message}. Falling back to default providers...`);
      errors.push(`Primary (${primary}): ${message}`);
    }
  }

  // 2. Global fallbacks (Speed priority)

  const globalProviders = [
    { name: "Cerebras", fn: () => tryCerebras(options) },
    { name: "Groq", fn: () => tryGroq(options) },
    { name: "NVIDIA (Fallback Kimi)", fn: () => tryNvidia(options, "moonshotai/kimi-k2.6") },
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


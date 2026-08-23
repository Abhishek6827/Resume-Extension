// ─── Multi-Provider LLM Client ─────────────────────────────
// Supported providers:
// NVIDIA NIM:
//   - nvidia/nemotron-3.5-lightning-30b-a3b (Fast / Thinking)
//   - nvidia/nemotron-3-super-120b-a12b (Balanced / 120B)
//   - nvidia/nemotron-3-ultra-550b-a55b (Quality / 550B)
// Groq:
//   - qwen/qwen3.6-27b (Fast / Cover Letter)
//   - openai/gpt-oss-120b (Quality / Cover Letter)

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
 * Strip <think>...</think> tags and raw thinking process preambles from model responses
 */
function stripThinkTags(text: string): string {
  if (!text) return "";
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // If model outputs raw thinking process in plain text before LaTeX
  if (cleaned.includes("\\documentclass")) {
    const docIdx = cleaned.indexOf("\\documentclass");
    cleaned = cleaned.substring(docIdx);
  }
  return cleaned.trim();
}

/**
 * Extract JSON object from a response that may be wrapped in markdown fences
 */
export function extractJSON(text: string): string {
  const cleaned = stripThinkTags(text);
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0].replace(/,\s*([\}\]])/g, "$1");
  }
  
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

/**
 * Call NVIDIA NIM API provider
 */
async function tryNvidia(options: LLMCallOptions, forceModel?: string): Promise<LLMResponse> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY not set");

  const modelToUse = forceModel || "nvidia/nemotron-3.5-lightning-30b-a3b";

  const nvidia = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey,
    timeout: 180000,
    maxRetries: 2,
  });

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
      max_tokens: options.maxTokens ?? 16384,
      stream: true, // Always use stream: true for NVIDIA NIM endpoints to prevent truncation and 429 concurrency drops
    };

    // Specific model configurations as specified in NVIDIA specs
    if (modelToUse === "nvidia/nemotron-3.5-lightning-30b-a3b" || modelToUse.includes("lightning")) {
      requestOptions.temperature = 0.2;
      requestOptions.max_tokens = 16384;
      requestOptions.chat_template_kwargs = { enable_thinking: false };
    } else if (modelToUse === "nvidia/nemotron-3-super-120b-a12b" || modelToUse.includes("120b")) {
      requestOptions.temperature = 0.2;
      requestOptions.max_tokens = 16384;
    } else if (modelToUse === "nvidia/nemotron-3-ultra-550b-a55b" || modelToUse.includes("550b")) {
      requestOptions.temperature = 0.2;
      requestOptions.top_p = 0.95;
      requestOptions.max_tokens = 16384;
    }

    const stream = await nvidia.chat.completions.create(requestOptions) as any;
    let content = "";
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) {
        content += delta.content;
      }
    }
    content = stripThinkTags(content);
    if (!content) throw new Error(`Empty streamed response from NVIDIA (${modelToUse})`);
    return { content, provider: "nvidia", model: modelToUse };
  } catch (err: any) {
    throw err;
  }
}

/**
 * Get Groq API keys from env, rotating through available keys
 */
function getGroqApiKeys(): string[] {
  const keys: string[] = [];
  const k1 = process.env.GROQ_API_KEY;
  const k2 = process.env.GROQ_API_KEY_2;
  const k3 = process.env.GROQ_API_KEY_3;
  if (k1) keys.push(k1);
  if (k2) keys.push(k2);
  if (k3) keys.push(k3);
  return keys;
}

/**
 * Call Groq API provider with key rotation on failure
 */
async function tryGroq(options: LLMCallOptions, forceModel?: string): Promise<LLMResponse> {
  const keys = getGroqApiKeys();
  if (keys.length === 0) throw new Error("No GROQ_API_KEY set");

  const modelToUse = forceModel || "qwen/qwen3.6-27b";
  let lastError: Error | null = null;

  for (const apiKey of keys) {
    const groq = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey,
      timeout: 120000,
      maxRetries: 1,
    });

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
        max_tokens: options.maxTokens ?? 8192,
        stream: true,
      };

      const stream = await groq.chat.completions.create(requestOptions) as any;
      let content = "";
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          content += delta.content;
        }
      }
      content = stripThinkTags(content);
      if (!content) throw new Error(`Empty streamed response from Groq (${modelToUse})`);
      return { content, provider: "groq", model: modelToUse };
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || "";
      // Rotate to next key on rate limit or auth errors
      if (msg.includes("rate_limit") || msg.includes("429") || msg.includes("401") || msg.includes("413")) {
        console.warn(`[Groq] Key rotation: ${msg.substring(0, 80)}...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("All Groq API keys exhausted");
}

/**
 * Route a model call to the correct provider based on prefix ("groq:" or "nvidia:")
 */
async function tryProvider(options: LLMCallOptions, modelId: string): Promise<LLMResponse> {
  if (modelId.startsWith("groq:")) {
    return tryGroq(options, modelId.substring(5));
  }
  // Default: NVIDIA (strip "nvidia:" prefix if present)
  const nvidiaModel = modelId.startsWith("nvidia:") ? modelId.substring(7) : modelId;
  return tryNvidia(options, nvidiaModel);
}

/**
 * Call LLM with automatic fallback chain.
 */
export async function callLLM(options: LLMCallOptions): Promise<LLMResponse> {
  const errors: string[] = [];
  const primary = options.modelSelection?.primaryModel;

  // 1. Try Primary Model if specified
  if (primary) {
    try {
      console.log(`[LLM] Trying Primary Model (${primary})...`);
      const result = await tryProvider(options, primary);
      console.log(`[LLM] Success with Primary Model (${primary})`);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[LLM] Selected Model (${primary}) failed: ${message}`);
      if (!options.modelSelection?.fallbackModel && primary.startsWith("groq:")) {
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
      const result = await tryProvider(options, fallback);
      console.log(`[LLM] Success with Fallback Model (${fallback})`);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[LLM] Fallback Model (${fallback}) failed: ${message}`);
      errors.push(`Fallback Model (${fallback}): ${message}`);
    }
  }

  // 2. Fallbacks for resume tailoring (NVIDIA models)
  const globalProviders = [
    { name: "NVIDIA (Nemotron Lightning)", modelId: "nvidia:nvidia/nemotron-3.5-lightning-30b-a3b" },
    { name: "NVIDIA (Nemotron 120B)", modelId: "nvidia:nvidia/nemotron-3-super-120b-a12b" },
    { name: "NVIDIA (Nemotron 550B)", modelId: "nvidia:nvidia/nemotron-3-ultra-550b-a55b" },
  ];

  for (const provider of globalProviders) {
    try {
      console.log(`[LLM] Fallback trying ${provider.name}...`);
      const result = await tryProvider(options, provider.modelId);
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
 * Call LLM prioritizing speed with automatic fallback chain.
 */
export async function callFastLLM(options: LLMCallOptions): Promise<LLMResponse> {
  const errors: string[] = [];
  const primary = options.modelSelection?.primaryModel;

  if (primary) {
    try {
      console.log(`[LLM Fast] Trying Primary Model (${primary})...`);
      const result = await tryProvider(options, primary);
      console.log(`[LLM Fast] Success with Primary Model (${primary})`);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[LLM Fast] Selected Model (${primary}) failed: ${message}`);
      errors.push(`Primary Model (${primary}): ${message}`);
    }
  }

  if (options.modelSelection?.fallbackModel) {
    const fallback = options.modelSelection.fallbackModel;
    try {
      console.log(`[LLM Fast] Trying Fallback Model (${fallback})...`);
      const result = await tryProvider(options, fallback);
      console.log(`[LLM Fast] Success with Fallback Model (${fallback})`);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[LLM Fast] Fallback Model (${fallback}) failed: ${message}`);
      errors.push(`Fallback Model (${fallback}): ${message}`);
    }
  }

  const globalProviders = [
    { name: "NVIDIA (Nemotron Lightning)", modelId: "nvidia:nvidia/nemotron-3.5-lightning-30b-a3b" },
    { name: "NVIDIA (Nemotron 120B)", modelId: "nvidia:nvidia/nemotron-3-super-120b-a12b" },
    { name: "NVIDIA (Nemotron 550B)", modelId: "nvidia:nvidia/nemotron-3-ultra-550b-a55b" },
  ];

  for (const provider of globalProviders) {
    try {
      console.log(`[LLM Fast] Fallback trying ${provider.name}...`);
      const result = await tryProvider(options, provider.modelId);
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


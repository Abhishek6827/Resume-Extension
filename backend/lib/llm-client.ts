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
 * Get NVIDIA API keys from env, rotating through available keys
 */
function getNvidiaApiKeys(): string[] {
  const keys: string[] = [];
  const k1 = process.env.NVIDIA_API_KEY;
  const k2 = process.env.NVIDIA_API_KEY_2;
  const k3 = process.env.NVIDIA_API_KEY_3;
  const k4 = process.env.NVIDIA_API_KEY_4;
  if (k1) keys.push(k1);
  if (k2) keys.push(k2);
  if (k3) keys.push(k3);
  if (k4) keys.push(k4);
  return keys;
}

/**
 * Call NVIDIA NIM API provider with key rotation and backoff on failure
 */
async function tryNvidia(options: LLMCallOptions, forceModel?: string): Promise<LLMResponse> {
  const keys = getNvidiaApiKeys();
  if (keys.length === 0) throw new Error("No NVIDIA_API_KEY set");

  const modelToUse = forceModel || "moonshotai/kimi-k3";

  const cleanedUserMessage = options.userMessage
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  let lastError: any = null;

  for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
    const apiKey = keys[keyIdx];
    const nvidia = new OpenAI({
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey,
      timeout: 600000,
      maxRetries: 2,
    });

    const maxRetries = keys.length === 1 ? 3 : 1;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const requestOptions: any = {
          model: modelToUse,
          messages: [
            { role: "system", content: options.systemPrompt },
            { role: "user", content: cleanedUserMessage },
          ],
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 16384,
          stream: true,
        };

        // Specific model configurations as specified in NVIDIA specs
        if (modelToUse === "moonshotai/kimi-k3" || modelToUse.includes("kimi")) {
          requestOptions.temperature = 0.6;
          requestOptions.max_tokens = options.maxTokens ?? 16384;
          requestOptions.seed = 0;
          requestOptions.stream = true;
        } else if (modelToUse === "nvidia/nemotron-3-nano-30b-a3b" || modelToUse.includes("nano") || modelToUse.includes("lightning")) {
          requestOptions.temperature = 0.2;
          requestOptions.max_tokens = options.maxTokens ?? 16384;
          requestOptions.stream = true;
        } else if (modelToUse === "nvidia/nemotron-3-super-120b-a12b" || modelToUse.includes("120b")) {
          requestOptions.temperature = 0.2;
          requestOptions.max_tokens = options.maxTokens ?? 16384;
          requestOptions.stream = true;
        } else if (modelToUse === "nvidia/nemotron-3-ultra-550b-a55b" || modelToUse.includes("550b")) {
          requestOptions.temperature = 0.2;
          requestOptions.top_p = 0.95;
          requestOptions.max_tokens = options.maxTokens ?? 16384;
          requestOptions.stream = false;
        }

        let content = "";
        if (requestOptions.stream) {
          const stream = await nvidia.chat.completions.create(requestOptions) as any;
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              content += delta.content;
            }
          }
        } else {
          const response = await nvidia.chat.completions.create(requestOptions) as any;
          content = response.choices?.[0]?.message?.content || "";
        }

        content = stripThinkTags(content);
        if (!content) throw new Error(`Empty response from NVIDIA (${modelToUse})`);
        return { content, provider: "nvidia", model: modelToUse };
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        const is429 = err?.status === 429 || msg.includes("429") || msg.includes("rate_limit") || msg.includes("concurrency");

        if (is429) {
          if (keys.length > 1 && keyIdx < keys.length - 1) {
            console.warn(`[NVIDIA] Key ${keyIdx + 1} concurrency limit on ${modelToUse}. Rotating to key ${keyIdx + 2}...`);
            break; // Try next key
          } else if (attempt < maxRetries) {
            const delay = attempt * 2500;
            console.warn(`[NVIDIA] Concurrency limit (429) on ${modelToUse}. Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})...`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
        }
        throw err;
      }
    }
  }

  throw lastError;
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

  const modelToUse = forceModel || "openai/gpt-oss-120b";
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
        max_tokens: options.maxTokens ?? 3500,
        stream: false,
      };

      const response = await groq.chat.completions.create(requestOptions) as any;
      let content = response.choices?.[0]?.message?.content || "";
      content = stripThinkTags(content);
      if (!content) throw new Error(`Empty response from Groq (${modelToUse})`);
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
 * Call LLM directly with NO fallback. Throws exact error immediately on failure.
 */
export async function callLLM(options: LLMCallOptions): Promise<LLMResponse> {
  const modelToUse = options.modelSelection?.primaryModel || "nvidia:moonshotai/kimi-k3";

  console.log(`[LLM] Calling Model (${modelToUse})...`);
  try {
    const result = await tryProvider(options, modelToUse);
    console.log(`[LLM] Success with Model (${modelToUse})`);
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[LLM] Model (${modelToUse}) failed: ${message}`);
    throw err;
  }
}

/**
 * Call fast LLM directly with NO fallback. Throws exact error immediately on failure.
 */
export async function callFastLLM(options: LLMCallOptions): Promise<LLMResponse> {
  const modelToUse = options.modelSelection?.primaryModel || "groq:openai/gpt-oss-120b";

  console.log(`[LLM Fast] Calling Model (${modelToUse})...`);
  try {
    const result = await tryProvider(options, modelToUse);
    console.log(`[LLM Fast] Success with Model (${modelToUse})`);
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[LLM Fast] Model (${modelToUse}) failed: ${message}`);
    throw err;
  }
}


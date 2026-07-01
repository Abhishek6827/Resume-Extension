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
async function tryGroq(options: LLMCallOptions): Promise<LLMResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const groq = new Groq({ apiKey, maxRetries: 1, timeout: 30000 });
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userMessage },
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 8000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content || "";
  if (!content) throw new Error("Empty Groq response");

  return { content, provider: "groq", model: "llama-3.3-70b-versatile" };
}

/**
 * Try NVIDIA provider (fallback 1 — Kimi K2.6 via OpenAI-compatible API)
 */
async function tryNvidia(options: LLMCallOptions): Promise<LLMResponse> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY not set");

  const nvidia = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey,
    timeout: 30000,
  });

  const response = await nvidia.chat.completions.create({
    model: "meta/llama-3.3-70b-instruct",
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userMessage },
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 8000,
  });

  const content = response.choices[0]?.message?.content || "";
  if (!content) throw new Error("Empty NVIDIA response");

  return { content, provider: "nvidia", model: "meta/llama-3.3-70b-instruct" };
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
    model: "google/gemini-2.5-flash:free",
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userMessage },
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 8000,
  });

  const content = response.choices[0]?.message?.content || "";
  if (!content) throw new Error("Empty OpenRouter response");

  return { content, provider: "openrouter", model: "google/gemini-2.5-flash:free" };
}

/**
 * Try Cerebras provider (primary — incredibly fast inference)
 */
async function tryCerebras(options: LLMCallOptions): Promise<LLMResponse> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) throw new Error("CEREBRAS_API_KEY not set");

  const cerebras = new OpenAI({
    baseURL: "https://api.cerebras.ai/v1",
    apiKey,
    timeout: 30000,
  });

  const response = await cerebras.chat.completions.create({
    model: "gpt-oss-120b", // Using Llama 3.3 70B as it's their flagship (Cerebras doesn't host gpt-oss-120b)
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userMessage },
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 8000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content || "";
  if (!content) throw new Error("Empty Cerebras response");

  return { content, provider: "cerebras", model: "gpt-oss-120b" };
}

/**
 * Call LLM with automatic provider fallback chain.
 * Tries: Cerebras → Groq → NVIDIA → OpenRouter
 */
export async function callLLM(options: LLMCallOptions): Promise<LLMResponse> {
  const providers = [
    { name: "Cerebras", fn: tryCerebras },
    { name: "Groq", fn: tryGroq },
    { name: "NVIDIA", fn: tryNvidia },
    { name: "OpenRouter", fn: tryOpenRouter },
  ];

  const errors: string[] = [];

  for (const provider of providers) {
    try {
      console.log(`[LLM] Trying ${provider.name}...`);
      const result = await provider.fn(options);
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

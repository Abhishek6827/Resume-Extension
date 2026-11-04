import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../lib/cors";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

const WARMUP_MODELS = [
  { id: "gemini:cascade", name: "Gemini Cascade", provider: "gemini" },
  { id: "stepfun-ai/step-5-preview", name: "StepFun Step-5" },
  { id: "mistralai/mistral-large-4-1t-a52b", name: "Mistral Large 4" },
  { id: "nvidia/nemotron-3.5-lightning-30b-a3b", name: "Nemotron 30B" },
];

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.NVIDIA_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2;
  if (!apiKey && !geminiKey) {
    return NextResponse.json({ error: "No NVIDIA_API_KEY" }, { status: 500, headers: getCorsHeaders(request) });
  }

  const { searchParams } = new URL(request.url);
  const requestedModel = searchParams.get("model");

  let targetModels = WARMUP_MODELS;
  if (requestedModel) {
    const clean = requestedModel.replace(/^(nvidia|gemini):/, "").toLowerCase();
    const isGeminiMatch = clean.includes("gemini") || clean.includes("cascade") || clean.includes("gemma");
    const matched = WARMUP_MODELS.filter(
      (m) => (isGeminiMatch && m.id.includes("gemini")) || m.id.toLowerCase() === clean || m.id.toLowerCase().includes(clean) || m.name.toLowerCase() === clean
    );
    if (matched.length > 0) {
      targetModels = matched;
    }
  }

  const nvidia = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey,
    timeout: 15000,
    maxRetries: 0,
  });

  console.log(`[Warmup] Warming up: ${targetModels.map((m) => m.name).join(", ")}`);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        } catch (_) { }
      };

      // Send initial queued state for target models
      targetModels.forEach((m) => {
        sendEvent({ model: m.name, status: "warming" });
      });

      // Run target models with light staggering and 429/503 backoff
      await Promise.allSettled(
        targetModels.map(async (model, idx) => {
          if (idx > 0) {
            await new Promise((r) => setTimeout(r, idx * 200));
          }
          const requestOptions: any = {
            model: model.id,
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 1,
            stream: false,
          };
          if (model.id.includes("nemotron-3.5")) {
            requestOptions.chat_template_kwargs = { thinking: false };
          }

          let lastErr: any = null;
          let latency = 0;
          let success = false;

          for (let attempt = 1; attempt <= 2; attempt++) {
            const start = Date.now();
            try {
              if (model.id.includes("gemini") || model.id.includes("cascade")) {
                if (!geminiKey) throw new Error("No GEMINI_API_KEY configured");
                const gemini = new OpenAI({
                  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
                  apiKey: geminiKey,
                  timeout: 15000,
                  maxRetries: 0,
                });
                await gemini.chat.completions.create({
                  model: "gemini-3.6-flash",
                  messages: [{ role: "user", content: "hi" }],
                  max_tokens: 1,
                });
              } else {
                await nvidia.chat.completions.create(requestOptions);
              }
              latency = Date.now() - start;
              success = true;
              console.log(`[Warmup] ${model.name} ready (${latency}ms)`);
              sendEvent({ model: model.name, status: "ready", latency });
              break;
            } catch (err: any) {
              latency = Date.now() - start;
              lastErr = err;
              const msg = err?.message || "";
              const is503 = err?.status === 503 || msg.includes("503") || msg.includes("overloaded");
              const is429 = err?.status === 429 || msg.includes("429") || msg.includes("rate_limit") || msg.includes("Too Many Requests");
              if ((is503 || is429) && attempt === 1) {
                // Backoff for momentary NVIDIA concurrency / overload spikes
                await new Promise((r) => setTimeout(r, 1500));
                continue;
              }
              break;
            }
          }

          if (!success) {
            const error = lastErr?.message?.substring(0, 120) || "Unknown error";
            console.warn(`[Warmup] ${model.name} failed (${latency}ms): ${error}`);
            sendEvent({ model: model.name, status: "failed", latency, error });
          }
        })
      );

      sendEvent({ done: true });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      ...getCorsHeaders(request),
    },
  });
}

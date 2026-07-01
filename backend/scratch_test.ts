import fs from "fs";
import path from "path";
import { modifyOriginalPDF } from "./lib/pdf-modifier";

async function main() {
  const pdfPath = path.join(__dirname, "..", "test-resume.pdf");
  const pdfBytes = fs.readFileSync(pdfPath);
  
  const changes = [
    {
      originalValue: "Full-stack engineer specialising in payment infrastructure (Stripe/Zoho parallel gateway, HMAC webhook pipelines) and LLM systems (multi-provider runtime routing). Currently running CHINTU AI — a live multi-LLM SaaS with 40 active paying subscribers. Previously sole engineer across 4 production applications and payments owner at a fintech platform. Seeking mid-to-senior roles where end-to-end backend ownership is expected, not exceptional.",
      newValue: "Full-stack engineer specializing in payment infrastructure and LLM systems. Currently running CHINTU AI — a live multi-LLM SaaS with 40 active Stripe subscribers."
    },
    {
      originalValue: "Solo-built live multi-LLM SaaS — 40 active Stripe subscribers, 500+ registered users",
      newValue: "Solo-built live multi-LLM SaaS — 40 active Stripe subscribers and 500+ registered users"
    },
    {
      originalValue: "Designed a runtime multi-LLM routing layer (Groq, OpenRouter, DashScope) selecting optimal provider per request type; handles ~800 LLM requests/day with automatic fallback and <200 ms P95 latency",
      newValue: "Designed a runtime multi-LLM routing layer selecting optimal provider per request type; handles ~800 LLM requests/day with automatic fallback"
    },
    {
      originalValue: "Introduced memoized selectors with reselect across 12 Redux-connected React components, eliminating full-tree re-renders; measured 25% improvement (~550 ms), confirmed in production server-timing logs.",
      newValue: "Implemented memoized selectors across 12 React/Redux components, reducing unnecessary re-renders by 25% and improving server-timing performance."
    },
    {
      originalValue: "Eliminated N+1 query patterns and added composite indexes on 3 high-traffic Node.js backend endpoints; p95 response time dropped from ~850 ms to under 200 ms",
      newValue: "Eliminated N+1 query patterns and added composite indexes on 3 Node.js backend endpoints; p95 response time dropped from ~850 ms to under 200 ms."
    },
    {
      originalValue: "Migrated CI/CD to Firebase App Hosting for React/Next.js applications, cutting deployment time from 30 min to under 5 min; implemented idempotency key handling and HMAC signature verification across all Node.js backend endpoints, preventing duplicate transactions and replay attacks.",
      newValue: "Migrated CI/CD to Firebase App Hosting for React/Next.js applications, cutting deployment time from 30 min to under 5 min."
    },
    {
      originalValue: "...",
      newValue: "This should be skipped"
    },
    {
      originalValue: "abc",
      newValue: "This should also be skipped"
    }
  ];
  
  try {
    const result = await modifyOriginalPDF(new Uint8Array(pdfBytes), changes);
    fs.writeFileSync(path.join(__dirname, "test-output.pdf"), result);
    console.log("SUCCESS: Modified PDF written to test-output.pdf");
  } catch (err) {
    console.error("FAILED:", err);
  }
}

main();

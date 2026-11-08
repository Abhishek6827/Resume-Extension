import * as fs from "fs";
import * as path from "path";
import { generateOutreachPack, answerPortalQuestion } from "../lib/application-outreach";

// Load .env.local if present
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function runTests() {
  console.log("=== Testing Outreach Pack & Portal Q&A ===");

  const sampleJd = `
Role: Full Stack Engineer
Company: CloudScale
Requirements: React.js, Node.js, Python, PostgreSQL, MySQL.
Experience building high-throughput web apps and transactional systems.
`;

  const sampleResume = `
Abhishek Tiwari | Lucknow, India | +91 70816 60941 | abhishektiwari6827@gmail.com
Portfolio: portfolio.getchintu.com | SaaS: getchintu.com
Experience:
- Founder & Lead Full Stack Engineer at CHINTU AI (Feb 2026 – Present): 1,200+ users, 25k+ monthly requests, 99.8% uptime. React, Node, Python, MySQL, Razorpay webhook HMAC.
- Contract Full Stack & Data Engineer at ICICL (Nov 2025 – Jan 2026): Java Maven, Node, PostgreSQL, webhook pipeline latency 20m -> under 3m.
`;

  // Test 1: Generate Outreach Pack
  console.log("\n[Test 1] Running generateOutreachPack...");
  const pack = await generateOutreachPack({
    resume: sampleResume,
    jd: sampleJd,
    coverLetter: "Cover letter focusing on CHINTU AI 1,200+ users and ICICL webhook pipeline.",
    candidateName: "Abhishek Tiwari",
  });

  console.log("✓ Outreach Pack generated successfully!");
  console.log("Email Subject:", pack.email.subject);
  console.log(`Email Body Words: ${pack.email.body.trim().split(/\s+/).length} words`);
  console.log(`LinkedIn Note (${pack.linkedinConnectionNote.length} chars):`, pack.linkedinConnectionNote);
  console.log("WhatsApp Message:", pack.whatsappMessage);
  console.log("Contact Form Pitch:", pack.contactFormNote);

  // Assertions
  if (pack.linkedinConnectionNote.length > 300) {
    throw new Error(`LinkedIn connection note exceeds 300 chars: ${pack.linkedinConnectionNote.length}`);
  }
  if (!pack.email.subject || !pack.email.body) {
    throw new Error("Email subject or body is missing!");
  }

  // Test 2: Answer Portal Question
  console.log("\n[Test 2] Running answerPortalQuestion...");
  const testQuestion = "What product have you built? Give description and live links. Keep under 100 words.";
  const answer = await answerPortalQuestion({
    question: testQuestion,
    resume: sampleResume,
    jd: sampleJd,
    candidateName: "Abhishek Tiwari",
  });

  console.log("✓ Portal Question Answered!");
  console.log("Question:", testQuestion);
  console.log("Answer:", answer);
  console.log(`Word Count: ${answer.trim().split(/\s+/).length} words`);

  console.log("\n=== All Tests Passed Successfully! ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});


import * as fs from "fs";
import * as path from "path";
import { generateOutreachPack } from "../lib/application-outreach";

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

async function runBuildAITest() {
  console.log("=== Testing Build AI JD with Verification Security Batch ===");

  const buildAiJd = `
About Build AI
Build AI is the data hyperscaler for Physical AI. We're vertically integrated across hardware, manufacturing, logistics, collection, and model training to scale the physical labor dataset orders of magnitude faster than anyone in the world.

Job Summary
We build hardware and software to collect data from people doing physical work. We’re hiring a Software Engineer in India to build the systems that run these operations at scale.

Our field teams recruit workers, assign wearable cameras, collect devices, upload footage, and coordinate payments. Your software should make this process reliable and easy to run across cities. You will work closely with founders and operations teams to identify problems, ship solutions quickly, and improve them based on field use — owning each problem from understanding through deployment and support. You should be comfortable working across the stack and learning whatever is needed.

Key Responsibilities:
- Build web and mobile tools for field teams, partners, and internal operations
- Build workflows for worker onboarding, device assignment, attendance, collection tracking, and payments
- Build dashboards that make collection volume, data quality, costs, and operational problems visible
- Integrate applications with upload, storage, and data quality systems
- Make field workflows reliable when connectivity is poor or uploads fail
- Automate manual processes that slow down operations or introduce errors
`;

  const sampleResume = `
Abhishek Tiwari | Lucknow, India | +91 70816 60941 | abhishektiwari6827@gmail.com
Portfolio: portfolio.getchintu.com | SaaS: getchintu.com
Summary: Full Stack Developer with 2+ years of production experience building high-throughput web apps, transactional payment systems, and distributed backends.
Experience:
- Founder & Lead Full Stack Engineer at CHINTU AI (Feb 2026 – Present): Solo-built and operating live SaaS platform (getchintu.com) serving 1,200+ registered users with 99.8% uptime. React.js frontend, Node.js and Python microservices, normalized MySQL/PostgreSQL databases with sub-120ms p95 query latency, Razorpay webhook event pipeline with HMAC signature validation and idempotent transaction processing.
- Contract Full Stack & Data Engineer at ICICL (Nov 2025 – Jan 2026): Java Maven & Node.js backend services, replacing polling with event-driven webhook pipeline that cut failure detection lag from 20m to under 3m with 100% financial data reconciliation. Optimized PostgreSQL queries via EXPLAIN ANALYZE, eliminating full-table scans and boosting query speeds by 60%.
- Full Stack Software Developer at Vasnaani Sanskaran (Aug 2024 – Oct 2025): 4 production web apps across React, Node, Java, MySQL. Memoized Redux selectors 25% render optimization.
`;

  console.log("\n[Test] Calling generateOutreachPack for Build AI...");
  const pack = await generateOutreachPack({
    resume: sampleResume,
    jd: buildAiJd,
    candidateName: "Abhishek Tiwari",
  });

  console.log("\n=== GENERATED & VERIFIED OUTREACH PACK ===");
  console.log("Subject:", pack.email.subject);
  console.log("\nEmail Body:\n", pack.email.body);
  console.log(`Word Count: ${pack.email.body.trim().split(/\s+/).length} words`);
  console.log("\nLinkedIn Note:\n", pack.linkedinConnectionNote);
  console.log(`LinkedIn Char Count: ${pack.linkedinConnectionNote.length} chars`);
  console.log("\nWhatsApp Message:\n", pack.whatsappMessage);
  console.log("\nVerification Security Report:", pack.verificationReport);

  // Check for hallucinations:
  const bodyLower = pack.email.body.toLowerCase();
  if (bodyLower.includes("video upload") || bodyLower.includes("wearable camera") || bodyLower.includes("logistics project")) {
    console.error("FAIL: Hallucination detected in email body!");
    process.exit(1);
  } else {
    console.log("\n✓ PASS: Zero fake video or logistics claims found in email body!");
  }
}

runBuildAITest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

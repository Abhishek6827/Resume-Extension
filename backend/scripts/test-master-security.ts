import * as fs from "fs";
import * as path from "path";
import { runMasterSecurityAudit } from "../lib/master-security";
import { attachCanonicalEmailSignature } from "../lib/application-outreach";

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

async function runMasterSecurityTests() {
  console.log("=== Testing Master Security Cross-Artifact Consistency Gate ===");

  // Test 1: Test deterministic signature attachment
  console.log("\n[Test 1] Testing hardcoded signature attachment...");
  const sampleBody = "I'm applying for the role. Let's chat. Thanks, Abhishek Tiwari";
  const signedBody = attachCanonicalEmailSignature(sampleBody);
  console.log("Signed Body:\n" + signedBody);
  if (!signedBody.includes("portfolio.getchintu.com | +91 70816 60941")) {
    throw new Error("Signature missing portfolio or phone!");
  }
  console.log("✓ Signature correctly hardcoded!");

  // Test 2: Master Security Cross-Audit with deliberately inconsistent assets
  console.log("\n[Test 2] Testing Master Security Cross-Check with Inconsistent Draft...");
  const sampleResume = `
Abhishek Tiwari | Lucknow, India | +91 70816 60941 | abhishektiwari6827@gmail.com
Summary: Full Stack Developer with 2+ years of production experience building high-throughput web apps and transactional systems.
Experience:
- CHINTU AI (Feb 2026 – Present): Solo-built SaaS serving 1,200+ users, 25k+ monthly requests, 99.8% uptime, React, Node, Python, MySQL, PostgreSQL.
- ICICL (Nov 2025 – Jan 2026): Java Maven & Node.js webhook pipeline cutting failure lag from 20m to under 3m, 100% financial reconciliation.
- Vasnaani Sanskaran (Aug 2024 – Oct 2025): 4 production web apps, Redux memoized selectors 25% render boost.
- Hoping Minds (Jan 2024 – Jun 2024): Software Developer Intern, Lighthouse 68 -> 94.
`;

  // Inject discrepancies: Cover Letter claims "over 5 years" and "MongoDB", email has incomplete signature
  const inconsistentCoverLetter = `
Dear Hiring Team,
With over 5 years of full stack experience and deep expertise in MongoDB, I am writing to apply for the role. At CHINTU AI I scaled our platform to thousands of daily users.
`;

  const inconsistentOutreachPack = {
    email: {
      subject: "Software Engineer Application - Abhishek Tiwari",
      body: "Hi team,\n\nI have 5+ years of experience working with MongoDB and distributed backends.\n\nThanks,\nAbhishek",
    },
    linkedinConnectionNote: "Hi, I have 5 years of software engineering experience and built systems at scale.",
    whatsappMessage: "Hey, applying for SWE role. 5 years exp. portfolio.getchintu.com",
    contactFormNote: "Senior engineer with 5 years experience.",
  };

  console.log("Running runMasterSecurityAudit...");
  const report = await runMasterSecurityAudit({
    resumeText: sampleResume,
    coverLetter: inconsistentCoverLetter,
    outreachPack: inconsistentOutreachPack,
    jdText: "Role: Software Engineer\nRequirements: 2+ years experience, React, Node, SQL.",
  });

  console.log("\n=== MASTER SECURITY AUDIT RESULTS ===");
  console.log("Cohesion Score:", report.score);
  console.log("Checks Breakdown:", JSON.stringify(report.checks, null, 2));
  console.log("Discrepancies Resolved:", report.discrepanciesResolved);
  console.log("\nReconciled Email Body:\n", report.reconciledOutreachPack.email.body);

  // Assertions
  if (!report.reconciledOutreachPack.email.body.includes("portfolio.getchintu.com | +91 70816 60941")) {
    throw new Error("FAIL: Email body did not have hardcoded canonical signature!");
  }
  if (report.reconciledOutreachPack.email.body.includes("5 years") || report.reconciledOutreachPack.email.body.includes("5+ years")) {
    throw new Error("FAIL: Master Security failed to reconcile experience year inflation!");
  }

  console.log("\n✓ PASS: All discrepancies resolved and signature hardcoded!");
  console.log("=== Master Security Audit Tests Completed Successfully! ===");
}

runMasterSecurityTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});


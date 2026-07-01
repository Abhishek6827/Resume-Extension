import type { ResumeData, JDData, TailoredChange, ScoreResult } from "./types";

// Fallback to localhost:3000 during local testing
const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

/**
 * Applies only approved changes to the original resume, keeping rejected/pending fields as original.
 * Returns a new ResumeData ready for export.
 */
export function applyApprovedChanges(
  original: ResumeData,
  changes: TailoredChange[]
): ResumeData {
  // Start with a deep clone of the original
  const result: ResumeData = JSON.parse(JSON.stringify(original));

  for (const change of changes) {
    if (change.status !== "approved") continue;

    if (change.field === "title") {
      result.title = change.newValue;
    } else if (change.field === "summary") {
      result.summary = change.newValue;
    } else if (change.field.startsWith("experience[")) {
      // Parse experience[i].highlights[j]
      const match = change.field.match(/^experience\[(\d+)\]\.highlights\[(\d+)\]$/);
      if (match) {
        const expIdx = parseInt(match[1], 10);
        const bulletIdx = parseInt(match[2], 10);
        if (result.experience[expIdx]?.highlights) {
          result.experience[expIdx].highlights[bulletIdx] = change.newValue;
        }
      }
    } else if (change.field.startsWith("projects[")) {
      // Parse projects[i].description or projects[i].highlights[j]
      const descMatch = change.field.match(/^projects\[(\d+)\]\.description$/);
      const bulletMatch = change.field.match(/^projects\[(\d+)\]\.highlights\[(\d+)\]$/);
      if (descMatch) {
        const projIdx = parseInt(descMatch[1], 10);
        if (result.projects[projIdx]) {
          result.projects[projIdx].description = change.newValue;
        }
      } else if (bulletMatch) {
        const projIdx = parseInt(bulletMatch[1], 10);
        const bulletIdx = parseInt(bulletMatch[2], 10);
        if (result.projects[projIdx]?.highlights) {
          result.projects[projIdx].highlights[bulletIdx] = change.newValue;
        }
      }
    } else if (change.field.startsWith("skills.")) {
      // Parse skills.languages, skills.frameworks, etc.
      const skillKey = change.field.replace("skills.", "") as keyof typeof result.skills;
      if (result.skills) {
        // change.newValue is a comma separated string, so split it back to array
        result.skills[skillKey] = change.newValue.split(",").map(s => s.trim()).filter(Boolean);
      }
    }
  }

  return result;
}

/**
 * Uploads a file (PDF/DOCX) or sends raw text to parse into structured ResumeData JSON
 */
export async function parseResume(options: { file?: File; text?: string }): Promise<ResumeData> {
  const { file, text } = options;

  let response: Response;

  if (file) {
    const formData = new FormData();
    formData.append("file", file);
    response = await fetch(`${API_BASE}/api/parse-resume`, {
      method: "POST",
      body: formData,
    });
  } else if (text) {
    response = await fetch(`${API_BASE}/api/parse-resume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
  } else {
    throw new Error("No file or text provided for resume parsing");
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: "Failed to parse resume" }));
    throw new Error(errData.error || `HTTP error: ${response.status}`);
  }

  return await response.json();
}

/**
 * Sends a job description text or job URL to parse into structured JDData JSON
 */
export async function parseJD(options: { text?: string; url?: string }): Promise<JDData> {
  const response = await fetch(`${API_BASE}/api/parse-jd`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: "Failed to parse job description" }));
    throw new Error(errData.error || `HTTP error: ${response.status}`);
  }

  return await response.json();
}

/**
 * Sends structured resume and job description to get ATS score and keywords (Fast)
 */
export async function scoreResume(
  resumeData: ResumeData,
  jdData: JDData
): Promise<ScoreResult> {
  const response = await fetch(`${API_BASE}/api/tailor/score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resumeData, jdData }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: "Failed to score resume" }));
    throw new Error(errData.error || `HTTP error: ${response.status}`);
  }

  return await response.json();
}

/**
 * Sends a specific resume section to get tailored (Progressive)
 */
export async function tailorSection(
  section: "summary" | "experience" | "projects" | "skills",
  sectionData: any,
  jdData: JDData
): Promise<any> {
  const response = await fetch(`${API_BASE}/api/tailor/section`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ section, sectionData, jdData }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: `Failed to tailor ${section}` }));
    throw new Error(errData.error || `HTTP error: ${response.status}`);
  }

  return await response.json();
}

/**

 * Exports resume as PDF Blob.
 * If originalPdfBase64 + changes are provided, modifies the original PDF directly.
 * Otherwise falls back to generating a new PDF from structured data.
 */
export async function exportPDF(
  resumeData: ResumeData,
  originalPdfBase64?: string | null,
  changes?: TailoredChange[]
): Promise<Blob> {
  let requestBody: Record<string, unknown>;

  if (originalPdfBase64) {
    // Send original PDF + changes so backend modifies the original
    requestBody = {
      originalPdfBase64,
      changes: changes || [],
      resumeData, // fallback data if modification fails
    };
  } else {
    requestBody = { resumeData };
  }

  const response = await fetch(`${API_BASE}/api/export-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate PDF. HTTP status: ${response.status}`);
  }

  return await response.blob();
}

/**
 * Exports structured resume JSON into DOCX Blob
 */
export async function exportDOCX(resumeData: ResumeData): Promise<Blob> {
  const response = await fetch(`${API_BASE}/api/export-docx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(resumeData),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate DOCX. HTTP status: ${response.status}`);
  }

  return await response.blob();
}

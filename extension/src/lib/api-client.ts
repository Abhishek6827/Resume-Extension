import type { ResumeData, JDData, TailoredResult } from "./types";

// Fallback to localhost:3000 during local testing
const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

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
 * Sends structured resume and job description to get optimized resume, score, and keywords
 */
export async function tailorResume(
  resumeData: ResumeData,
  jdData: JDData
): Promise<TailoredResult> {
  const response = await fetch(`${API_BASE}/api/tailor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resumeData, jdData }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: "Failed to tailor resume" }));
    throw new Error(errData.error || `HTTP error: ${response.status}`);
  }

  return await response.json();
}

/**
 * Exports structured resume JSON into PDF Blob
 */
export async function exportPDF(resumeData: ResumeData): Promise<Blob> {
  const response = await fetch(`${API_BASE}/api/export-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(resumeData),
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

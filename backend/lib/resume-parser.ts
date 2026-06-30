// ─── Resume Parser — Extract text from PDF/DOCX ───────────
import pdfParse from "pdf-parse";

/**
 * Extract raw text from a PDF buffer using pdf-parse
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const result = await pdfParse(buffer);
    const text = (result.text || "").trim();

    if (!text) {
      throw new Error("No text extracted from PDF. File may be image-based.");
    }
    return text;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`PDF parsing failed: ${message}`);
  }
}

/**
 * Extract raw text from a DOCX buffer using mammoth
 */
export async function parseDOCX(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value || "").trim();

    if (!text) {
      throw new Error("No text extracted from DOCX. File may be empty.");
    }
    return text;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`DOCX parsing failed: ${message}`);
  }
}

/**
 * Detect file type from MIME type or filename and parse accordingly
 */
export async function parseResumeFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const isPDF =
    mimeType === "application/pdf" ||
    mimeType === "application/x-pdf" ||
    filename.toLowerCase().endsWith(".pdf");

  const isDOCX =
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filename.toLowerCase().endsWith(".docx");

  if (isPDF) return parsePDF(buffer);
  if (isDOCX) return parseDOCX(buffer);

  throw new Error(
    "Unsupported file type. Please upload a PDF or DOCX file."
  );
}

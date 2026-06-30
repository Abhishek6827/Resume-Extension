// ─── Resume Parser — Extract text from PDF/DOCX ───────────

/**
 * Extract raw text from a PDF buffer using pdfjs-dist directly.
 * Uses the legacy build with worker disabled for serverless compatibility.
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import to avoid Turbopack bundling issues
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // Disable worker for serverless (Vercel) compatibility
    pdfjs.GlobalWorkerOptions.workerSrc = "";

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });

    const doc = await loadingTask.promise;
    const textParts: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .filter((item: any) => "str" in item)
        .map((item: any) => item.str)
        .join(" ");
      textParts.push(pageText);
      page.cleanup();
    }

    await doc.destroy();

    const text = textParts.join("\n\n").trim();

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

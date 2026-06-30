import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Represents a text change to apply to the original PDF.
 */
interface TextChange {
  originalValue: string;
  newValue: string;
}

/**
 * Represents a text item extracted from pdf2json with position data.
 */
interface PDFTextItem {
  text: string;
  x: number;       // x position in PDF points
  y: number;       // y position in PDF points
  width: number;   // approximate text width
  height: number;  // font size / height
  pageIndex: number;
}

/**
 * Extract text items with (x, y) positions from a PDF buffer using pdf2json.
 * pdf2json provides page data with text items including coordinates.
 */
function extractTextWithPositions(pdfBuffer: Buffer): Promise<PDFTextItem[]> {
  return new Promise((resolve, reject) => {
    try {
      const PDFParser = require("pdf2json");
      const pdfParser = new PDFParser(null, 0); // 0 = structured mode with positions

      pdfParser.on("pdfParser_dataError", (errData: any) => {
        reject(new Error(errData.parserError));
      });

      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        try {
          const items: PDFTextItem[] = [];
          const pages = pdfData.Pages || [];

          for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
            const page = pages[pageIdx];
            const texts = page.Texts || [];

            for (const textItem of texts) {
              if (!textItem.R || textItem.R.length === 0) continue;

              // pdf2json coordinates are in "units" (1 unit = 1/4 of a PDF point)
              // PDF points: 72 points = 1 inch
              // pdf2json: x and y are in units where 1 unit ≈ 4.5 PDF points typically
              const x = textItem.x * 4.5;   // Convert to approximate PDF points
              const y = textItem.y * 4.5;

              for (const run of textItem.R) {
                const text = decodeURIComponent(run.T || "");
                if (!text.trim()) continue;

                const fontSize = run.TS ? run.TS[1] : 10; // TS[1] = font size
                const fontStyle = run.TS ? run.TS[2] : 0;  // TS[2] = bold/italic flags

                items.push({
                  text,
                  x,
                  y,
                  width: text.length * fontSize * 0.5, // rough width estimate
                  height: fontSize,
                  pageIndex: pageIdx,
                });
              }
            }
          }

          resolve(items);
        } catch (err) {
          reject(err);
        }
      });

      pdfParser.parseBuffer(pdfBuffer);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Find text items that match the given original text.
 * Uses substring matching since pdf2json may split text across items.
 */
function findMatchingTextItems(
  items: PDFTextItem[],
  originalText: string
): PDFTextItem[] {
  const normalizedTarget = normalizeText(originalText);
  const matches: PDFTextItem[] = [];

  // First: try exact match on individual items
  for (const item of items) {
    if (normalizeText(item.text) === normalizedTarget) {
      matches.push(item);
      return matches;
    }
  }

  // Second: try finding items that contain the target as a substring
  for (const item of items) {
    if (normalizeText(item.text).includes(normalizedTarget)) {
      matches.push(item);
      return matches;
    }
  }

  // Third: try matching the beginning of the text (for long bullet points
  // that may span multiple text items)
  const targetWords = normalizedTarget.split(/\s+/);
  if (targetWords.length >= 3) {
    const firstFewWords = targetWords.slice(0, 5).join(" ");
    for (const item of items) {
      if (normalizeText(item.text).includes(firstFewWords)) {
        matches.push(item);
        // Also collect consecutive items on the same page with similar y position
        const pageItems = items.filter(
          (i) =>
            i.pageIndex === item.pageIndex &&
            i !== item &&
            Math.abs(i.y - item.y) < item.height * 2 &&
            i.x >= item.x
        );
        matches.push(...pageItems);
        return matches;
      }
    }
  }

  return matches;
}

/**
 * Normalize text for comparison — collapse whitespace, lowercase, trim.
 */
function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Modify the original PDF by applying text changes.
 *
 * Strategy: For each change, find the text position in the original PDF,
 * draw a white rectangle over it, then draw the new text at the same position.
 */
export async function modifyOriginalPDF(
  originalPdfBytes: Uint8Array,
  changes: TextChange[]
): Promise<Uint8Array> {
  // Load the original PDF
  const pdfDoc = await PDFDocument.load(originalPdfBytes, {
    ignoreEncryption: true,
  });

  // Extract text positions from the original PDF
  const textItems = await extractTextWithPositions(
    Buffer.from(originalPdfBytes)
  );

  // Embed a standard font for re-drawing text
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();

  for (const change of changes) {
    const matchingItems = findMatchingTextItems(textItems, change.originalValue);

    if (matchingItems.length === 0) {
      console.warn(
        `[pdf-modifier] Could not find text position for: "${change.originalValue.substring(0, 50)}..."`
      );
      continue;
    }

    for (const item of matchingItems) {
      if (item.pageIndex >= pages.length) continue;
      const page = pages[item.pageIndex];
      const pageHeight = page.getHeight();

      // pdf2json y-coordinate starts from top, PDF coordinate starts from bottom
      // Convert: pdfY = pageHeight - pdf2jsonY
      const pdfX = item.x;
      const pdfY = pageHeight - item.y - item.height;

      // Calculate cover area — slightly larger than the text to fully cover it
      const coverWidth = Math.max(item.width, page.getWidth() - pdfX - 30);
      const coverHeight = item.height * 1.4;

      // Draw white rectangle to cover original text
      page.drawRectangle({
        x: pdfX - 1,
        y: pdfY - 2,
        width: coverWidth,
        height: coverHeight,
        color: rgb(1, 1, 1), // white
      });

      // Determine font size — use the original item's height as font size
      const fontSize = Math.max(item.height * 0.85, 8);
      const isBold = item.height > 12; // rough heuristic
      const font = isBold ? helveticaBold : helvetica;

      // Draw the new text at the same position
      page.drawText(change.newValue, {
        x: pdfX,
        y: pdfY,
        size: fontSize,
        font,
        color: rgb(0.067, 0.094, 0.153), // #111827 equivalent
        maxWidth: coverWidth - 5,
        lineHeight: fontSize * 1.3,
      });
    }
  }

  return await pdfDoc.save();
}

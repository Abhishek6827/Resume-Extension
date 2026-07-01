import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { inflateSync } from "zlib";

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
  x: number;       // x in pdf2json grid units
  y: number;       // y in pdf2json grid units
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  pageIndex: number;
}

/**
 * Page dimension info from pdf2json (in grid units).
 */
interface PageGridInfo {
  width: number;
  height: number;
}

/**
 * Extract text items with positions and page dimensions from pdf2json.
 * pdf2json gives coordinates in "grid units" — we convert to PDF points
 * using the actual page dimensions from pdf-lib.
 */
function extractTextWithPositions(
  pdfBuffer: Buffer
): Promise<{ items: PDFTextItem[]; pages: PageGridInfo[] }> {
  return new Promise((resolve, reject) => {
    try {
      const PDFParser = require("pdf2json");
      const pdfParser = new PDFParser(null, 0); // 0 = structured mode

      pdfParser.on("pdfParser_dataError", (errData: any) => {
        reject(new Error(errData.parserError || "pdf2json parse error"));
      });

      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        try {
          const items: PDFTextItem[] = [];
          const pages: PageGridInfo[] = [];
          const pdfPages = pdfData.Pages || [];

          for (let pageIdx = 0; pageIdx < pdfPages.length; pageIdx++) {
            const page = pdfPages[pageIdx];

            pages.push({
              width: page.Width || 1,
              height: page.Height || 1,
            });

            const texts = page.Texts || [];
            for (const textItem of texts) {
              if (!textItem.R || textItem.R.length === 0) continue;

              for (const run of textItem.R) {
                const text = decodeURIComponent(run.T || "");
                if (!text.trim()) continue;

                const fontSize = run.TS ? run.TS[1] : 10;
                const isBold = run.TS ? run.TS[2] === 1 : false;
                const isItalic = run.TS ? run.TS[3] === 1 : false;

                items.push({
                  text,
                  x: textItem.x,
                  y: textItem.y,
                  fontSize,
                  isBold,
                  isItalic,
                  pageIndex: pageIdx,
                });
              }
            }
          }

          resolve({ items, pages });
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
 * Normalize text for fuzzy matching.
 */
function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .trim()
    .toLowerCase();
}

/**
 * Find text items in the PDF that match (or contain) the given original text.
 * Returns all matching items on any page.
 */
function findMatchingItems(
  items: PDFTextItem[],
  originalText: string
): PDFTextItem[] {
  const normalizedTarget = normalizeText(originalText);
  const matches: PDFTextItem[] = [];

  // Strategy 1: Exact match on a single item
  for (const item of items) {
    if (normalizeText(item.text) === normalizedTarget) {
      return [item];
    }
  }

  // Strategy 2: Item contains the target text
  for (const item of items) {
    if (normalizeText(item.text).includes(normalizedTarget)) {
      return [item];
    }
  }

  // Strategy 3: Find consecutive items whose combined text contains the target.
  // Group items by page and sort by y (top to bottom), then x (left to right).
  const pageGroups = new Map<number, PDFTextItem[]>();
  for (const item of items) {
    const group = pageGroups.get(item.pageIndex) || [];
    group.push(item);
    pageGroups.set(item.pageIndex, group);
  }

  for (const [pageIdx, pageItems] of pageGroups) {
    const sorted = pageItems.sort((a, b) => a.y - b.y || a.x - b.x);

    for (let i = 0; i < sorted.length; i++) {
      let combined = normalizeText(sorted[i].text);
      const group = [sorted[i]];

      if (combined.includes(normalizedTarget)) {
        return group;
      }

      // Try combining with subsequent items on the same or next line
      for (let j = i + 1; j < sorted.length && j < i + 10; j++) {
        const yDiff = Math.abs(sorted[j].y - sorted[i].y);
        if (yDiff > 2) break; // too far vertically (different line block)

        combined += " " + normalizeText(sorted[j].text);
        group.push(sorted[j]);

        if (combined.includes(normalizedTarget)) {
          return group;
        }
      }
    }
  }

  // Strategy 4: Match by first significant words (for long bullet points)
  const targetWords = normalizedTarget.split(/\s+/).filter(w => w.length > 2); // Ignore tiny words like 'a', 'in'
  if (targetWords.length >= 2) {
    const searchPhrase = targetWords.slice(0, 3).join(" ");
    for (const item of items) {
      if (normalizeText(item.text).includes(searchPhrase)) {
        // Found the start — collect this item and nearby items
        const result = [item];
        const sameLineItems = items.filter(
          (other) =>
            other !== item &&
            other.pageIndex === item.pageIndex &&
            Math.abs(other.y - item.y) < 2.5
        );
        result.push(...sameLineItems);
        return result;
      }
    }
  }

  // Strategy 5: Super aggressive match (just the first highly unique word > 5 chars)
  const longWords = normalizedTarget.split(/\s+/).filter(w => w.length > 5);
  if (longWords.length > 0) {
    const searchPhrase = longWords[0];
    for (const item of items) {
      if (normalizeText(item.text).includes(searchPhrase)) {
        const result = [item];
        const sameLineItems = items.filter(
          (other) =>
            other !== item &&
            other.pageIndex === item.pageIndex &&
            Math.abs(other.y - item.y) < 3.0
        );
        result.push(...sameLineItems);
        return result;
      }
    }
  }

  return [];
}

/**
 * Modify the original PDF by overlaying text changes.
 *
 * For each change:
 * 1. Find where the original text appears (using pdf2json positions)
 * 2. Draw a white rectangle to cover the old text
 * 3. Draw the new text at the same position with matched font style
 *
 * Coordinates are properly converted from pdf2json grid units to PDF points
 * using the actual page dimensions from both pdf-lib and pdf2json.
 */
export async function modifyOriginalPDF(
  originalPdfBytes: Uint8Array,
  changes: TextChange[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes, {
    ignoreEncryption: true,
  });

  const buffer = Buffer.from(originalPdfBytes);
  const { items, pages: gridPages } = await extractTextWithPositions(buffer);

  console.log(
    `[pdf-modifier] Extracted ${items.length} text items from ${gridPages.length} pages`
  );

  // Embed fonts for re-drawing
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const helveticaBoldOblique = await pdfDoc.embedFont(
    StandardFonts.HelveticaBoldOblique
  );

  const pdfPages = pdfDoc.getPages();
  let changesApplied = 0;

  for (const change of changes) {
    const matchedItems = findMatchingItems(items, change.originalValue);

    if (matchedItems.length === 0) {
      console.warn(
        `[pdf-modifier] No match found for: "${change.originalValue.substring(0, 60)}..."`
      );
      continue;
    }

    console.log(
      `[pdf-modifier] Found ${matchedItems.length} text item(s) for change: "${change.originalValue.substring(0, 40)}..."`
    );

    // Use the first matched item's position and page
    const firstItem = matchedItems[0];
    const pageIndex = firstItem.pageIndex;

    if (pageIndex >= pdfPages.length || pageIndex >= gridPages.length) {
      console.warn(`[pdf-modifier] Page index ${pageIndex} out of range`);
      continue;
    }

    const page = pdfPages[pageIndex];
    const gridPage = gridPages[pageIndex];

    // Calculate scale factors: PDF points / grid units
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const scaleX = pageWidth / gridPage.width;
    const scaleY = pageHeight / gridPage.height;

    // Convert grid coordinates to PDF points
    // pdf2json: origin is top-left, y increases downward
    // PDF: origin is bottom-left, y increases upward
    const pdfX = firstItem.x * scaleX;
    const pdfY = pageHeight - firstItem.y * scaleY - firstItem.fontSize;

    // Calculate the bounding box to cover all matched items
    let minX = firstItem.x;
    let maxX = firstItem.x;
    let minY = firstItem.y;
    let maxY = firstItem.y;

    for (const item of matchedItems) {
      minX = Math.min(minX, item.x);
      maxX = Math.max(maxX, item.x + item.text.length * 0.3);
      minY = Math.min(minY, item.y);
      maxY = Math.max(maxY, item.y);
    }

    // Cover width: from the first item's x to the right margin
    const coverX = pdfX - 2;
    const rightMargin = 40; // approximate right margin in PDF points
    const coverWidth = pageWidth - coverX - rightMargin;
    // Cover height: from first item to last item + font height
    const coverHeight =
      (maxY - minY) * scaleY + firstItem.fontSize * 1.5;

    // Draw white rectangle to cover the original text
    page.drawRectangle({
      x: coverX,
      y: pdfY - coverHeight + firstItem.fontSize * 1.2,
      width: coverWidth + 4,
      height: coverHeight + 4,
      color: rgb(1, 1, 1), // white
    });

    // Choose font based on the original text's style
    let font = helvetica;
    if (firstItem.isBold && firstItem.isItalic) {
      font = helveticaBoldOblique;
    } else if (firstItem.isBold) {
      font = helveticaBold;
    } else if (firstItem.isItalic) {
      font = helveticaOblique;
    }

    const fontSize = Math.max(firstItem.fontSize * 0.9, 7);

    // Draw the new text at the same position
    page.drawText(change.newValue, {
      x: pdfX,
      y: pdfY,
      size: fontSize,
      font,
      color: rgb(0.067, 0.094, 0.153), // #111827
      maxWidth: coverWidth - 2,
      lineHeight: fontSize * 1.35,
    });

    changesApplied++;
  }

  console.log(
    `[pdf-modifier] Applied ${changesApplied}/${changes.length} changes successfully`
  );

  return await pdfDoc.save();
}

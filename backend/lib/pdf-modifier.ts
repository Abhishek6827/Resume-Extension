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

function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    try {
      // Escape any lone percent signs (percent not followed by two hex digits) and try decoding again
      return decodeURIComponent(str.replace(/%(?![0-9a-fA-F]{2})/g, "%25"));
    } catch {
      return str;
    }
  }
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
                const text = safeDecodeURIComponent(run.T || "");
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
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // strip all whitespace, punctuation, special chars
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
  if (!normalizedTarget) return [];

  // Group items by page and sort them top-to-bottom, left-to-right
  const pageGroups = new Map<number, PDFTextItem[]>();
  for (const item of items) {
    const group = pageGroups.get(item.pageIndex) || [];
    group.push(item);
    pageGroups.set(item.pageIndex, group);
  }

  for (const [pageIdx, pageItems] of pageGroups) {
    const sorted = pageItems.sort((a, b) => a.y - b.y || a.x - b.x);

    for (let i = 0; i < sorted.length; i++) {
      let combined = "";
      const group: PDFTextItem[] = [];

      for (let j = i; j < sorted.length; j++) {
        // If items are too far apart vertically (e.g. different paragraph blocks), stop combining.
        // A standard line height is usually around 1 to 2 grid units. Allow up to 2.2 grid units to cover adjacent lines in a paragraph.
        if (j > i) {
          const yDiff = Math.abs(sorted[j].y - sorted[j - 1].y);
          if (yDiff > 2.2) break; 
        }

        const normalizedItemText = normalizeText(sorted[j].text);
        if (!normalizedItemText) continue;

        combined += normalizedItemText;
        group.push(sorted[j]);

        // If the combined text contains the target or the target contains the combined text (and it's long enough)
        if (combined.includes(normalizedTarget) || (normalizedTarget.includes(combined) && combined.length >= normalizedTarget.length * 0.8)) {
          // Keep adding items that are on the same line as the last item to ensure we blank out the whole line
          const lastItem = sorted[j];
          for (let k = j + 1; k < sorted.length; k++) {
            if (Math.abs(sorted[k].y - lastItem.y) < 1.0) {
              group.push(sorted[k]);
            } else {
              break;
            }
          }
          return group;
        }
        
        // If combined text is way larger than target and doesn't contain it, stop this sequence
        if (combined.length > normalizedTarget.length * 1.5 && !combined.includes(normalizedTarget)) {
           break;
        }
      }
    }
  }

  // Fallback: If no robust sequence match, look for the first highly unique chunk (at least 15 chars)
  if (normalizedTarget.length > 15) {
    const searchChunk = normalizedTarget.substring(0, 15);
    for (const item of items) {
      if (normalizeText(item.text).includes(searchChunk)) {
        const result = [item];
        const sameLineItems = items.filter(
          (other) =>
            other !== item &&
            other.pageIndex === item.pageIndex &&
            Math.abs(other.y - item.y) < 1.5
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

    // 1. Draw individual white rectangles to cover ONLY the matched text items characters
    for (const item of matchedItems) {
      const itemX = item.x * scaleX - 1;
      const itemY = pageHeight - item.y * scaleY - item.fontSize;
      
      let itemFont = helvetica;
      if (item.isBold && item.isItalic) {
        itemFont = helveticaBoldOblique;
      } else if (item.isBold) {
        itemFont = helveticaBold;
      } else if (item.isItalic) {
        itemFont = helveticaOblique;
      }

      // Measure character length accurately to draw white box only over it
      const itemWidth = itemFont.widthOfTextAtSize(item.text, item.fontSize) + 2;
      const itemHeight = item.fontSize * 1.25;

      page.drawRectangle({
        x: itemX,
        y: itemY - 1,
        width: itemWidth,
        height: itemHeight,
        color: rgb(1, 1, 1), // white
      });
    }

    // Choose font based on the original text's style for the replacement text
    let font = helvetica;
    if (firstItem.isBold && firstItem.isItalic) {
      font = helveticaBoldOblique;
    } else if (firstItem.isBold) {
      font = helveticaBold;
    } else if (firstItem.isItalic) {
      font = helveticaOblique;
    }

    const fontSize = Math.max(firstItem.fontSize * 0.9, 7);

    // Calculate maximum width: from pdfX to the right margin of the page
    const rightMargin = 40; 
    const maxWidth = pageWidth - pdfX - rightMargin;

    // Draw the new text at the same position
    page.drawText(change.newValue, {
      x: pdfX,
      y: pdfY,
      size: fontSize,
      font,
      color: rgb(0.067, 0.094, 0.153), // #111827
      maxWidth: Math.max(maxWidth, 120), // Prevent vertical single letters wrapping by ensuring healthy width
      lineHeight: fontSize * 1.35,
    });

    changesApplied++;
  }

  console.log(
    `[pdf-modifier] Applied ${changesApplied}/${changes.length} changes successfully`
  );

  return await pdfDoc.save();
}

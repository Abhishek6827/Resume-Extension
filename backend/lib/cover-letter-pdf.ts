import PDFDocument from "pdfkit";

export function generateCoverLetterPDF(
  content: string,
  candidateName: string = "Candidate"
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      const fontRegular = "Helvetica";
      const fontBold = "Helvetica-Bold";

      const textColor = "#111827"; // Tailwind Slate-900
      const primaryColor = "#1e40af"; // Deep Slate-Blue/Indigo

      // Header
      doc
        .fillColor(primaryColor)
        .font(fontBold)
        .fontSize(22)
        .text(candidateName, { align: "center" });
      
      doc.moveDown(2);

      // Body
      doc
        .fillColor(textColor)
        .font(fontRegular)
        .fontSize(11)
        .lineGap(6)
        .text(content, {
          align: "left",
          width: 450
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

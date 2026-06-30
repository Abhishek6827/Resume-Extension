import PDFDocument from "pdfkit";
import path from "path";
import type { ResumeData } from "./types";

/**
 * Generates an ATS-friendly, clean, single-column PDF from ResumeData.
 * Avoids tables, text boxes, and side-by-side columns that break ATS parsers.
 */
export function generatePDF(resume: ResumeData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 45, right: 45 },
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // Resolve absolute paths for TrueType fonts (public/fonts/ works on both local and Vercel)
      const fontDir = path.resolve(process.cwd(), "public/fonts");
      const fontRegularPath = path.join(fontDir, "LiberationSans-Regular.ttf");
      const fontBoldPath = path.join(fontDir, "LiberationSans-Bold.ttf");
      const fontObliquePath = path.join(fontDir, "LiberationSans-Italic.ttf");

      // Register custom fonts
      doc.registerFont("LiberationSans", fontRegularPath);
      doc.registerFont("LiberationSans-Bold", fontBoldPath);
      doc.registerFont("LiberationSans-Oblique", fontObliquePath);

      // Fonts & Styling Setup
      const fontRegular = "LiberationSans";
      const fontBold = "LiberationSans-Bold";
      const fontOblique = "LiberationSans-Oblique";

      const textColor = "#111827"; // Tailwind Slate-900
      const textMuted = "#4b5563"; // Tailwind Slate-600
      const primaryColor = "#1e40af"; // Deep Slate-Blue/Indigo for headers

      // ─── Header ───────────────────────────────────────────
      // Name
      doc
        .fillColor(textColor)
        .font(fontBold)
        .fontSize(20)
        .text(resume.name, { align: "center" });
      
      doc.moveDown(0.2);

      // Title
      if (resume.title) {
        doc
          .fillColor(primaryColor)
          .font(fontBold)
          .fontSize(12)
          .text(resume.title.toUpperCase(), { align: "center" });
        doc.moveDown(0.3);
      }

      // Contact details inline (e.g. Email | Phone | LinkedIn)
      const contactParts: string[] = [];
      if (resume.contact.email) contactParts.push(resume.contact.email);
      if (resume.contact.phone) contactParts.push(resume.contact.phone);
      if (resume.contact.location) contactParts.push(resume.contact.location);
      if (resume.contact.linkedin) contactParts.push(resume.contact.linkedin);
      if (resume.contact.github) contactParts.push(resume.contact.github);
      if (resume.contact.website) contactParts.push(resume.contact.website);

      doc
        .fillColor(textMuted)
        .font(fontRegular)
        .fontSize(9)
        .text(contactParts.join("  |  "), { align: "center" });

      doc.moveDown(1.2);

      // Helper to add section headers
      const addSectionHeader = (title: string) => {
        doc.moveDown(0.5);
        
        // Draw Section Title
        doc
          .fillColor(primaryColor)
          .font(fontBold)
          .fontSize(11)
          .text(title.toUpperCase());

        // Draw horizontal divider rule
        const currentY = doc.y;
        doc
          .strokeColor("#e5e7eb")
          .lineWidth(0.5)
          .moveTo(45, currentY + 2)
          .lineTo(550, currentY + 2)
          .stroke();

        doc.moveDown(0.6);
      };

      // ─── Professional Summary ─────────────────────────────
      if (resume.summary) {
        addSectionHeader("Summary");
        doc
          .fillColor(textColor)
          .font(fontRegular)
          .fontSize(9.5)
          .text(resume.summary, { align: "left", lineGap: 2 });
      }

      // ─── Work Experience ──────────────────────────────────
      if (resume.experience && resume.experience.length > 0) {
        addSectionHeader("Experience");
        resume.experience.forEach((job) => {
          // Company and Location left, Role and Duration right? No, ATS prefers simple flow.
          // We will print: Role - Company (Location) on left, Duration on right
          const startY = doc.y;
          doc
            .fillColor(textColor)
            .font(fontBold)
            .fontSize(10)
            .text(`${job.role} - ${job.company}`, { continued: true })
            .font(fontOblique)
            .fontSize(9)
            .fillColor(textMuted)
            .text(job.location ? ` (${job.location})` : "");

          const companyHeight = doc.y - startY;

          // Duration on the right of the same line
          doc
            .font(fontRegular)
            .fontSize(9)
            .fillColor(textMuted)
            .text(job.duration, 45, startY, { align: "right" });

          // Reset text position back to next line
          doc.x = 45;
          doc.y = startY + Math.max(companyHeight, 12);
          doc.moveDown(0.2);

          // Highlights
          if (job.highlights && job.highlights.length > 0) {
            job.highlights.forEach((bullet) => {
              doc
                .fillColor(textColor)
                .font(fontRegular)
                .fontSize(9)
                .text("•  ", { continued: true })
                .text(bullet, { lineGap: 1.5 });
            });
          }
          doc.moveDown(0.5);
        });
      }

      // ─── Projects ─────────────────────────────────────────
      if (resume.projects && resume.projects.length > 0) {
        addSectionHeader("Projects");
        resume.projects.forEach((proj) => {
          const startY = doc.y;
          const techStr = proj.tech && proj.tech.length > 0 ? ` [${proj.tech.join(", ")}]` : "";
          doc
            .fillColor(textColor)
            .font(fontBold)
            .fontSize(10)
            .text(proj.name, { continued: true })
            .font(fontRegular)
            .fontSize(9)
            .fillColor(textMuted)
            .text(techStr);

          // If there's description
          if (proj.description) {
            doc
              .fillColor(textColor)
              .font(fontRegular)
              .fontSize(9)
              .text(proj.description, { lineGap: 1.5 });
          }

          // Highlights
          if (proj.highlights && proj.highlights.length > 0) {
            proj.highlights.forEach((bullet) => {
              doc
                .fillColor(textColor)
                .font(fontRegular)
                .fontSize(9)
                .text("•  ", { continued: true })
                .text(bullet, { lineGap: 1.5 });
            });
          }
          doc.moveDown(0.5);
        });
      }

      // ─── Skills ───────────────────────────────────────────
      if (
        resume.skills &&
        (resume.skills.languages?.length ||
          resume.skills.frameworks?.length ||
          resume.skills.tools?.length ||
          resume.skills.other?.length)
      ) {
        addSectionHeader("Skills");
        const skillCats = [
          { label: "Languages", data: resume.skills.languages },
          { label: "Frameworks/Libraries", data: resume.skills.frameworks },
          { label: "Tools/Databases", data: resume.skills.tools },
          { label: "Other", data: resume.skills.other },
        ];

        skillCats.forEach((cat) => {
          if (cat.data && cat.data.length > 0) {
            doc
              .fillColor(textColor)
              .font(fontBold)
              .fontSize(9)
              .text(`${cat.label}: `, { continued: true })
              .font(fontRegular)
              .text(cat.data.join(", "));
            doc.moveDown(0.2);
          }
        });
      }

      // ─── Education ────────────────────────────────────────
      if (resume.education && resume.education.length > 0) {
        addSectionHeader("Education");
        resume.education.forEach((edu) => {
          const startY = doc.y;
          const gpaStr = edu.gpa ? ` (GPA: ${edu.gpa})` : "";
          doc
            .fillColor(textColor)
            .font(fontBold)
            .fontSize(10)
            .text(edu.degree, { continued: true })
            .font(fontRegular)
            .fontSize(9)
            .fillColor(textMuted)
            .text(` - ${edu.institution}${gpaStr}`);

          doc
            .font(fontRegular)
            .fontSize(9)
            .fillColor(textMuted)
            .text(edu.year, 45, startY, { align: "right" });

          doc.x = 45;
          doc.moveDown(0.4);
        });
      }

      // ─── Certifications ───────────────────────────────────
      if (resume.certifications && resume.certifications.length > 0) {
        addSectionHeader("Certifications");
        resume.certifications.forEach((cert) => {
          doc
            .fillColor(textColor)
            .font(fontRegular)
            .fontSize(9)
            .text(`•  ${cert}`);
        });
        doc.moveDown(0.4);
      }

      // ─── Achievements ─────────────────────────────────────
      if (resume.achievements && resume.achievements.length > 0) {
        addSectionHeader("Achievements");
        resume.achievements.forEach((ach) => {
          doc
            .fillColor(textColor)
            .font(fontRegular)
            .fontSize(9)
            .text(`•  ${ach}`);
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

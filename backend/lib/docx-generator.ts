import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  ThematicBreak,
  BorderStyle,
} from "docx";
import type { ResumeData } from "./types";

/**
 * Generates an ATS-friendly, clean DOCX file from ResumeData.
 * Uses a single-column layout, avoiding text boxes, columns, tables, or complex shapes.
 */
export async function generateDOCX(resume: ResumeData): Promise<Buffer> {
  const children: Paragraph[] = [];

  // Helper to add spacing/padding
  const addSpacing = () => {
    children.push(new Paragraph({ text: "" }));
  };

  // ─── Header: Name ──────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: resume.name,
          bold: true,
          size: 32, // 16pt
          color: "111827",
          font: "Helvetica",
        }),
      ],
    })
  );

  // Header: Title
  if (resume.title) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: resume.title.toUpperCase(),
            bold: true,
            size: 22, // 11pt
            color: "1e40af",
            font: "Helvetica",
          }),
        ],
      })
    );
  }

  // Header: Contact Details
  const contactParts: string[] = [];
  if (resume.contact.email) contactParts.push(resume.contact.email);
  if (resume.contact.phone) contactParts.push(resume.contact.phone);
  if (resume.contact.location) contactParts.push(resume.contact.location);
  if (resume.contact.linkedin) contactParts.push(resume.contact.linkedin);
  if (resume.contact.github) contactParts.push(resume.contact.github);
  if (resume.contact.website) contactParts.push(resume.contact.website);

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: contactParts.join("   |   "),
          size: 18, // 9pt
          color: "4b5563",
          font: "Helvetica",
        }),
      ],
    })
  );

  // Add spacing after header
  children.push(new Paragraph({ text: "", spacing: { after: 200 } }));

  // Helper for Section Headers
  const addSectionHeader = (title: string) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [
          new TextRun({
            text: title.toUpperCase(),
            bold: true,
            size: 22, // 11pt
            color: "1e40af",
            font: "Helvetica",
          }),
        ],
      })
    );
    // Add horizontal divider line
    children.push(
      new Paragraph({
        border: {
          bottom: {
            color: "e5e7eb",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      })
    );
  };

  // ─── Professional Summary ─────────────────────────────
  if (resume.summary) {
    addSectionHeader("Summary");
    children.push(
      new Paragraph({
        spacing: { before: 80, after: 120 },
        children: [
          new TextRun({
            text: resume.summary,
            size: 19, // 9.5pt
            color: "111827",
            font: "Helvetica",
          }),
        ],
      })
    );
  }

  // ─── Work Experience ──────────────────────────────────
  if (resume.experience && resume.experience.length > 0) {
    addSectionHeader("Experience");
    resume.experience.forEach((job) => {
      // Role & Company Header
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 40 },
          children: [
            new TextRun({
              text: `${job.role} - ${job.company}`,
              bold: true,
              size: 20, // 10pt
              color: "111827",
              font: "Helvetica",
            }),
            new TextRun({
              text: job.location ? ` (${job.location})` : "",
              italics: true,
              size: 18, // 9pt
              color: "4b5563",
              font: "Helvetica",
            }),
            // Use tab/alignment for right-aligned dates, or just append spaces/dates
            // In DOCX, tabs can be complex, so we will append dates cleanly separated by tabs
            new TextRun({
              text: `\t\t${job.duration}`,
              size: 18,
              color: "4b5563",
              font: "Helvetica",
            }),
          ],
        })
      );

      // Highlights
      if (job.highlights && job.highlights.length > 0) {
        job.highlights.forEach((bullet) => {
          children.push(
            new Paragraph({
              bullet: {
                level: 0,
              },
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({
                  text: bullet,
                  size: 18, // 9pt
                  color: "111827",
                  font: "Helvetica",
                }),
              ],
            })
          );
        });
      }
    });
  }

  // ─── Projects ─────────────────────────────────────────
  if (resume.projects && resume.projects.length > 0) {
    addSectionHeader("Projects");
    resume.projects.forEach((proj) => {
      const techStr = proj.tech && proj.tech.length > 0 ? ` [${proj.tech.join(", ")}]` : "";
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 40 },
          children: [
            new TextRun({
              text: proj.name,
              bold: true,
              size: 20, // 10pt
              color: "111827",
              font: "Helvetica",
            }),
            new TextRun({
              text: techStr,
              size: 18, // 9pt
              color: "4b5563",
              font: "Helvetica",
            }),
          ],
        })
      );

      if (proj.description) {
        children.push(
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({
                text: proj.description,
                size: 18,
                color: "111827",
                font: "Helvetica",
              }),
            ],
          })
        );
      }

      if (proj.highlights && proj.highlights.length > 0) {
        proj.highlights.forEach((bullet) => {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({
                  text: bullet,
                  size: 18,
                  color: "111827",
                  font: "Helvetica",
                }),
              ],
            })
          );
        });
      }
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
        children.push(
          new Paragraph({
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({
                text: `${cat.label}: `,
                bold: true,
                size: 18, // 9pt
                color: "111827",
                font: "Helvetica",
              }),
              new TextRun({
                text: cat.data.join(", "),
                size: 18,
                color: "111827",
                font: "Helvetica",
              }),
            ],
          })
        );
      }
    });
  }

  // ─── Education ────────────────────────────────────────
  if (resume.education && resume.education.length > 0) {
    addSectionHeader("Education");
    resume.education.forEach((edu) => {
      const gpaStr = edu.gpa ? ` (GPA: ${edu.gpa})` : "";
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 60 },
          children: [
            new TextRun({
              text: edu.degree,
              bold: true,
              size: 20, // 10pt
              color: "111827",
              font: "Helvetica",
            }),
            new TextRun({
              text: ` - ${edu.institution}${gpaStr}`,
              size: 18, // 9pt
              color: "4b5563",
              font: "Helvetica",
            }),
            new TextRun({
              text: `\t\t${edu.year}`,
              size: 18,
              color: "4b5563",
              font: "Helvetica",
            }),
          ],
        })
      );
    });
  }

  // ─── Certifications ───────────────────────────────────
  if (resume.certifications && resume.certifications.length > 0) {
    addSectionHeader("Certifications");
    resume.certifications.forEach((cert) => {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({
              text: cert,
              size: 18, // 9pt
              color: "111827",
              font: "Helvetica",
            }),
          ],
        })
      );
    });
  }

  // ─── Achievements ─────────────────────────────────────
  if (resume.achievements && resume.achievements.length > 0) {
    addSectionHeader("Achievements");
    resume.achievements.forEach((ach) => {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({
              text: ach,
              size: 18, // 9pt
              color: "111827",
              font: "Helvetica",
            }),
          ],
        })
      );
    });
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

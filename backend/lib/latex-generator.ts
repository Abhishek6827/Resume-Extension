export function escapeLatex(str: string): string {
  if (!str) return "";
  return str
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\$/g, "\\$")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}");
}

import type { ResumeData } from "./types";

export function generateLatex(resume: ResumeData): string {
  const name = escapeLatex(resume.name || "");

  // Build the contact string dynamically to avoid dangling separators
  const contactParts: string[] = [];

  if (resume.contact?.phone) {
    contactParts.push(escapeLatex(resume.contact.phone));
  }

  if (resume.contact?.email) {
    const emailRaw = resume.contact.email;
    const email = escapeLatex(emailRaw);
    contactParts.push(`\\href{mailto:${emailRaw}}{${email}}`);
  }

  if (resume.contact?.linkedin) {
    let linkedin = resume.contact.linkedin;
    linkedin = linkedin.replace(/^https?:\/\/(www\.)?/, "");
    contactParts.push(`\\href{https://${linkedin}}{${escapeLatex(linkedin)}}`);
  }

  if (resume.contact?.github) {
    let github = resume.contact.github;
    github = github.replace(/^https?:\/\/(www\.)?/, "");
    contactParts.push(`\\href{https://${github}}{${escapeLatex(github)}}`);
  }

  if (resume.contact?.website) {
    let website = resume.contact.website;
    website = website.replace(/^https?:\/\/(www\.)?/, "");
    contactParts.push(`\\href{https://${website}}{${escapeLatex(website)}}`);
  }

  const contactLine = contactParts.join(" \\,\\textbar\\, ");

  const summary = escapeLatex(resume.summary || "");
  let summaryLatex = "";
  if (summary) {
    summaryLatex = `\\section*{Summary}\n${summary}\n`;
  }

  // Generate Experience section
  let experienceLatex = "";
  if (resume.experience && resume.experience.length > 0) {
    experienceLatex = "\\section*{Experience}\n\n";
    resume.experience.forEach((exp) => {
      const role = escapeLatex(exp.role || "");
      const duration = escapeLatex(exp.duration || "");
      const company = escapeLatex(exp.company || "");
      const location = escapeLatex(exp.location || "");
      
      experienceLatex += `\\role{${role}}{${duration}}%\n     {${company} \\hfill ${location}}\n`;
      
      if (exp.highlights && exp.highlights.length > 0) {
        experienceLatex += "\\begin{itemize}\n";
        exp.highlights.forEach((hl) => {
          experienceLatex += `  \\item ${escapeLatex(hl)}\n`;
        });
        experienceLatex += "\\end{itemize}\n\n";
      } else {
        experienceLatex += "\n";
      }
    });
  }

  // Generate Projects section
  let projectsLatex = "";
  if (resume.projects && resume.projects.length > 0) {
    projectsLatex = "\\section*{Projects}\n\n";
    resume.projects.forEach((proj) => {
      const projName = escapeLatex(proj.name || "");
      const tech = escapeLatex((proj.tech || []).join(", "));
      
      projectsLatex += `\\project{${projName}}%\n        {${tech}}\n`;
      
      if (proj.highlights && proj.highlights.length > 0) {
        projectsLatex += "\\begin{itemize}\n";
        proj.highlights.forEach((hl) => {
          projectsLatex += `  \\item ${escapeLatex(hl)}\n`;
        });
        projectsLatex += "\\end{itemize}\n\n";
      } else {
        projectsLatex += "\n";
      }
    });
  }

  // Generate Skills section
  let skillsLatex = "";
  if (resume.skills) {
    skillsLatex = "\\section*{Technical Skills}\n\\begin{itemize}[leftmargin=0pt, label={}]\n  \\small{\\item{\n";
    
    const skillLines = [];
    if (resume.skills.languages && resume.skills.languages.length > 0) {
      skillLines.push(`    \\textbf{Languages:} ${escapeLatex(resume.skills.languages.join(", "))}`);
    }
    if (resume.skills.frameworks && resume.skills.frameworks.length > 0) {
      skillLines.push(`    \\textbf{Frameworks \\& Libraries:} ${escapeLatex(resume.skills.frameworks.join(", "))}`);
    }
    if (resume.skills.tools && resume.skills.tools.length > 0) {
      skillLines.push(`    \\textbf{Tools \\& Databases:} ${escapeLatex(resume.skills.tools.join(", "))}`);
    }
    if (resume.skills.other && resume.skills.other.length > 0) {
      skillLines.push(`    \\textbf{Other:} ${escapeLatex(resume.skills.other.join(", "))}`);
    }
    
    skillsLatex += skillLines.join(" \\\\\n");
    skillsLatex += "\n  }}\n\\end{itemize}\n\n";
  }

  // Generate Education section
  let educationLatex = "";
  if (resume.education && resume.education.length > 0) {
    educationLatex = "\\section*{Education}\n";
    resume.education.forEach((edu) => {
      const institution = escapeLatex(edu.institution || "");
      const degree = escapeLatex(edu.degree || "");
      const year = escapeLatex(edu.year || "");
      educationLatex += `\\textbf{${institution}} -- ${degree} \\hfill ${year}\\\\[1pt]\n`;
    });
  }

  return `\\documentclass[10pt]{article}

\\usepackage[margin=0.38in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{xcolor}

\\definecolor{darkgray}{RGB}{40,40,40}
\\definecolor{linkblue}{RGB}{0,70,140}
\\hypersetup{colorlinks=true, urlcolor=linkblue, linkcolor=linkblue}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}

\\titleformat{\\section}
  {\\normalsize\\bfseries\\scshape\\color{darkgray}}
  {}{0em}{}[\\vspace{1pt}\\titlerule]
\\titlespacing{\\section}{0pt}{4pt}{2pt}

\\setlist[itemize]{leftmargin=12pt, topsep=0pt, itemsep=0.3pt,
                  parsep=0pt, label=\\textbullet}

\\newcommand{\\role}[3]{%
  \\textbf{#1} \\hfill \\textit{#2}\\\\[-1pt]
  {\\small #3}\\par\\vspace{1pt}%
}
\\newcommand{\\scope}[1]{{\\footnotesize\\textit{#1}}\\par\\vspace{1pt}}
\\newcommand{\\project}[2]{%
  \\textbf{#1} \\hfill {\\small\\textit{#2}}\\par\\vspace{1pt}%
}

\\begin{document}

%---------- HEADER ----------
\\begin{center}
  {\\LARGE\\textbf{${name}}}\\\\[1pt]
  \\small
  ${contactLine}
\\end{center}
\\vspace{-4pt}
\\small\\linespread{0.89}\\selectfont

${summaryLatex}
${experienceLatex}
${projectsLatex}
${skillsLatex}
${educationLatex}

\\end{document}`;
}

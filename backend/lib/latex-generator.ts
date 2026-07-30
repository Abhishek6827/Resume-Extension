export function escapeLatex(str: string): string {
  if (!str) return "";
  
  // Normalize unicode mathematical symbols to ASCII equivalents
  let clean = str
    .replace(/\u223C/g, "~")
    .replace(/\u2212/g, "-")
    .replace(/\u2011/g, "-")
    .replace(/\u2013/g, "--")
    .replace(/\u2014/g, "---")
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/\u202F/g, " ")
    .replace(/\u2248/g, "approx. ")
    .replace(/~/g, "$\\sim$");

  // Alternation regex for LaTeX elements to protect
  const latexRegex = /\\texttt\{[^\\}]+\}|\\href\{[^\\}]+\}\{[^\\}]+\}|\\textnormal\{[^\\}]+\}|\{\\small\s+[^\\}]+\}|\$\s*\\sim\s*\$|\\,|\\&|\\%|\\_|---|--/g;
  
  const placeholders: string[] = [];
  clean = clean.replace(latexRegex, (match) => {
    const placeholder = `LATEXPLACEHOLDER${placeholders.length}`;
    placeholders.push(match);
    return placeholder;
  });

  // Escape standard characters
  clean = clean
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

  // Restore placeholders
  placeholders.forEach((val, idx) => {
    clean = clean.replace(`LATEXPLACEHOLDER${idx}`, val);
  });

  return clean;
}

import type { ResumeData } from "./types";

function formatCompany(company: string): string {
  if (!company) return "";
  
  let mainCompany = company;
  let description = "";
  if (company.includes("---")) {
    const index = company.indexOf("---");
    mainCompany = company.substring(0, index).trim();
    description = company.substring(index + 3).trim();
  } else if (company.includes(" - ")) {
    const index = company.indexOf(" - ");
    mainCompany = company.substring(0, index).trim();
    description = company.substring(index + 3).trim();
  }
  
  let url = "";
  const urlPattern = /\((https?:\/\/)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\)/;
  const match = mainCompany.match(urlPattern);
  if (match) {
    url = match[2];
    mainCompany = mainCompany.replace(match[0], "").trim();
  }
  
  let result = escapeLatex(mainCompany);
  if (url) {
    result += ` \\textnormal{(\\href{https://${url}}{${escapeLatex(url)}})}`;
  }
  if (description) {
    result += ` \\textnormal{{\\small --- ${escapeLatex(description)}}}`;
  }
  
  return result;
}

function formatProjectName(name: string): string {
  if (!name) return "";
  if (name.includes("---")) {
    const index = name.indexOf("---");
    const mainName = name.substring(0, index).trim();
    const desc = name.substring(index + 3).trim();
    return `${escapeLatex(mainName)} \\textnormal{--- ${escapeLatex(desc)}}`;
  } else if (name.includes(" - ")) {
    const index = name.indexOf(" - ");
    const mainName = name.substring(0, index).trim();
    const desc = name.substring(index + 3).trim();
    return `${escapeLatex(mainName)} \\textnormal{--- ${escapeLatex(desc)}}`;
  }
  return escapeLatex(name);
}

function ensureNewestFirst(resume: ResumeData) {
  if (!resume.experience || resume.experience.length < 2) return;
  
  const getYear = (duration: string): number => {
    const match = duration.match(/\b(20\d{2}|19\d{2})\b/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const firstYear = getYear(resume.experience[0].duration || "");
  const lastYear = getYear(resume.experience[resume.experience.length - 1].duration || "");

  // If first entry is older than last entry, the list was reversed (oldest first)
  if (firstYear > 0 && lastYear > 0 && firstYear < lastYear) {
    resume.experience.reverse();
    if (resume.projects) {
      resume.projects.reverse();
    }
  }
}

export function generateLatex(resume: ResumeData): string {
  ensureNewestFirst(resume);
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
    summaryLatex = `\\section*{Summary}\n${summary}\n\\vspace{4pt}\n\n`;
  }

  // Generate Experience section
  let experienceLatex = "";
  if (resume.experience && resume.experience.length > 0) {
    experienceLatex = "\\section*{Experience}\n\n";
    resume.experience.forEach((exp) => {
      const role = escapeLatex(exp.role || "");
      const duration = escapeLatex(exp.duration || "");
      const formattedCompany = formatCompany(exp.company || "");
      const location = escapeLatex(exp.location || "");
      
      experienceLatex += `\\role{${role}}{${duration}}%\n     {${formattedCompany} \\hfill ${location}}\n`;
      if (exp.scope) {
        experienceLatex += `\\scope{${escapeLatex(exp.scope)}}\n`;
      }
      
      if (exp.highlights && exp.highlights.length > 0) {
        experienceLatex += "\\begin{itemize}\n";
        exp.highlights.forEach((hl) => {
          const cleanHl = hl.replace(/^[\s•\-\*]+/, "");
          experienceLatex += `  \\item ${escapeLatex(cleanHl)}\n`;
        });
        experienceLatex += "\\end{itemize}\\vspace{4pt}\n\n";
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
      const projName = formatProjectName(proj.name || "");
      const tech = escapeLatex((proj.tech || []).join(", "));
      
      projectsLatex += `\\project{${projName}}%\n        {${tech}}\n`;
      
      if (proj.highlights && proj.highlights.length > 0) {
        projectsLatex += "\\begin{itemize}\n";
        proj.highlights.forEach((hl) => {
          const cleanHl = hl.replace(/^[\s•\-\*]+/, "");
          projectsLatex += `  \\item ${escapeLatex(cleanHl)}\n`;
        });
        projectsLatex += "\\end{itemize}\\vspace{4pt}\n\n";
      } else {
        projectsLatex += "\n";
      }
    });
  }

  // Generate Skills section
  let skillsLatex = "";
  if (resume.skills) {
    const skillLines: string[] = [];
    const formatKey = (key: string) => {
      if (key === "languages") return "Languages";
      if (key === "frameworks") return "Frameworks \\& Libraries";
      if (key === "tools") return "Tools \\& Databases";
      if (key === "other") return "Other";
      // Dynamic category names: escape LaTeX special chars, then title-case
      return escapeLatex(key)
        .replace(/_/g, " ")
        .replace(/-/g, " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    };

    Object.entries(resume.skills).forEach(([key, list]) => {
      if (list && Array.isArray(list) && list.length > 0) {
        skillLines.push(`    \\textbf{${formatKey(key)}:} ${escapeLatex(list.join(", "))}`);
      }
    });
    
    if (skillLines.length > 0) {
      skillsLatex = "\\section*{Technical Skills}\n\\begin{itemize}[leftmargin=0pt, label={}]\n  \\small{\\item{\n";
      skillsLatex += skillLines.join(" \\\\\n");
      skillsLatex += "\n  }}\n\\end{itemize}\\vspace{4pt}\n\n";
    }
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
\\titlespacing{\\section}{0pt}{9pt}{3pt}

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

export function ensureLatexSpacing(latex: string): string {
  if (!latex) return "";
  let result = latex;

  // 1. Upgrade cramped section spacing in preamble if titlespacing is 4pt or less
  result = result.replace(
    /\\titlespacing\{\\section\}\{0pt\}\{[0-5]pt\}\{([0-9]+pt)\}/g,
    "\\titlespacing{\\section}{0pt}{9pt}{3pt}"
  );

  // 2. Ensure gap after \end{itemize} before next \section*{...}
  result = result.replace(
    /\\end\{itemize\}(?:\s*(?:\\vspace\{[^}]+\})?\s*)*(?=\\section\*?\{)/g,
    "\\end{itemize}\\vspace{4pt}\n\n"
  );

  // 3. Ensure gap after \end{itemize} before next \role, \project, or entry macro
  result = result.replace(
    /\\end\{itemize\}(?:\s*(?:\\vspace\{[^}]+\})?\s*)*(?=\\(?:role|project|resumeItem|resumeSubheading)\b)/g,
    "\\end{itemize}\\vspace{4pt}\n\n"
  );

  // 4. Ensure gap after Summary section text before next section
  result = result.replace(
    /(\\section\*?\{Summary\}[\s\S]*?)(?=\\section\*?\{)/g,
    (match, summaryBlock) => {
      if (!summaryBlock.includes("\\vspace")) {
        return summaryBlock.trimEnd() + "\n\\vspace{4pt}\n\n";
      }
      return summaryBlock;
    }
  );

  return result;
}

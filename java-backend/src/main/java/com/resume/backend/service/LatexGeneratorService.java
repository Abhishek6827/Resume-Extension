package com.resume.backend.service;

import org.springframework.stereotype.Service;
import java.util.*;
import java.util.regex.*;

@Service
public class LatexGeneratorService {

    public static String escapeLatex(String str) {
        if (str == null) return "";
        
        // Normalize unicode mathematical symbols to ASCII equivalents
        str = str.replace("\u223C", "~")
                 .replace("\u2212", "-")
                 .replace("\u2011", "-")
                 .replace("\u2013", "--")
                 .replace("\u2014", "---")
                 .replace("\u2018", "'")
                 .replace("\u2019", "'")
                 .replace("\u201C", "\"")
                 .replace("\u201D", "\"")
                 .replace("\u2026", "...")
                 .replace("\u00A0", " ")
                 .replace("\u202F", " ")
                 .replace("\u2248", "approx. ")
                 .replace("~", "$\\sim$");

        // Protect standard LaTeX commands we want to support
        String regex = "\\\\texttt\\{[^\\}]+\\}|\\\\href\\{[^\\}]+\\}\\{[^\\}]+\\}|\\\\textnormal\\{[^\\}]+\\}|\\{\\\\small\\s+[^\\}]+\\}|\\$\\s*\\\\sim\\s*\\$|\\\\,|\\\\&|\\\\%|\\\\_|---|--";
        Pattern pattern = Pattern.compile(regex);
        Matcher matcher = pattern.matcher(str);
        
        List<String> placeholders = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        while (matcher.find()) {
            String match = matcher.group();
            String placeholder = "LATEXPLACEHOLDER" + placeholders.size();
            placeholders.add(match);
            matcher.appendReplacement(sb, placeholder);
        }
        matcher.appendTail(sb);
        
        String temp = sb.toString();
        
        // Escape standard LaTeX special characters
        temp = temp.replace("\\", "\\textbackslash{}")
                   .replace("{", "\\{")
                   .replace("}", "\\}")
                   .replace("$", "\\$")
                   .replace("&", "\\&")
                   .replace("%", "\\%")
                   .replace("#", "\\#")
                   .replace("_", "\\_")
                   .replace("^", "\\textasciicircum{}")
                   .replace("~", "\\textasciitilde{}");
                   
        // Restore placeholders
        for (int i = 0; i < placeholders.size(); i++) {
            temp = temp.replace("LATEXPLACEHOLDER" + i, placeholders.get(i));
        }
        
        return temp;
    }

    private String formatCompany(String company) {
        if (company == null) return "";
        
        String mainCompany = company;
        String description = "";
        if (company.contains("---")) {
            int index = company.indexOf("---");
            mainCompany = company.substring(0, index).trim();
            description = company.substring(index + 3).trim();
        } else if (company.contains(" - ")) {
            int index = company.indexOf(" - ");
            mainCompany = company.substring(0, index).trim();
            description = company.substring(index + 3).trim();
        }
        
        String url = "";
        Pattern urlPattern = Pattern.compile("\\((https?://)?([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})\\)");
        Matcher matcher = urlPattern.matcher(mainCompany);
        if (matcher.find()) {
            url = matcher.group(2);
            mainCompany = mainCompany.replace(matcher.group(0), "").trim();
        }
        
        StringBuilder sb = new StringBuilder();
        sb.append(escapeLatex(mainCompany));
        
        if (!url.isEmpty()) {
            sb.append(" \\textnormal{(\\href{https://").append(url).append("}{").append(escapeLatex(url)).append("})}");
        }
        
        if (!description.isEmpty()) {
            sb.append(" \\textnormal{{\\small --- ").append(escapeLatex(description)).append("}}");
        }
        
        return sb.toString();
    }

    private String formatProjectName(String name) {
        if (name == null) return "";
        if (name.contains("---")) {
            int index = name.indexOf("---");
            String mainName = name.substring(0, index).trim();
            String desc = name.substring(index + 3).trim();
            return escapeLatex(mainName) + " \\textnormal{--- " + escapeLatex(desc) + "}";
        } else if (name.contains(" - ")) {
            int index = name.indexOf(" - ");
            String mainName = name.substring(0, index).trim();
            String desc = name.substring(index + 3).trim();
            return escapeLatex(mainName) + " \\textnormal{--- " + escapeLatex(desc) + "}";
        }
        return escapeLatex(name);
    }

    @SuppressWarnings("unchecked")
    private void ensureNewestFirst(Map<String, Object> resume) {
        List<Map<String, Object>> experiences = (List<Map<String, Object>>) resume.get("experience");
        if (experiences == null || experiences.size() < 2) return;

        int firstYear = getYearFromDuration((String) experiences.get(0).get("duration"));
        int lastYear = getYearFromDuration((String) experiences.get(experiences.size() - 1).get("duration"));

        if (firstYear > 0 && lastYear > 0 && firstYear < lastYear) {
            Collections.reverse(experiences);
            List<Map<String, Object>> projects = (List<Map<String, Object>>) resume.get("projects");
            if (projects != null) {
                Collections.reverse(projects);
            }
        }
    }

    private int getYearFromDuration(String duration) {
        if (duration == null) return 0;
        Pattern p = Pattern.compile("\\b(20\\d{2}|19\\d{2})\\b");
        Matcher m = p.matcher(duration);
        if (m.find()) {
            return Integer.parseInt(m.group(1));
        }
        return 0;
    }

    @SuppressWarnings("unchecked")
    public String generateLatex(Map<String, Object> tailoredResume) {
        ensureNewestFirst(tailoredResume);
        String name = escapeLatex((String) tailoredResume.getOrDefault("name", ""));

        // Header and contact info
        Map<String, Object> contact = (Map<String, Object>) tailoredResume.get("contact");
        List<String> contactParts = new ArrayList<>();
        if (contact != null) {
            String phone = (String) contact.get("phone");
            String email = (String) contact.get("email");
            String linkedin = (String) contact.get("linkedin");
            String github = (String) contact.get("github");
            String website = (String) contact.get("website");

            if (phone != null && !phone.isEmpty()) {
                contactParts.add(escapeLatex(phone));
            }
            if (email != null && !email.isEmpty()) {
                contactParts.add("\\href{mailto:" + email + "}{" + escapeLatex(email) + "}");
            }
            if (linkedin != null && !linkedin.isEmpty()) {
                String cleanLinkedin = linkedin.replace("https://", "").replace("http://", "").replace("www.", "").replace("linkedin.com/in/", "").replace("linkedin.com/", "");
                contactParts.add("\\href{https://linkedin.com/in/" + cleanLinkedin + "}{linkedin.com/in/" + escapeLatex(cleanLinkedin) + "}");
            }
            if (github != null && !github.isEmpty()) {
                String cleanGithub = github.replace("https://", "").replace("http://", "").replace("www.", "").replace("github.com/", "");
                contactParts.add("\\href{https://github.com/" + cleanGithub + "}{github.com/" + escapeLatex(cleanGithub) + "}");
            }
            if (website != null && !website.isEmpty()) {
                String cleanWebsite = website.replace("https://", "").replace("http://", "").replace("www.", "");
                contactParts.add("\\href{https://" + cleanWebsite + "}{" + escapeLatex(cleanWebsite) + "}");
            }
        }
        String contactLine = String.join(" \\,\\textbar\\, ", contactParts);

        // Summary
        String summary = escapeLatex((String) tailoredResume.get("summary"));
        String summaryLatex = "";
        if (summary != null && !summary.isEmpty()) {
            summaryLatex = "\\section*{Summary}\n" + summary + "\n";
        }

        // Experience
        StringBuilder experienceLatex = new StringBuilder();
        List<Map<String, Object>> experiences = (List<Map<String, Object>>) tailoredResume.get("experience");
        if (experiences != null && !experiences.isEmpty()) {
            experienceLatex.append("\\section*{Experience}\n\n");
            for (Map<String, Object> exp : experiences) {
                String role = escapeLatex((String) exp.get("role"));
                String duration = escapeLatex((String) exp.get("duration"));
                String company = formatCompany((String) exp.get("company"));
                String location = escapeLatex((String) exp.get("location"));
                String scope = escapeLatex((String) exp.get("scope"));

                experienceLatex.append(String.format("\\role{%s}{%s}%%\n     {%s \\hfill %s}\n", role, duration, company, location));
                if (scope != null && !scope.isEmpty()) {
                    experienceLatex.append(String.format("\\scope{%s}\n", scope));
                }

                List<String> highlights = (List<String>) exp.get("highlights");
                if (highlights != null && !highlights.isEmpty()) {
                    experienceLatex.append("\\begin{itemize}\n");
                    for (String hl : highlights) {
                        String cleanHl = hl.replaceAll("^[\\s•\\-\\*]+", "");
                        experienceLatex.append("  \\item ").append(escapeLatex(cleanHl)).append("\n");
                    }
                    experienceLatex.append("\\end{itemize}\n\n");
                } else {
                    experienceLatex.append("\n");
                }
            }
        }

        // Projects
        StringBuilder projectsLatex = new StringBuilder();
        List<Map<String, Object>> projects = (List<Map<String, Object>>) tailoredResume.get("projects");
        if (projects != null && !projects.isEmpty()) {
            projectsLatex.append("\\section*{Projects}\n\n");
            for (Map<String, Object> proj : projects) {
                String projName = formatProjectName((String) proj.get("name"));
                
                List<String> techList = (List<String>) proj.get("tech");
                String tech = "";
                if (techList != null) {
                    tech = escapeLatex(String.join(", ", techList));
                }

                projectsLatex.append(String.format("\\project{%s}%%\n        {%s}\n", projName, tech));

                List<String> highlights = (List<String>) proj.get("highlights");
                if (highlights != null && !highlights.isEmpty()) {
                    projectsLatex.append("\\begin{itemize}\n");
                    for (String hl : highlights) {
                        String cleanHl = hl.replaceAll("^[\\s•\\-\\*]+", "");
                        projectsLatex.append("  \\item ").append(escapeLatex(cleanHl)).append("\n");
                    }
                    projectsLatex.append("\\end{itemize}\n\n");
                } else {
                    projectsLatex.append("\n");
                }
            }
        }

        // Skills
        StringBuilder skillsLatex = new StringBuilder();
        Map<String, Object> skills = (Map<String, Object>) tailoredResume.get("skills");
        if (skills != null && !skills.isEmpty()) {
            List<String> skillLines = new ArrayList<>();
            for (Map.Entry<String, Object> entry : skills.entrySet()) {
                String key = entry.getKey();
                List<String> list = (List<String>) entry.getValue();
                if (list != null && !list.isEmpty()) {
                    String formattedKey = key;
                    if (key.equalsIgnoreCase("languages")) {
                        formattedKey = "Languages";
                    } else if (key.equalsIgnoreCase("frameworks")) {
                        formattedKey = "Frameworks \\& Libraries";
                    } else if (key.equalsIgnoreCase("tools")) {
                        formattedKey = "Tools \\& Databases";
                    } else if (key.equalsIgnoreCase("other")) {
                        formattedKey = "Other";
                    } else {
                        // Title-case category names
                        String[] words = key.replace("_", " ").replace("-", " ").split("\\s+");
                        StringBuilder titleKey = new StringBuilder();
                        for (String w : words) {
                            if (!w.isEmpty()) {
                                titleKey.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1)).append(" ");
                            }
                        }
                        formattedKey = escapeLatex(titleKey.toString().trim());
                    }
                    skillLines.add(String.format("    \\textbf{%s:} %s", formattedKey, escapeLatex(String.join(", ", list))));
                }
            }

            if (!skillLines.isEmpty()) {
                skillsLatex.append("\\section*{Technical Skills}\n")
                           .append("\\begin{itemize}[leftmargin=0pt, label={}]\n")
                           .append("  \\small{\\item{\n")
                           .append(String.join(" \\\\\n", skillLines))
                           .append("\n  }}\n")
                           .append("\\end{itemize}\n\n");
            }
        }

        // Education
        StringBuilder educationLatex = new StringBuilder();
        List<Map<String, Object>> education = (List<Map<String, Object>>) tailoredResume.get("education");
        if (education != null && !education.isEmpty()) {
            educationLatex.append("\\section*{Education}\n");
            for (Map<String, Object> edu : education) {
                String institution = escapeLatex((String) edu.get("institution"));
                String degree = escapeLatex((String) edu.get("degree"));
                String year = escapeLatex((String) edu.get("year"));
                educationLatex.append(String.format("\\textbf{%s} -- %s \\hfill %s\\\\[1pt]\n", institution, degree, year));
            }
        }

        return "\\documentclass[10pt]{article}\n\n" +
               "\\usepackage[margin=0.38in]{geometry}\n" +
               "\\usepackage{titlesec}\n" +
               "\\usepackage{enumitem}\n" +
               "\\usepackage{hyperref}\n" +
               "\\usepackage{xcolor}\n\n" +
               "\\definecolor{darkgray}{RGB}{40,40,40}\n" +
               "\\definecolor{linkblue}{RGB}{0,70,140}\n" +
               "\\hypersetup{colorlinks=true, urlcolor=linkblue, linkcolor=linkblue}\n" +
               "\\pagestyle{empty}\n" +
               "\\setlength{\\parindent}{0pt}\n\n" +
               "\\titleformat{\\section}\n" +
               "  {\\normalsize\\bfseries\\scshape\\color{darkgray}}\n" +
               "  {}{0em}{}[\\vspace{1pt}\\titrule]\n" +
               "\\titlespacing{\\section}{0pt}{4pt}{2pt}\n\n" +
               "\\setlist[itemize]{leftmargin=12pt, topsep=0pt, itemsep=0.3pt,\n" +
               "                  parsep=0pt, label=\\textbullet}\n\n" +
               "\\newcommand{\\role}[3]{%\n" +
               "  \\textbf{#1} \\hfill \\textit{#2}\\\\[-1pt]\n" +
               "  {\\small #3}\\par\\vspace{1pt}%\n" +
               "}\n" +
               "\\newcommand{\\scope}[1]{{\\footnotesize\\textit{#1}}\\par\\vspace{1pt}}\n" +
               "\\newcommand{\\project}[2]{%\n" +
               "  \\textbf{#1} \\hfill {\\small\\textit{#2}}\\par\\vspace{1pt}%\n" +
               "}\n\n" +
               "\\begin{document}\n\n" +
               "%---------- HEADER ----------\n" +
               "\\begin{center}\n" +
               "  {\\LARGE\\textbf{" + name + "}}\\\\[1pt]\n" +
               "  \\small\n" +
               "  " + contactLine + "\n" +
               "\\end{center}\n" +
               "\\vspace{-4pt}\n" +
               "\\small\\linespread{0.89}\\selectfont\n\n" +
               summaryLatex + "\n" +
               experienceLatex.toString() + "\n" +
               projectsLatex.toString() + "\n" +
               skillsLatex.toString() + "\n" +
               educationLatex.toString() + "\n\n" +
               "\\end{document}";
    }
}

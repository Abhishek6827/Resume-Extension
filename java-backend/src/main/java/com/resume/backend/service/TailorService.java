package com.resume.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resume.backend.model.JDData;
import com.resume.backend.model.ResumeData;
import com.resume.backend.model.ExperienceEntry;
import com.resume.backend.model.ProjectEntry;
import org.springframework.stereotype.Service;
import java.util.*;
import java.util.regex.*;

@Service
public class TailorService {

    private final LlmClient llmClient;
    private final ObjectMapper objectMapper;

    public TailorService(LlmClient llmClient, ObjectMapper objectMapper) {
        this.llmClient = llmClient;
        this.objectMapper = objectMapper;
    }

    private ResumeData ensureNewestFirst(ResumeData resume) {
        if (resume.experience() == null || resume.experience().size() < 2) return resume;

        int firstYear = getYearFromDuration(resume.experience().get(0).duration());
        int lastYear = getYearFromDuration(resume.experience().get(resume.experience().size() - 1).duration());

        if (firstYear > 0 && lastYear > 0 && firstYear < lastYear) {
            List<ExperienceEntry> modifiableExp = new ArrayList<>(resume.experience());
            Collections.reverse(modifiableExp);

            List<ProjectEntry> modifiableProj = resume.projects() != null ? new ArrayList<>(resume.projects()) : null;
            if (modifiableProj != null) {
                Collections.reverse(modifiableProj);
            }

            return new ResumeData(
                resume.name(),
                resume.title(),
                resume.contact(),
                resume.summary(),
                modifiableExp,
                resume.education(),
                resume.skills(),
                resume.certifications(),
                modifiableProj,
                resume.achievements()
            );
        }
        return resume;
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

    public ResumeData parseResumeWithAI(String rawText, Map<String, String> modelSelection) throws Exception {
        String systemPrompt = """
                You are an expert resume parsing assistant.
                Your task is to take raw text from a resume and convert it into a structured JSON object.
                Extract all details accurately. Do not invent details.
                
                You MUST extract the "scope" field for each experience entry (the short description text right under the company and role headers, e.g. "Solo-built and operating...").
                
                Return ONLY a valid JSON matching this exact structure:
                {
                  "name": "Candidate Name",
                  "title": "Professional Title",
                  "contact": {
                    "email": "Email or empty string",
                    "phone": "Phone or empty string",
                    "linkedin": "LinkedIn link or empty string",
                    "github": "GitHub link or empty string",
                    "website": "Personal website or empty string",
                    "location": "Location or empty string"
                  },
                  "summary": "Professional summary verbatim from original text",
                  "experience": [
                    {
                      "role": "Role title",
                      "company": "Company name",
                      "duration": "Dates/Duration",
                      "location": "Location",
                      "scope": "Job scope/summary description verbatim from original text (e.g. 'Solo-built and operating...'). If not present, use empty string.",
                      "highlights": [
                        "Highlight bullet point 1 verbatim",
                        "Highlight bullet point 2 verbatim"
                      ]
                    }
                  ],
                  "education": [
                    {
                      "degree": "Degree",
                      "institution": "Institution name",
                      "year": "Year",
                      "gpa": "GPA or empty string"
                    }
                  ],
                  "skills": {
                    "languages": ["Skill names"],
                    "frameworks": ["Skill names"],
                    "tools": ["Skill names"],
                    "other": ["Skill names"]
                  },
                  "certifications": ["Certification names"],
                  "projects": [
                    {
                      "name": "Project name",
                      "description": "Short description",
                      "tech": ["React", "TypeScript"],
                      "highlights": [
                        "Project highlight bullet 1"
                      ]
                    }
                  ],
                  "achievements": ["Achievement list"]
                }
                """;

        String jsonStr = llmClient.callLLM(systemPrompt, "Resume text:\\n" + rawText, modelSelection);
        ResumeData resume = objectMapper.readValue(jsonStr, ResumeData.class);
        return ensureNewestFirst(resume);
    }

    public JDData parseJDWithAI(String rawText, Map<String, String> modelSelection) throws Exception {
        String systemPrompt = """
                You are an expert job description parsing assistant.
                Return ONLY a valid JSON object matching the standard JDData structure:
                {
                  "jobTitle": "Job Title",
                  "company": "Company name",
                  "mustHaveSkills": ["Must have skills"],
                  "niceToHaveSkills": ["Nice to have skills"],
                  "responsibilities": ["Main responsibilities"],
                  "keywords": ["Keywords"]
                }
                """;

        String jsonStr = llmClient.callLLM(systemPrompt, "Job Description:\n" + rawText, modelSelection);
        return objectMapper.readValue(jsonStr, JDData.class);
    }

    public ResumeData tailorResume(ResumeData resume, JDData jd, Map<String, String> modelSelection) throws Exception {
        String systemPrompt = """
                You are an expert resume optimizer. Your task is to rewrite the candidate's existing resume to better align with the provided Job Description (JD).

                CRITICAL SAFETY & STRUCTURE RULES:
                1. DO NOT invent, add, or hallucinate any new projects, jobs, or experiences under any circumstances.
                2. Keep all factual details (company names, roles, degrees, years, durations, locations) exactly the same.
                3. DO NOT reorder the experience or projects list. Preserve the exact list order and size.
                4. You MUST preserve the exact same number of bullet points in the "highlights" array for each experience and project entry as the original. Do not merge, split, add, or delete bullet points.
                5. Keep the "scope" field verbatim under each experience entry. Do not rewrite or modify it.

                CRITICAL LENGTH & VERTICAL SPACE CONSTRAINTS:
                6. Keep the vertical layout page budget of the original resume strictly.
                7. **Professional Summary Length**: Keep the tailored professional summary word count within +/- 15% of the original summary (approximately 4 lines, 70-85 words).
                8. **Highlights Length**: For each rewritten bullet point in experience and projects, ensure its character/word length is within +/- 15% of the original bullet point. Do NOT turn a 1-line bullet into a 2-line bullet, and do NOT turn a 2-line bullet into a 1-line bullet.
                9. **Skills Length**: Keep the number of skills in each category approximately the same as the original to prevent text line wrapping. DO NOT drop any categories or return empty lists. If a category has no matching skills, retain its original skills verbatim.

                Return ONLY a valid JSON matching the input ResumeData structure.
                """;

        String userMessage = "Job Description:\n" + objectMapper.writeValueAsString(jd) +
                "\n\nOriginal Resume:\n" + objectMapper.writeValueAsString(resume);

        String jsonStr = llmClient.callLLM(systemPrompt, userMessage, modelSelection);
        return objectMapper.readValue(jsonStr, ResumeData.class);
    }
}

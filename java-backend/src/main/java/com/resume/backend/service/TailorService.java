package com.resume.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resume.backend.model.JDData;
import com.resume.backend.model.ResumeData;
import org.springframework.stereotype.Service;
import java.util.Map;

@Service
public class TailorService {

    private final LlmClient llmClient;
    private final ObjectMapper objectMapper;

    public TailorService(LlmClient llmClient, ObjectMapper objectMapper) {
        this.llmClient = llmClient;
        this.objectMapper = objectMapper;
    }

    public ResumeData parseResumeWithAI(String rawText, Map<String, String> modelSelection) throws Exception {
        String systemPrompt = """
                You are an expert resume parsing assistant.
                Extract all details accurately into the JSON format provided.
                Return ONLY a valid JSON object matching the standard ResumeData structure.
                """;

        String jsonStr = llmClient.callLLM(systemPrompt, "Resume text:\n" + rawText, modelSelection);
        return objectMapper.readValue(jsonStr, ResumeData.class);
    }

    public JDData parseJDWithAI(String rawText, Map<String, String> modelSelection) throws Exception {
        String systemPrompt = """
                You are an expert job description parsing assistant.
                Return ONLY a valid JSON object matching the standard JDData structure.
                """;

        String jsonStr = llmClient.callLLM(systemPrompt, "Job Description:\n" + rawText, modelSelection);
        return objectMapper.readValue(jsonStr, JDData.class);
    }

    public ResumeData tailorResume(ResumeData resume, JDData jd, Map<String, String> modelSelection) throws Exception {
        String systemPrompt = """
                You are an expert resume optimizer. Your task is to rewrite the candidate's existing resume to better align with the provided Job Description (JD).

                CRITICAL SAFETY RULES:
                1. DO NOT invent, add, or hallucinate any new projects, jobs, or experiences under any circumstances.
                2. You MAY select and prioritize the most relevant projects/experiences/skills from the provided resume to fit the JD, and you may remove highly irrelevant ones if space is needed. However, DO NOT remove the most relevant projects.

                3. ONLY modify the bullet points/descriptions of the existing entries to highlight relevant skills from the JD.
                4. Keep the length, structure, and detail of the content similar to the original. Do not overly compress or shorten the resume.
                5. Return ONLY a valid JSON object matching the input ResumeData structure.
                """;

        String userMessage = "Job Description:\n" + objectMapper.writeValueAsString(jd) +
                "\n\nOriginal Resume:\n" + objectMapper.writeValueAsString(resume);

        String jsonStr = llmClient.callLLM(systemPrompt, userMessage, modelSelection);
        return objectMapper.readValue(jsonStr, ResumeData.class);
    }
}

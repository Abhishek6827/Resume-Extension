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
            You are an expert resume optimizer. Rewrite the candidate's resume to align with the target role and key JD requirements.
            CRITICAL SAFETY RULES: NEVER invent experience. Keep structure identical.
            Return ONLY a valid JSON object matching the input ResumeData structure.
            """;
            
        String userMessage = "Job Description:\n" + objectMapper.writeValueAsString(jd) + 
                             "\n\nOriginal Resume:\n" + objectMapper.writeValueAsString(resume);
                             
        String jsonStr = llmClient.callLLM(systemPrompt, userMessage, modelSelection);
        return objectMapper.readValue(jsonStr, ResumeData.class);
    }
}

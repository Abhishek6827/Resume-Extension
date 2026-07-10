package com.resume.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

@Service
public class LlmClient {

    private final WebClient webClient;

    @Value("${llm.groq.api-key:}")
    private String groqApiKey;
    @Value("${llm.groq.url:https://api.groq.com/openai/v1/chat/completions}")
    private String groqUrl;

    @Value("${llm.nvidia.api-key:}")
    private String nvidiaApiKey;
    @Value("${llm.nvidia.url:https://integrate.api.nvidia.com/v1/chat/completions}")
    private String nvidiaUrl;

    @Value("${llm.cerebras.api-key:}")
    private String cerebrasApiKey;
    @Value("${llm.cerebras.url:https://api.cerebras.ai/v1/chat/completions}")
    private String cerebrasUrl;

    @Value("${llm.openrouter.api-key:}")
    private String openrouterApiKey;
    @Value("${llm.openrouter.url:https://openrouter.ai/api/v1/chat/completions}")
    private String openrouterUrl;

    public LlmClient(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }

    public String callLLM(String systemPrompt, String userMessage, Map<String, String> modelSelection) {
        String primaryModel = modelSelection.getOrDefault("primaryModel", "groq:llama-3.3-70b-versatile");
        String fallbackModel = modelSelection.get("fallbackModel");

        try {
            return tryModel(systemPrompt, userMessage, primaryModel);
        } catch (Exception e) {
            System.err.println("[LLM] Primary Model (" + primaryModel + ") failed: " + e.getMessage());
            if (fallbackModel != null && !fallbackModel.isEmpty()) {
                try {
                    return tryModel(systemPrompt, userMessage, fallbackModel);
                } catch (Exception ex) {
                    System.err.println("[LLM] Fallback Model (" + fallbackModel + ") failed: " + ex.getMessage());
                }
            }
        }

        System.out.println("[LLM] Trying global fallbacks...");
        try {
            return tryGroq(systemPrompt, userMessage, "llama-3.3-70b-versatile");
        } catch (Exception e) {
            System.err.println("[LLM] Global Groq fallback failed: " + e.getMessage());
        }

        try {
            return tryNvidia(systemPrompt, userMessage, "nvidia/nemotron-3-ultra-550b-a55b");
        } catch (Exception e) {
            System.err.println("[LLM] Global Nvidia fallback failed: " + e.getMessage());
            throw new RuntimeException("All LLM providers failed.");
        }
    }

    private String tryModel(String systemPrompt, String userMessage, String fullModelName) {
        if (fullModelName.startsWith("cerebras:")) {
            return tryCerebras(systemPrompt, userMessage, fullModelName.substring(9));
        } else if (fullModelName.startsWith("groq:")) {
            return tryGroq(systemPrompt, userMessage, fullModelName.substring(5));
        } else if (fullModelName.startsWith("nvidia:")) {
            return tryNvidia(systemPrompt, userMessage, fullModelName.substring(7));
        } else if (fullModelName.startsWith("openrouter:")) {
            return tryOpenRouter(systemPrompt, userMessage, fullModelName.substring(11));
        } else {
            return tryGroq(systemPrompt, userMessage, fullModelName);
        }
    }

    @SuppressWarnings("null")
    private String executePost(String url, String apiKey, Map<String, Object> requestBody) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new RuntimeException("API Key is missing for URL: " + url);
        }

        String rawResponse = webClient.post()
                .uri(url)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    List<?> choices = (List<?>) response.get("choices");
                    Map<?, ?> firstChoice = (Map<?, ?>) choices.get(0);
                    Map<?, ?> message = (Map<?, ?>) firstChoice.get("message");
                    return (String) message.get("content");
                })
                .block();
                
        return extractJson(rawResponse);
    }
    
    private String extractJson(String text) {
        if (text == null) return "{}";
        text = text.replaceAll("(?s)<think>.*?</think>", "").trim();
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start != -1 && end != -1 && end >= start) {
            return text.substring(start, end + 1);
        }
        return text;
    }

    private String tryGroq(String systemPrompt, String userMessage, String modelName) {
        if (modelName != null && modelName.contains("gemma")) {
            modelName = "llama-3.3-70b-versatile"; 
        }
        
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", modelName != null ? modelName : "llama-3.3-70b-versatile");
        requestBody.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userMessage)
        ));
        requestBody.put("temperature", 0.7);
        requestBody.put("response_format", Map.of("type", "json_object"));
        
        return executePost(groqUrl, groqApiKey, requestBody);
    }

    private String tryNvidia(String systemPrompt, String userMessage, String modelName) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", modelName != null ? modelName : "nvidia/nemotron-3-ultra-550b-a55b");
        requestBody.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userMessage)
        ));
        requestBody.put("temperature", 0.7);
        
        return executePost(nvidiaUrl, nvidiaApiKey, requestBody);
    }

    private String tryCerebras(String systemPrompt, String userMessage, String modelName) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", modelName != null ? modelName : "llama3.1-8b");
        requestBody.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userMessage)
        ));
        requestBody.put("temperature", 0.7);
        requestBody.put("response_format", Map.of("type", "json_object"));
        
        return executePost(cerebrasUrl, cerebrasApiKey, requestBody);
    }

    private String tryOpenRouter(String systemPrompt, String userMessage, String modelName) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", modelName != null ? modelName : "openrouter/free");
        requestBody.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userMessage)
        ));
        requestBody.put("temperature", 0.7);
        
        return executePost(openrouterUrl, openrouterApiKey, requestBody);
    }
}

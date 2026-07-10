package com.resume.backend.service;

import org.springframework.stereotype.Service;
import java.util.Map;

@Service
public class LatexGeneratorService {

    public String generateLatex(Map<String, Object> tailoredResume) {
        String name = (String) tailoredResume.getOrDefault("name", "Unknown");
        return "\\documentclass{article}\n" +
               "\\begin{document}\n" +
               "Hello World. This is a generated resume for " + name + ".\n" +
               "\\end{document}";
    }
}

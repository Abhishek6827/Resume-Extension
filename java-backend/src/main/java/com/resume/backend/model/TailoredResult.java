package com.resume.backend.model;

import java.util.List;

public record TailoredResult(
    ResumeData tailoredResume,
    List<TailoredChange> changes,
    Integer atsScore,
    String scoreReasoning,
    List<String> matchedKeywords,
    List<String> missingKeywords,
    String jobTitle,
    String company
) {}

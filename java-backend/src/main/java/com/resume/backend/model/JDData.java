package com.resume.backend.model;

import java.util.List;

public record JDData(
    String jobTitle,
    String company,
    List<String> mustHaveSkills,
    List<String> niceToHaveSkills,
    List<String> responsibilities,
    List<String> keywords
) {}

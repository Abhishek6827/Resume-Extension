package com.resume.backend.model;

import java.util.List;

public record ExperienceEntry(
    String role,
    String company,
    String duration,
    String location,
    List<String> highlights
) {}

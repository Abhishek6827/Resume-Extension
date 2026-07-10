package com.resume.backend.model;

import java.util.List;
import java.util.Map;

public record ResumeData(
    String name,
    String title,
    ContactInfo contact,
    String summary,
    List<ExperienceEntry> experience,
    List<EducationEntry> education,
    Map<String, List<String>> skills,
    List<String> certifications,
    List<ProjectEntry> projects,
    List<String> achievements
) {}

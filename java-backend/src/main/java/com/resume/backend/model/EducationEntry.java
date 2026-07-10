package com.resume.backend.model;



public record EducationEntry(
    String degree,
    String institution,
    String year,
    String gpa
) {}

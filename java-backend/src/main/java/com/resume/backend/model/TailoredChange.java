package com.resume.backend.model;

public record TailoredChange(
    String id,
    String section,
    String field,
    String label,
    String originalValue,
    String newValue,
    String status
) {}

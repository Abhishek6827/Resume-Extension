package com.resume.backend.model;

import java.util.List;

public record ProjectEntry(
    String name,
    String description,
    List<String> tech,
    List<String> highlights
) {}

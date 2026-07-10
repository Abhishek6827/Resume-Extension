package com.resume.backend.model;

public record ContactInfo(
    String name,
    String email,
    String phone,
    String linkedin,
    String github,
    String website,
    String location
) {}

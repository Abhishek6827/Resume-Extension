package com.resume.backend.service;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

@Service
public class TexLiveClient {

    private final RestTemplate restTemplate = new RestTemplate();

    public byte[] compileLatexToPdf(String latexString) {
        String compileUrl = "https://texlive.net/cgi-bin/latexcgi";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.set("Accept", "application/pdf, text/plain");
        headers.set("User-Agent", "Java/Spring-Boot-Client");

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("filecontents[]", latexString);
        body.add("filename[]", "document.tex");
        body.add("engine", "pdflatex");
        body.add("return", "pdf");

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        return restTemplate.postForObject(compileUrl, requestEntity, byte[].class);
    }
}

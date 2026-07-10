package com.resume.backend.controller;

import com.resume.backend.model.JDData;
import com.resume.backend.model.ResumeData;
import com.resume.backend.service.LatexGeneratorService;
import com.resume.backend.service.TailorService;
import com.resume.backend.service.TexLiveClient;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // Apply CORS for the single module
public class BackendController {

    private final TailorService tailorService;
    private final LatexGeneratorService latexGeneratorService;
    private final TexLiveClient texLiveClient;

    public BackendController(TailorService tailorService, LatexGeneratorService latexGeneratorService, TexLiveClient texLiveClient) {
        this.tailorService = tailorService;
        this.latexGeneratorService = latexGeneratorService;
        this.texLiveClient = texLiveClient;
    }

    @GetMapping("/")
    public ResponseEntity<String> healthCheck() {
        return ResponseEntity.ok("Resume Extension Backend is running successfully!");
    }

    @PostMapping(value = "/parse-resume", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> parseResume(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            @RequestParam(value = "primaryModel", defaultValue = "gemma2-9b-it") String model,
            @RequestParam(value = "fallbackModel", required = false) String fallbackModel) {
        try {
            String text = "";
            String originalName = file.getOriginalFilename();
            String filename = originalName != null ? originalName.toLowerCase() : "";
            
            if (filename.endsWith(".pdf") || "application/pdf".equals(file.getContentType())) {
                try (org.apache.pdfbox.pdmodel.PDDocument document = org.apache.pdfbox.pdmodel.PDDocument.load(file.getInputStream())) {
                    org.apache.pdfbox.text.PDFTextStripper stripper = new org.apache.pdfbox.text.PDFTextStripper();
                    text = stripper.getText(document);
                }
            } else if (filename.endsWith(".docx")) {
                try (org.apache.poi.xwpf.usermodel.XWPFDocument document = new org.apache.poi.xwpf.usermodel.XWPFDocument(file.getInputStream());
                     org.apache.poi.xwpf.extractor.XWPFWordExtractor extractor = new org.apache.poi.xwpf.extractor.XWPFWordExtractor(document)) {
                    text = extractor.getText();
                }
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "Unsupported file format. Please upload PDF or DOCX."));
            }

            Map<String, String> modelSelection = new java.util.HashMap<>();
            modelSelection.put("primaryModel", model);
            if (fallbackModel != null) {
                modelSelection.put("fallbackModel", fallbackModel);
            }

            ResumeData data = tailorService.parseResumeWithAI(text, modelSelection);
            return ResponseEntity.ok(data);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/parse-jd")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> parseJD(@RequestBody Map<String, Object> request) {
        try {
            String text = (String) request.get("text");
            
            Map<String, String> modelSelection = new java.util.HashMap<>();
            if (request.containsKey("modelSelection")) {
                modelSelection = (Map<String, String>) request.get("modelSelection");
            } else {
                modelSelection.put("primaryModel", "gemma2-9b-it");
            }
            
            JDData jd = tailorService.parseJDWithAI(text, modelSelection);
            return ResponseEntity.ok(jd);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/tailor")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> tailorResume(@RequestBody Map<String, Object> request) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            ResumeData resume = mapper.convertValue(request.get("resumeData"), ResumeData.class);
            JDData jd = mapper.convertValue(request.get("jdData"), JDData.class);
            
            Map<String, String> modelSelection = new java.util.HashMap<>();
            if (request.containsKey("modelSelection")) {
                modelSelection = (Map<String, String>) request.get("modelSelection");
            } else {
                modelSelection.put("primaryModel", "gemma2-9b-it");
            }
            
            ResumeData tailored = tailorService.tailorResume(resume, jd, modelSelection);
            return ResponseEntity.ok(Map.of("tailoredResume", tailored));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/generate-latex-pdf")
    @SuppressWarnings("unchecked")
    public ResponseEntity<byte[]> generateLatexPdf(@RequestBody Map<String, Object> request) {
        try {
            Map<String, Object> tailoredResume = (Map<String, Object>) request.get("tailoredResume");
            if (tailoredResume == null) {
                return ResponseEntity.badRequest().body(null);
            }

            String latexString = latexGeneratorService.generateLatex(tailoredResume);
            byte[] pdfBytes = texLiveClient.compileLatexToPdf(latexString);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", "tailored-resume.pdf");

            return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(null);
        }
    }
}

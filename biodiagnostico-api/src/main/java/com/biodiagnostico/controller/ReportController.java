package com.biodiagnostico.controller;

import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.service.PdfReportService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final PdfReportService pdfReportService;

    public ReportController(PdfReportService pdfReportService) {
        this.pdfReportService = pdfReportService;
    }

    @GetMapping("/qc-pdf")
    public ResponseEntity<byte[]> generateQcPdf(
        @RequestParam(required = false) String area,
        @RequestParam(required = false) String periodType,
        @RequestParam(required = false) Integer month,
        @RequestParam(required = false) Integer year
    ) {
        if (month != null && (month < 1 || month > 12)) {
            throw new BusinessException("Mes invalido: deve estar entre 1 e 12");
        }
        if (year != null && (year < 2000 || year > 2100)) {
            throw new BusinessException("Ano invalido: deve estar entre 2000 e 2100");
        }
        byte[] bytes = pdfReportService.generateQcPdf(area, periodType, month, year);
        String filename = (area == null || area.isBlank() ? "bioquimica" : area) + "-qc-report.pdf";
        return pdfResponse(bytes, filename);
    }

    @GetMapping("/reagents-pdf")
    public ResponseEntity<byte[]> generateReagentsPdf() {
        return pdfResponse(pdfReportService.generateReagentsPdf(), "reagents-report.pdf");
    }

    private ResponseEntity<byte[]> pdfResponse(byte[] bytes, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        return ResponseEntity.ok().headers(headers).body(bytes);
    }
}

package com.biodiagnostico.controller;

import com.biodiagnostico.dto.response.GeneratedReport;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.service.PdfReportService;
import org.springframework.security.access.prepost.PreAuthorize;
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
    @PreAuthorize("hasRole('ADMIN') or hasRole('VIGILANCIA_SANITARIA') or hasRole('FUNCIONARIO')")
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
        GeneratedReport report = pdfReportService.generateQcReport(area, periodType, month, year);
        String filename = report.reportNumber() + ".pdf";
        return pdfResponse(report, filename);
    }

    @GetMapping("/reagents-pdf")
    @PreAuthorize("hasRole('ADMIN') or hasRole('VIGILANCIA_SANITARIA') or hasRole('FUNCIONARIO')")
    public ResponseEntity<byte[]> generateReagentsPdf() {
        GeneratedReport report = pdfReportService.generateReagentsReport();
        return pdfResponse(report, report.reportNumber() + ".pdf");
    }

    private ResponseEntity<byte[]> pdfResponse(GeneratedReport report, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        headers.add("X-Report-Number", report.reportNumber());
        headers.add("X-Report-Hash", report.sha256());
        headers.setAccessControlExposeHeaders(java.util.List.of("X-Report-Number", "X-Report-Hash", "Content-Disposition"));
        return ResponseEntity.ok().headers(headers).body(report.content());
    }
}

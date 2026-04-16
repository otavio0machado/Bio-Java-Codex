package com.biodiagnostico.dto.response;

public record GeneratedReport(
    byte[] content,
    String reportNumber,
    String sha256,
    String periodLabel
) {
}

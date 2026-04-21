package com.biodiagnostico.service.reports.v2.generator;

/**
 * Resultado imutavel de uma geracao bem-sucedida. Agrega os bytes do arquivo,
 * metadados de entrega e o hash SHA-256 dos bytes pre-assinatura.
 *
 * @param bytes             conteudo binario do relatorio (PDF/XLSX/HTML)
 * @param contentType       MIME type (ex.: application/pdf)
 * @param suggestedFilename nome sugerido para download
 * @param pageCount         numero de paginas (PDF); 0 para formatos sem paginacao
 * @param sizeBytes         tamanho em bytes de {@link #bytes()}
 * @param reportNumber      numero oficial BIO-AAAAMM-NNNNNN
 * @param sha256            hash hex lowercase dos bytes entregues (antes de assinatura)
 * @param periodLabel       rotulo do periodo para exibicao
 */
public record ReportArtifact(
    byte[] bytes,
    String contentType,
    String suggestedFilename,
    int pageCount,
    long sizeBytes,
    String reportNumber,
    String sha256,
    String periodLabel
) {
    public ReportArtifact {
        if (bytes == null || bytes.length == 0) {
            throw new IllegalArgumentException("ReportArtifact.bytes nao pode ser vazio");
        }
        if (contentType == null || contentType.isBlank()) {
            throw new IllegalArgumentException("ReportArtifact.contentType obrigatorio");
        }
        if (suggestedFilename == null || suggestedFilename.isBlank()) {
            throw new IllegalArgumentException("ReportArtifact.suggestedFilename obrigatorio");
        }
        if (reportNumber == null || reportNumber.isBlank()) {
            throw new IllegalArgumentException("ReportArtifact.reportNumber obrigatorio");
        }
        if (sha256 == null || sha256.isBlank()) {
            throw new IllegalArgumentException("ReportArtifact.sha256 obrigatorio");
        }
    }
}

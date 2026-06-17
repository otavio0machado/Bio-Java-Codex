package com.biodiagnostico.service.reports.v2;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.lowagie.text.Document;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfWriter;
import java.io.ByteArrayOutputStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ReportSignerTest {

    private final ReportSigner signer = new ReportSigner();

    @Test
    @DisplayName("assina PDF, recalcula hash e bytes finais diferem do original")
    void signsAndHashDiffers() throws Exception {
        byte[] original = minimalPdf("Conteudo de teste");
        ReportSigner.SignatureResult result = signer.sign(original, new ReportSigner.SignatureRequest(
            "Dr. Ana Responsavel", "CRF-12345", "http://localhost:5173",
            "tok123abcshare", "abc123hashfake"
        ));
        assertThat(result).isNotNull();
        assertThat(result.signedBytes()).isNotNull();
        assertThat(result.signedBytes().length).isGreaterThan(original.length);
        assertThat(new String(result.signedBytes(), 0, 5)).isEqualTo("%PDF-");
        assertThat(result.signatureHash()).isNotEqualTo(sha256Hex(original));
        assertThat(result.signedAt()).isNotNull();
        // hash e hex lowercase 64 chars
        assertThat(result.signatureHash()).hasSize(64).matches("[0-9a-f]+");
    }

    @Test
    @DisplayName("QR e texto de verificacao codificam o shareToken (token estavel), nao o sha256")
    void qrEncodesShareTokenNotSha256() throws Exception {
        byte[] original = minimalPdf("Conteudo de teste");
        String token = "abcdef0123456789abcdef0123456789";
        String origSha = "f".repeat(64);
        ReportSigner.SignatureResult result = signer.sign(original, new ReportSigner.SignatureRequest(
            "Dr. Ana Responsavel", "CRF-12345", "http://localhost:5173/",
            token, origSha
        ));
        String text = extractPdfText(result.signedBytes());
        // URL aponta para /r/verify/{token} (barra final do base e removida)
        assertThat(text).contains("/r/verify/" + token);
        assertThat(text).doesNotContain("/r/verify/" + origSha);
        // rotulo honesto do hash original (pre-assinatura). O extrator de PDF pode
        // quebrar a celula em linhas; normalizamos espacos antes de comparar.
        String normalized = text.replaceAll("\\s+", " ");
        assertThat(normalized).contains("Hash do documento original (pre-assinatura)");
        // texto sob o QR menciona a versao assinada
        assertThat(text).contains("Verifique a autenticidade e o hash da versao assinada em:");
    }

    @Test
    @DisplayName("valida argumentos nulos/vazios (inclui shareToken)")
    void rejectsInvalidArgs() {
        byte[] original = "fake".getBytes();
        assertThatThrownBy(() -> signer.sign(null, new ReportSigner.SignatureRequest("n", "r", "u", "t", "h")))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> signer.sign(original, null))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> signer.sign(original, new ReportSigner.SignatureRequest("n", "r", null, "t", "h")))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> signer.sign(original, new ReportSigner.SignatureRequest("n", "r", "u", "t", "")))
            .isInstanceOf(IllegalArgumentException.class);
        // shareToken obrigatorio
        assertThatThrownBy(() -> signer.sign(original, new ReportSigner.SignatureRequest("n", "r", "u", "", "h")))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> signer.sign(original, new ReportSigner.SignatureRequest("n", "r", "u", null, "h")))
            .isInstanceOf(IllegalArgumentException.class);
    }

    private String extractPdfText(byte[] pdf) throws Exception {
        com.lowagie.text.pdf.PdfReader reader = new com.lowagie.text.pdf.PdfReader(pdf);
        com.lowagie.text.pdf.parser.PdfTextExtractor extractor =
            new com.lowagie.text.pdf.parser.PdfTextExtractor(reader);
        StringBuilder sb = new StringBuilder();
        try {
            for (int i = 1; i <= reader.getNumberOfPages(); i++) {
                sb.append(extractor.getTextFromPage(i));
                sb.append('\n');
            }
        } finally {
            reader.close();
        }
        return sb.toString();
    }

    private byte[] minimalPdf(String text) throws Exception {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4);
            PdfWriter.getInstance(doc, out);
            doc.open();
            doc.add(new Paragraph(text));
            doc.close();
            return out.toByteArray();
        }
    }

    private String sha256Hex(byte[] content) {
        try {
            java.security.MessageDigest d = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = d.digest(content);
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }
}

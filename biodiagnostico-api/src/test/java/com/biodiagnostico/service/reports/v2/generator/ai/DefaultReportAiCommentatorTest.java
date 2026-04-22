package com.biodiagnostico.service.reports.v2.generator.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.biodiagnostico.service.GeminiAiService;
import com.biodiagnostico.service.reports.v2.catalog.ReportCode;
import com.biodiagnostico.service.reports.v2.generator.GenerationContext;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class DefaultReportAiCommentatorTest {

    private final ReportAiPrompts prompts = new ReportAiPrompts();
    private final GenerationContext ctx = new GenerationContext(
        UUID.randomUUID(), "tester", Set.of("ADMIN"), Instant.now(),
        ZoneId.of("America/Sao_Paulo"), null, "corr", "req");

    @Test
    @DisplayName("commentary retorna o texto quando Gemini responde normalmente")
    void commentaryReturnsTextOnSuccess() {
        GeminiAiService gemini = stubAnalyze((p, c) -> "Comentario valido de 3 frases.");
        DefaultReportAiCommentator commentator = new DefaultReportAiCommentator(
            gemini, prompts, Executors.newSingleThreadExecutor(), Duration.ofSeconds(5));
        String result = commentator.commentary(ReportCode.CQ_OPERATIONAL_V2, "ctx", ctx);
        assertThat(result).isEqualTo("Comentario valido de 3 frases.");
    }

    @Test
    @DisplayName("commentary retorna fallback quando Gemini retorna 'Nao foi possivel analisar'")
    void commentaryFallbackOnFriendlyError() {
        GeminiAiService gemini = stubAnalyze((p, c) -> "Não foi possível analisar no momento. Tente novamente.");
        DefaultReportAiCommentator commentator = new DefaultReportAiCommentator(
            gemini, prompts, Executors.newSingleThreadExecutor(), Duration.ofSeconds(5));
        String result = commentator.commentary(ReportCode.CQ_OPERATIONAL_V2, "ctx", ctx);
        assertThat(result).isEqualTo(ReportAiCommentator.FALLBACK_COMMENTARY);
    }

    @Test
    @DisplayName("commentary retorna fallback quando Gemini lanca excecao")
    void commentaryFallbackOnException() {
        GeminiAiService gemini = stubAnalyze((p, c) -> {
            throw new RuntimeException("Gemini down");
        });
        DefaultReportAiCommentator commentator = new DefaultReportAiCommentator(
            gemini, prompts, Executors.newSingleThreadExecutor(), Duration.ofSeconds(5));
        String result = commentator.commentary(ReportCode.WESTGARD_DEEPDIVE, "ctx", ctx);
        assertThat(result).isEqualTo(ReportAiCommentator.FALLBACK_COMMENTARY);
    }

    @Test
    @DisplayName("commentary retorna fallback em timeout")
    void commentaryFallbackOnTimeout() {
        GeminiAiService gemini = stubAnalyze((p, c) -> {
            try { Thread.sleep(2000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return "nunca chega";
        });
        DefaultReportAiCommentator commentator = new DefaultReportAiCommentator(
            gemini, prompts, Executors.newSingleThreadExecutor(), Duration.ofMillis(100));
        String result = commentator.commentary(ReportCode.MANUTENCAO_KPI, "ctx", ctx);
        assertThat(result).isEqualTo(ReportAiCommentator.FALLBACK_COMMENTARY);
    }

    @Test
    @DisplayName("commentary retorna fallback para resposta vazia")
    void commentaryFallbackOnBlank() {
        GeminiAiService gemini = stubAnalyze((p, c) -> "");
        DefaultReportAiCommentator commentator = new DefaultReportAiCommentator(
            gemini, prompts, Executors.newSingleThreadExecutor(), Duration.ofSeconds(5));
        String result = commentator.commentary(ReportCode.CQ_OPERATIONAL_V2, "ctx", ctx);
        assertThat(result).isEqualTo(ReportAiCommentator.FALLBACK_COMMENTARY);
    }

    private GeminiAiService stubAnalyze(java.util.function.BiFunction<String, String, String> fn) {
        return new GeminiAiService(null, null, "stub", "stub-model", 1024,
            new io.micrometer.core.instrument.simple.SimpleMeterRegistry()) {
            @Override
            public String analyze(String userPrompt, String context) {
                return fn.apply(userPrompt, context);
            }
        };
    }
}

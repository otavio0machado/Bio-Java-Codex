package com.biodiagnostico.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.WestgardViolation;
import com.biodiagnostico.service.DriftDetector.DriftCandidate;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Testa o detector DETERMINISTICO de drift (D11). Sem IA, sem Spring: apenas a
 * estatistica pura (sequencias e regressao linear dos Z-scores).
 *
 * <p>As series sao construidas mais recente primeiro (como vem das queries do
 * repositorio). O valor de cada ponto e derivado de um Z-score alvo:
 * {@code value = targetValue + z * targetSd}.
 */
class DriftDetectorTest {

    private static final double TARGET = 100.0;
    private static final double SD = 2.0;

    private final DriftDetector detector = new DriftDetector();

    /**
     * Constroi uma serie a partir de Z-scores em ordem CRONOLOGICA (mais antigo
     * primeiro) e a devolve na ordem do repositorio (mais recente primeiro).
     * Datas crescentes acompanham a ordem cronologica.
     */
    private List<QcRecord> seriesFromZScores(String status, double... chronologicalZ) {
        List<QcRecord> chronological = new ArrayList<>();
        LocalDate base = LocalDate.now().minusDays(chronologicalZ.length);
        for (int index = 0; index < chronologicalZ.length; index++) {
            double z = chronologicalZ[index];
            chronological.add(QcRecord.builder()
                .examName("GLICOSE")
                .area("bioquimica")
                .level("N1")
                .date(base.plusDays(index))
                .value(TARGET + z * SD)
                .targetValue(TARGET)
                .targetSd(SD)
                .status(status)
                .build());
        }
        // Inverte para mais-recente-primeiro (ordem do repositorio).
        List<QcRecord> mostRecentFirst = new ArrayList<>(chronological);
        java.util.Collections.reverse(mostRecentFirst);
        return mostRecentFirst;
    }

    @Test
    @DisplayName("Série estável (oscila em torno da média) não gera candidato")
    void stableSeriesNoCandidate() {
        // 8 pontos alternando levemente os dois lados: sem run, sem slope.
        List<QcRecord> series = seriesFromZScores("APROVADO",
            0.3, -0.2, 0.1, -0.3, 0.2, -0.1, 0.3, -0.2);
        Optional<DriftCandidate> candidate = detector.detect("GLICOSE", "N1", "bioquimica", series);
        assertThat(candidate).isEmpty();
    }

    @Test
    @DisplayName("Série curta (<6 pontos) é ignorada mesmo com tendência")
    void shortSeriesIgnored() {
        List<QcRecord> series = seriesFromZScores("APROVADO", 0.2, 0.5, 0.8, 1.1, 1.4);
        Optional<DriftCandidate> candidate = detector.detect("GLICOSE", "N1", "bioquimica", series);
        assertThat(candidate).isEmpty();
    }

    @Test
    @DisplayName("Sequência longa do mesmo lado (RUN >= 6), sem rejeição, gera candidato")
    void longSameSideRunDetected() {
        // 7 pontos todos acima da média, com inclinação muito leve (run domina).
        List<QcRecord> series = seriesFromZScores("APROVADO",
            0.4, 0.5, 0.4, 0.6, 0.5, 0.4, 0.6);
        Optional<DriftCandidate> candidate = detector.detect("GLICOSE", "N1", "bioquimica", series);
        assertThat(candidate).isPresent();
        assertThat(candidate.get().recentSameSideRun()).isGreaterThanOrEqualTo(DriftDetector.RUN_THRESHOLD);
        assertThat(candidate.get().examName()).isEqualTo("GLICOSE");
        assertThat(candidate.get().level()).isEqualTo("N1");
        // Run estável (sem slope claro) classifica como RUN ou SHIFT.
        assertThat(candidate.get().pattern())
            .isIn(DriftDetector.PATTERN_RUN, DriftDetector.PATTERN_SHIFT);
    }

    @Test
    @DisplayName("Tendência crescente clara (slope significativo) classifica DRIFT_UP")
    void upwardDriftDetected() {
        // Z subindo de 0 a 2.1 em 8 pontos: variação modelada ~2 SD, R^2 alto.
        List<QcRecord> series = seriesFromZScores("APROVADO",
            0.0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1);
        Optional<DriftCandidate> candidate = detector.detect("GLICOSE", "N1", "bioquimica", series);
        assertThat(candidate).isPresent();
        assertThat(candidate.get().pattern()).isEqualTo(DriftDetector.PATTERN_DRIFT_UP);
        assertThat(candidate.get().slopePerPoint()).isPositive();
    }

    @Test
    @DisplayName("Tendência decrescente clara classifica DRIFT_DOWN")
    void downwardDriftDetected() {
        List<QcRecord> series = seriesFromZScores("APROVADO",
            0.0, -0.3, -0.6, -0.9, -1.2, -1.5, -1.8, -2.1);
        Optional<DriftCandidate> candidate = detector.detect("GLICOSE", "N1", "bioquimica", series);
        assertThat(candidate).isPresent();
        assertThat(candidate.get().pattern()).isEqualTo(DriftDetector.PATTERN_DRIFT_DOWN);
        assertThat(candidate.get().slopePerPoint()).isNegative();
    }

    @Test
    @DisplayName("Série com status REPROVADO (rejeição) é excluída")
    void rejectedByStatusExcluded() {
        // Mesmo padrão crescente, mas marcado como REPROVADO -> território do CQ.
        List<QcRecord> series = seriesFromZScores("REPROVADO",
            0.0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1);
        Optional<DriftCandidate> candidate = detector.detect("GLICOSE", "N1", "bioquimica", series);
        assertThat(candidate).isEmpty();
    }

    @Test
    @DisplayName("Série com violação de severidade REJECTION é excluída mesmo se status não for REPROVADO")
    void rejectedByViolationSeverityExcluded() {
        List<QcRecord> series = seriesFromZScores("APROVADO",
            0.0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1);
        // Anexa uma violação REJECTION ao ponto mais recente.
        WestgardViolation rejection = WestgardViolation.builder()
            .rule("1-3s")
            .description("Erro Aleatório: Valor excede 3 SD.")
            .severity("REJECTION")
            .build();
        series.get(0).getViolations().add(rejection);
        Optional<DriftCandidate> candidate = detector.detect("GLICOSE", "N1", "bioquimica", series);
        assertThat(candidate).isEmpty();
    }

    @Test
    @DisplayName("Violação apenas WARNING (1-2s) NÃO exclui a série da detecção preventiva")
    void warningViolationDoesNotExclude() {
        List<QcRecord> series = seriesFromZScores("APROVADO",
            0.0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1);
        WestgardViolation warning = WestgardViolation.builder()
            .rule("1-2s")
            .description("Alerta: Valor excede 2 SD.")
            .severity("WARNING")
            .build();
        series.get(0).getViolations().add(warning);
        Optional<DriftCandidate> candidate = detector.detect("GLICOSE", "N1", "bioquimica", series);
        assertThat(candidate).isPresent();
    }

    @Test
    @DisplayName("Sequência >= 10 do mesmo lado (regra 10x) é excluída — território de Westgard")
    void tenInARowExcludedAsWestgardTerritory() {
        // 11 pontos todos acima da média -> run >= 10 (10x): não é alerta preventivo.
        List<QcRecord> series = seriesFromZScores("APROVADO",
            0.4, 0.5, 0.4, 0.5, 0.4, 0.5, 0.4, 0.5, 0.4, 0.5, 0.4);
        Optional<DriftCandidate> candidate = detector.detect("GLICOSE", "N1", "bioquimica", series);
        assertThat(candidate).isEmpty();
    }

    @Test
    @DisplayName("SD nulo/zero em qualquer ponto impede Z-score e não gera candidato")
    void zeroSdNoCandidate() {
        List<QcRecord> series = seriesFromZScores("APROVADO",
            0.0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1);
        series.get(2).setTargetSd(0.0);
        Optional<DriftCandidate> candidate = detector.detect("GLICOSE", "N1", "bioquimica", series);
        assertThat(candidate).isEmpty();
    }

    @Test
    @DisplayName("Série nula é ignorada")
    void nullSeriesIgnored() {
        assertThat(detector.detect("GLICOSE", "N1", "bioquimica", null)).isEmpty();
    }

    @Test
    @DisplayName("Drift forte e ponto recente próximo de 3 SD => severidade ALTA")
    void strongDriftHighSeverity() {
        // Sobe de 0.5 a ~2.9 em 8 pontos: run longo + variação grande + último ponto alto.
        List<QcRecord> series = seriesFromZScores("APROVADO",
            0.5, 0.8, 1.2, 1.6, 2.0, 2.4, 2.7, 2.9);
        Optional<DriftCandidate> candidate = detector.detect("GLICOSE", "N1", "bioquimica", series);
        assertThat(candidate).isPresent();
        assertThat(candidate.get().severity()).isEqualTo(DriftDetector.SEVERITY_HIGH);
    }
}

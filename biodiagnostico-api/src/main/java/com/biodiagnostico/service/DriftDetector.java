package com.biodiagnostico.service;

import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.util.NumericUtils;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * D11 — Detector DETERMINISTICO de candidatos a drift (estatistica pura, SEM IA).
 *
 * <p><strong>Principio inegociavel:</strong> a DETECCAO de drift e deterministica;
 * a IA (em {@code AiService}) apenas INTERPRETA os candidatos que esta classe ja
 * encontrou. Esta classe nao chama IA, nao grava nada e e read-only.
 *
 * <p><strong>NAO reimplementa Westgard.</strong> O {@link WestgardEngine} decide
 * status e violacoes (fonte de verdade). O D11 olha series que AINDA NAO
 * violaram a regra de REJECTION para ANTECIPAR a tendencia. Series que ja tem
 * violacao de rejeicao recente sao EXCLUIDAS (tratadas pelo CQ/D12) usando a
 * saida ja persistida do motor (status {@code REPROVADO} e/ou
 * {@code WestgardViolation} de severidade {@code REJECTION}); nunca se recalcula
 * a regra aqui.
 *
 * <h2>Limiares (conservadores, para evitar falso-positivo) — revisar no domain-auditor</h2>
 * <ul>
 *   <li>{@link #MIN_POINTS} = 6: serie precisa de pelo menos 6 pontos; abaixo
 *       disso e ignorada (ruido estatistico insuficiente).</li>
 *   <li>{@link #RUN_THRESHOLD} = 6: sequencia de >= 6 pontos consecutivos do
 *       MESMO lado da media (alvo) caracteriza RUN/SHIFT. Antecipa a regra 10x
 *       sem duplica-la.</li>
 *   <li>{@link #RUN_REJECTION_LENGTH} = 10: uma sequencia de >= 10 pontos do
 *       mesmo lado ja e (ou esta prestes a ser) a regra 10x — territorio do
 *       motor de Westgard. Series assim sao EXCLUIDAS do alerta preventivo.</li>
 *   <li>{@link #SLOPE_TOTAL_Z} = 2.0: a inclinacao da regressao linear dos
 *       Z-scores so e significativa quando a variacao modelada ao longo da
 *       janela ({@code |slope| * (n-1)}) atinge ~2 SD — metade do gatilho de
 *       rejeicao tipico (1-3s/2-2s operam em 2-3 SD), deixando margem para
 *       antecipar antes da violacao.</li>
 *   <li>{@link #SLOPE_MIN_R2} = 0.5: exige que a reta explique pelo menos metade
 *       da variancia (R^2) — evita classificar como deriva uma serie
 *       essencialmente ruidosa cuja inclinacao bruta passou no limiar por acaso.</li>
 * </ul>
 *
 * <p>Os Z-scores (valor normalizado pelo SD do proprio ponto/lote) sao a base da
 * deteccao: normalizam dispersao heterogenea entre lotes sem agregar SD de
 * lotes diferentes.
 */
@Component
public class DriftDetector {

    /** Minimo de pontos na serie para considerar deteccao (abaixo: ignora). */
    static final int MIN_POINTS = 6;

    /** Comprimento minimo de sequencia (mesmo lado da media) para sinalizar RUN/SHIFT. */
    static final int RUN_THRESHOLD = 6;

    /** A partir deste comprimento a sequencia ja e territorio da regra 10x (exclui). */
    static final int RUN_REJECTION_LENGTH = 10;

    /** Variacao modelada minima (em SD) ao longo da janela para slope significativo. */
    static final double SLOPE_TOTAL_Z = 2.0;

    /** R^2 minimo da regressao para aceitar a inclinacao como deriva real. */
    static final double SLOPE_MIN_R2 = 0.5;

    /** Sequencia (a partir do fim cronologico) longa o suficiente para severidade ALTA. */
    static final int RUN_SEVERITY_HIGH = 8;

    /** Padrao de tendencia gradual e crescente (Z-scores subindo). */
    public static final String PATTERN_DRIFT_UP = "DRIFT_UP";

    /** Padrao de tendencia gradual e decrescente (Z-scores caindo). */
    public static final String PATTERN_DRIFT_DOWN = "DRIFT_DOWN";

    /** Deslocamento de patamar caracterizado por sequencia longa de um lado, sem inclinacao clara. */
    public static final String PATTERN_SHIFT = "SHIFT";

    /** Sequencia de pontos do mesmo lado da media sem inclinacao significativa. */
    public static final String PATTERN_RUN = "RUN";

    public static final String SEVERITY_HIGH = "ALTA";
    public static final String SEVERITY_MEDIUM = "MEDIA";
    public static final String SEVERITY_LOW = "BAIXA";

    /**
     * Candidato a drift detectado deterministicamente para uma serie exame+nivel.
     *
     * <p>{@code recentSameSideRun} = quantos pontos consecutivos, a partir do mais
     * recente, estao do mesmo lado da media. {@code slopePerPoint} = inclinacao da
     * regressao linear dos Z-scores por ponto (ordem cronologica). Esses numeros
     * descrevem o que a estatistica achou e alimentam o contexto da IA — a IA NAO
     * estima nem inventa numeros.
     *
     * @param examName          exame da serie
     * @param level             nivel do controle
     * @param area              area de CQ
     * @param pattern           padrao classificado (DRIFT_UP/DRIFT_DOWN/SHIFT/RUN)
     * @param severity          severidade heuristica (ALTA/MEDIA/BAIXA)
     * @param points            tamanho da serie analisada
     * @param recentSameSideRun comprimento da sequencia recente do mesmo lado
     * @param slopePerPoint     inclinacao (Z-score por ponto) da regressao linear
     * @param lastZScore        Z-score do ponto mais recente
     */
    public record DriftCandidate(
        String examName,
        String level,
        String area,
        String pattern,
        String severity,
        int points,
        int recentSameSideRun,
        double slopePerPoint,
        double lastZScore
    ) {
    }

    /**
     * Avalia uma unica serie (exame+nivel) e devolve um candidato a drift, ou
     * {@link Optional#empty()} quando nao ha candidato.
     *
     * <p>A serie e recebida na MESMA ordem das queries do repositorio
     * (mais recente primeiro), como {@code findLeveyJenningsData}. Internamente
     * a ordem e invertida para cronologica (mais antigo -&gt; mais novo) antes da
     * regressao.
     *
     * <p>Exclusoes (nao geram candidato):
     * <ul>
     *   <li>serie nula/curta ({@literal <} {@link #MIN_POINTS});</li>
     *   <li>qualquer ponto sem SD valido (SD nulo/zero) — sem Z-score confiavel;</li>
     *   <li>serie com violacao de REJECTION recente (status {@code REPROVADO} ou
     *       {@code WestgardViolation} severidade {@code REJECTION}) — tratada pelo CQ;</li>
     *   <li>sequencia recente {@literal >=} {@link #RUN_REJECTION_LENGTH} (regra 10x — Westgard).</li>
     * </ul>
     *
     * @param examName nome do exame (apenas rotulo no candidato)
     * @param level    nivel do controle (apenas rotulo no candidato)
     * @param area     area de CQ (apenas rotulo no candidato)
     * @param series   serie recente, mais recente primeiro (como vem do repositorio)
     */
    public Optional<DriftCandidate> detect(
        String examName, String level, String area, List<QcRecord> series
    ) {
        if (series == null || series.size() < MIN_POINTS) {
            return Optional.empty();
        }

        // Exclui series que JA violaram rejeicao (fonte de verdade: motor de Westgard).
        if (hasRecentRejection(series)) {
            return Optional.empty();
        }

        // Reordena para cronologico (mais antigo -> mais novo).
        List<QcRecord> chronological = series.stream()
            .sorted(java.util.Comparator
                .comparing(QcRecord::getDate, java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()))
                .thenComparing(record -> record.getCreatedAt(),
                    java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()))
                // Desempate estavel por chave primaria: pontos do mesmo dia e mesmo
                // createdAt (ex.: lote importado em massa) teriam ordem indefinida,
                // o que mexeria marginalmente em run/slope. O id garante determinismo.
                .thenComparing(record -> record.getId() == null ? "" : record.getId().toString()))
            .toList();

        double[] zScores = new double[chronological.size()];
        for (int index = 0; index < chronological.size(); index++) {
            QcRecord record = chronological.get(index);
            Double sd = record.getTargetSd();
            if (sd == null || sd == 0D) {
                // Sem SD confiavel nao ha Z-score: nao arriscamos falso-positivo.
                return Optional.empty();
            }
            zScores[index] = NumericUtils.calculateZScore(
                record.getValue(), record.getTargetValue(), sd);
        }

        int recentRun = recentSameSideRun(zScores);
        // Sequencia >= 10 e regra 10x (territorio Westgard): exclui do alerta preventivo.
        if (recentRun >= RUN_REJECTION_LENGTH) {
            return Optional.empty();
        }

        LinearFit fit = linearFit(zScores);
        double totalModeledChange = Math.abs(fit.slope()) * (zScores.length - 1);
        boolean significantSlope = totalModeledChange >= SLOPE_TOTAL_Z && fit.rSquared() >= SLOPE_MIN_R2;
        boolean significantRun = recentRun >= RUN_THRESHOLD;

        if (!significantSlope && !significantRun) {
            return Optional.empty();
        }

        String pattern = classifyPattern(fit.slope(), significantSlope, recentRun, zScores);
        String severity = classifySeverity(recentRun, totalModeledChange, zScores[zScores.length - 1]);

        return Optional.of(new DriftCandidate(
            examName, level, area, pattern, severity,
            zScores.length, recentRun, fit.slope(), zScores[zScores.length - 1]));
    }

    /**
     * Verdadeiro se a serie contem QUALQUER rejeicao na janela analisada (nao
     * apenas nos pontos mais novos): basta um ponto REPROVADO ou com violacao de
     * severidade REJECTION para excluir a serie inteira do alerta preventivo —
     * comportamento conservador (na duvida, cede ao CQ). Usa exclusivamente a
     * saida JA persistida do motor de Westgard; nao recalcula regra alguma.
     */
    private boolean hasRecentRejection(List<QcRecord> series) {
        for (QcRecord record : series) {
            if (record == null) {
                continue;
            }
            if ("REPROVADO".equalsIgnoreCase(record.getStatus())) {
                return true;
            }
            if (record.getViolations() != null) {
                for (var violation : record.getViolations()) {
                    if (violation != null && "REJECTION".equalsIgnoreCase(violation.getSeverity())) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Comprimento da sequencia, a partir do ponto mais recente (fim do array
     * cronologico), de pontos estritamente do mesmo lado da media (Z != 0).
     * Pontos exatamente na media (Z == 0) interrompem a sequencia.
     */
    private int recentSameSideRun(double[] zScores) {
        int n = zScores.length;
        double last = zScores[n - 1];
        if (last == 0D) {
            return 0;
        }
        boolean positive = last > 0;
        int run = 0;
        for (int index = n - 1; index >= 0; index--) {
            double z = zScores[index];
            if (z == 0D || (z > 0) != positive) {
                break;
            }
            run++;
        }
        return run;
    }

    /**
     * Classifica o padrao. Slope significativo -&gt; DRIFT_UP/DRIFT_DOWN conforme
     * o sinal. Sem slope significativo (apenas sequencia): SHIFT quando a
     * sequencia e longa (deslocamento de patamar estavel), senao RUN.
     */
    private String classifyPattern(double slope, boolean significantSlope, int recentRun, double[] zScores) {
        if (significantSlope) {
            return slope > 0 ? PATTERN_DRIFT_UP : PATTERN_DRIFT_DOWN;
        }
        boolean longRun = recentRun >= RUN_SEVERITY_HIGH;
        return longRun ? PATTERN_SHIFT : PATTERN_RUN;
    }

    /**
     * Severidade heuristica: quanto mais perto de violar (sequencia longa ou
     * variacao modelada grande, ou ultimo ponto proximo de 3 SD), mais alta.
     */
    private String classifySeverity(int recentRun, double totalModeledChange, double lastZScore) {
        double absLast = Math.abs(lastZScore);
        if (recentRun >= RUN_SEVERITY_HIGH || totalModeledChange >= 3.0 || absLast >= 2.5) {
            return SEVERITY_HIGH;
        }
        if (recentRun >= RUN_THRESHOLD || totalModeledChange >= SLOPE_TOTAL_Z || absLast >= 1.5) {
            return SEVERITY_MEDIUM;
        }
        return SEVERITY_LOW;
    }

    /** Resultado de uma regressao linear simples: inclinacao e R^2. */
    private record LinearFit(double slope, double rSquared) {
    }

    /**
     * Regressao linear simples de {@code y} contra o indice {@code x = 0..n-1}.
     * Devolve a inclinacao (y por ponto) e o R^2 (qualidade do ajuste). Series
     * sem variacao em y devolvem slope 0 e R^2 0.
     */
    private LinearFit linearFit(double[] y) {
        int n = y.length;
        double sumX = 0;
        double sumY = 0;
        double sumXy = 0;
        double sumXx = 0;
        for (int index = 0; index < n; index++) {
            double x = index;
            sumX += x;
            sumY += y[index];
            sumXy += x * y[index];
            sumXx += x * x;
        }
        double denominator = n * sumXx - sumX * sumX;
        if (denominator == 0D) {
            return new LinearFit(0D, 0D);
        }
        double slope = (n * sumXy - sumX * sumY) / denominator;
        double intercept = (sumY - slope * sumX) / n;

        double meanY = sumY / n;
        double ssTotal = 0;
        double ssResidual = 0;
        for (int index = 0; index < n; index++) {
            double predicted = slope * index + intercept;
            ssResidual += Math.pow(y[index] - predicted, 2);
            ssTotal += Math.pow(y[index] - meanY, 2);
        }
        double rSquared = ssTotal == 0D ? 0D : 1D - (ssResidual / ssTotal);
        return new LinearFit(slope, rSquared);
    }
}

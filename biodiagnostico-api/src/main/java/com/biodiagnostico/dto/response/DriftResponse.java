package com.biodiagnostico.dto.response;

import java.util.List;

/**
 * D11 — Deteccao proativa de drift (assistiva, read-only, SOB DEMANDA).
 *
 * <p>A DETECCAO dos candidatos e DETERMINISTICA (estatistica pura: sequencias e
 * inclinacao de regressao linear, sem IA). A IA apenas INTERPRETA os candidatos
 * que a estatistica ja encontrou — nunca decide se ha drift nem inventa series.
 * O endpoint nao grava nada e NAO reimplementa Westgard: olha series que AINDA
 * NAO violaram a regra de rejeicao, para ANTECIPAR tendencia para revisao
 * humana. A fonte de verdade do status e das violacoes permanece o
 * {@code WestgardEngine} deterministico.
 *
 * <p>Lista vazia quando nao ha candidatos (nesse caso a IA nem e chamada).
 *
 * @param alerts alertas preventivos de drift detectados pela estatistica
 */
public record DriftResponse(
    List<DriftAlert> alerts
) {

    /**
     * Um alerta preventivo de drift para uma serie exame+nivel.
     *
     * @param examName nome do exame da serie
     * @param level    nivel do controle (ex.: {@code "N1"}, {@code "N2"})
     * @param pattern  padrao detectado: {@code "DRIFT_UP"}, {@code "DRIFT_DOWN"},
     *                 {@code "SHIFT"} ou {@code "RUN"}
     * @param severity severidade heuristica: {@code "ALTA"}, {@code "MEDIA"} ou
     *                 {@code "BAIXA"} (quanto mais perto de violar / maior a
     *                 sequencia, mais alta)
     * @param detail   interpretacao textual da IA (RECOMENDACAO para revisao
     *                 humana); vazio em degradacao graciosa quando a IA falha
     */
    public record DriftAlert(
        String examName,
        String level,
        String pattern,
        String severity,
        String detail
    ) {
    }
}

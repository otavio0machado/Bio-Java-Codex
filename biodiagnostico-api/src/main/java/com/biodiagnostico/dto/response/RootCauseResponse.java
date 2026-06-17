package com.biodiagnostico.dto.response;

/**
 * A3 — Analise de causa-raiz correlacionada (assistiva, read-only).
 *
 * @param analysis texto em PT-BR com hipoteses de causa provavel (aleatoria vs
 *     sistematica), correlacao com reagente/calibracao/manutencao e proximos
 *     passos; e RECOMENDACAO para revisao humana, nao decisao
 */
public record RootCauseResponse(String analysis) {
}

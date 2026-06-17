package com.biodiagnostico.dto.response;

/**
 * C9 — Resumo executivo do dashboard (assistivo, read-only).
 *
 * @param summary narrativa executiva em PT-BR (visao geral, destaques, pontos
 *     de atencao e recomendacoes) gerada pela IA para revisao humana
 */
public record ExecutiveSummaryResponse(String summary) {
}

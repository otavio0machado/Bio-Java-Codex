package com.biodiagnostico.dto.response;

import java.util.List;

/**
 * B5 — Resultado da validacao assistiva de um lote de importacao de CQ.
 *
 * <p><strong>Read-only:</strong> e um conjunto de SUGESTOES para revisao humana.
 * Nao representa decisao de importacao nem status de CQ; o operador decide.
 *
 * @param suggestions    lista de problemas/sugestoes encontrados (pode ser vazia
 *                       quando o lote esta plausivel)
 * @param readinessScore fracao de linhas SEM problema, em [0,1]
 *                       ({@code (totalLinhas - linhasComSugestao) / totalLinhas});
 *                       {@code 1.0} para lote vazio de problemas. Indicador de
 *                       prontidao, NAO aprovacao automatica.
 */
public record BatchValidationResponse(
    List<BatchSuggestion> suggestions,
    double readinessScore
) {

    /**
     * Uma sugestao de correcao para uma linha do lote.
     *
     * @param row        indice 0-based da linha na lista enviada
     * @param field      campo afetado (ex.: {@code "examName"}, {@code "value"},
     *                   {@code "targetSd"}, {@code "cvLimit"})
     * @param issue      categoria do problema: {@code "TYPO"}, {@code "UNKNOWN_EXAM"},
     *                   {@code "OUT_OF_RANGE"}, {@code "MISSING"} ou
     *                   {@code "SUSPECT_VALUE"}
     * @param suggestion texto da sugestao para revisao humana; para typo de exame,
     *                   o nome sugerido vem SEMPRE da lista de exames cadastrados
     *                   da area (a IA nunca inventa nome novo nem valor numerico)
     * @param confidence confianca da sugestao, em [0,1]
     */
    public record BatchSuggestion(
        int row,
        String field,
        String issue,
        String suggestion,
        double confidence
    ) {
    }
}

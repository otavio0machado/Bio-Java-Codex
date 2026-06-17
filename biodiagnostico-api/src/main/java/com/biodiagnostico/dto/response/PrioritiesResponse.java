package com.biodiagnostico.dto.response;

import java.util.List;

/**
 * D12 — Priorizacao inteligente (assistiva, read-only).
 *
 * <p>A lista {@code items} e DETERMINISTICA (heuristica de urgencia, sem IA); a
 * {@code recommendation} e a narrativa textual gerada pela IA a partir desses
 * itens. Se a IA falhar, {@code items} e devolvida com {@code recommendation}
 * vazia (degradacao graciosa). A IA nao inventa itens novos nem decide.
 *
 * @param items          itens candidatos a prioridade, ranqueados por urgencia
 * @param recommendation narrativa priorizada da IA (pode ser {@code ""})
 */
public record PrioritiesResponse(
    List<PriorityItem> items,
    String recommendation
) {

    /**
     * Um item priorizado de forma deterministica.
     *
     * @param category categoria do item: {@code "REAGENTE"}, {@code "MANUTENCAO"} ou {@code "CQ"}
     * @param title    titulo curto e legivel do item
     * @param urgency  urgencia heuristica: {@code "ALTA"}, {@code "MEDIA"} ou {@code "BAIXA"}
     * @param detail   detalhe objetivo (ex.: dias para vencer, regra Westgard violada)
     */
    public record PriorityItem(
        String category,
        String title,
        String urgency,
        String detail
    ) {
    }
}

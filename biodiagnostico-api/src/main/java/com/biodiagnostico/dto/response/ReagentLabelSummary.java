package com.biodiagnostico.dto.response;

/**
 * Resumo agregado de lotes por etiqueta ({@code label}).
 *
 * Substitui {@link ReagentTagSummary} no contrato externo. {@code ReagentTagSummary} ainda
 * existe para servir o endpoint {@code /api/reagents/tags} marcado como deprecated.
 */
public record ReagentLabelSummary(
    String label,
    long total,
    long emEstoque,
    long emUso,
    long foraDeEstoque,
    long vencidos
) {
}

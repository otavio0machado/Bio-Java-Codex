package com.biodiagnostico.dto.response;

public record ReagentTagSummary(
    String name,
    long total,
    long ativos,
    long emUso,
    long inativos,
    long vencidos
) {
}

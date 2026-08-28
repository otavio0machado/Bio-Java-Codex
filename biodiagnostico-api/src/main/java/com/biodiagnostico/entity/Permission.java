package com.biodiagnostico.entity;

public enum Permission {
    // Dashboard
    DASHBOARD_VIEW,

    // Controle de Qualidade (CQ / PROIN)
    QC_VIEW,
    QC_WRITE,
    QC_AREAS_WRITE,
    QC_IMPORT,
    QC_EXPORT,

    // Reagentes e Gestão de Estoque
    REAGENTS_VIEW,
    REAGENTS_WRITE,
    REAGENTS_DELETE,

    // Manutenção de Equipamentos
    MAINTENANCE_VIEW,
    MAINTENANCE_WRITE,

    // Controle de Temperatura
    TEMPERATURE_VIEW,
    TEMPERATURE_WRITE,

    // Central de Relatórios
    REPORTS_VIEW,
    REPORTS_GENERATE,
    REPORTS_DOWNLOAD;

    /**
     * Converte uma string de permissão (incluindo nomes legados) para o enum canônico correspondente.
     * Lança IllegalArgumentException se a string for nula ou desconhecida.
     */
    public static Permission fromString(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            throw new IllegalArgumentException("Nome de permissão não pode ser vazio");
        }
        String normalized = raw.trim().toUpperCase();
        return switch (normalized) {
            case "DASHBOARD_VIEW" -> DASHBOARD_VIEW;
            case "QC_VIEW" -> QC_VIEW;
            case "QC_WRITE" -> QC_WRITE;
            case "QC_AREAS_WRITE" -> QC_AREAS_WRITE;
            case "QC_IMPORT", "IMPORT" -> QC_IMPORT;
            case "QC_EXPORT" -> QC_EXPORT;
            case "REAGENTS_VIEW" -> REAGENTS_VIEW;
            case "REAGENTS_WRITE", "REAGENT_WRITE" -> REAGENTS_WRITE;
            case "REAGENTS_DELETE" -> REAGENTS_DELETE;
            case "MAINTENANCE_VIEW" -> MAINTENANCE_VIEW;
            case "MAINTENANCE_WRITE" -> MAINTENANCE_WRITE;
            case "TEMPERATURE_VIEW" -> TEMPERATURE_VIEW;
            case "TEMPERATURE_WRITE" -> TEMPERATURE_WRITE;
            case "REPORTS_VIEW" -> REPORTS_VIEW;
            case "REPORTS_GENERATE" -> REPORTS_GENERATE;
            case "REPORTS_DOWNLOAD", "DOWNLOAD" -> REPORTS_DOWNLOAD;
            default -> valueOf(normalized);
        };
    }
}

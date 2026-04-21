package com.biodiagnostico.service.reports.v2.catalog;

/**
 * Codigos estaveis de relatorios V2. Cada codigo e mapeado 1:1 para um
 * {@link ReportDefinition} no {@code ReportDefinitionRegistry} e, em runtime,
 * para um {@code ReportGenerator} via {@code ReportGeneratorRegistry}.
 */
public enum ReportCode {
    /** Relatorio operacional de CQ (F1 slice) — substitui funcionalmente o QC_PDF V1. */
    CQ_OPERATIONAL_V2
}

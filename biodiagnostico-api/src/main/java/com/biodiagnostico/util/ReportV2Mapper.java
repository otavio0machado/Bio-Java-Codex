package com.biodiagnostico.util;

import com.biodiagnostico.dto.reports.v2.ReportDefinitionResponse;
import com.biodiagnostico.dto.reports.v2.ReportExecutionResponse;
import com.biodiagnostico.entity.ReportRun;
import com.biodiagnostico.service.reports.v2.catalog.ReportDefinition;
import com.biodiagnostico.service.reports.v2.catalog.ReportFilterField;
import com.biodiagnostico.service.reports.v2.catalog.ReportFormat;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Mapeamentos dedicados a Reports V2. Centralizado aqui para nao poluir
 * {@link ResponseMapper} — que segue cuidando do V1.
 */
public final class ReportV2Mapper {

    private ReportV2Mapper() {}

    public static ReportDefinitionResponse toResponse(ReportDefinition def) {
        List<ReportDefinitionResponse.FilterFieldDto> fields = def.filterSpec().fields().stream()
            .map(ReportV2Mapper::toFilterFieldDto)
            .collect(Collectors.toUnmodifiableList());

        return new ReportDefinitionResponse(
            def.code().name(),
            def.name(),
            def.description(),
            def.category().name(),
            def.supportedFormats().stream().map(ReportFormat::name).collect(Collectors.toUnmodifiableSet()),
            fields,
            Set.copyOf(def.roleAccess()),
            def.signatureRequired(),
            def.previewSupported(),
            def.retentionDays(),
            def.legalBasis()
        );
    }

    public static ReportExecutionResponse toResponse(ReportRun run, String publicBaseUrl) {
        String downloadUrl = "/api/reports/v2/executions/" + run.getId() + "/download";
        String verifyUrl = null;
        if (run.getSha256() != null && publicBaseUrl != null && !publicBaseUrl.isBlank()) {
            String base = publicBaseUrl.endsWith("/") ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1) : publicBaseUrl;
            verifyUrl = base + "/r/verify/" + run.getSha256();
        }
        // periodLabel nao esta serializado em ReportRun diretamente — derivado de filters/period; omitido por ora
        String periodLabel = derivePeriodLabel(run);

        return new ReportExecutionResponse(
            run.getId(),
            run.getReportCode(),
            run.getFormat(),
            run.getStatus(),
            run.getReportNumber(),
            run.getSha256(),
            run.getSignatureHash(),
            // signedSha256: alias explicito de signatureHash para contratos novos
            run.getSignatureHash(),
            run.getSizeBytes(),
            run.getPageCount(),
            run.getUsername(),
            run.getCreatedAt(),
            run.getSignedAt(),
            run.getExpiresAt(),
            downloadUrl,
            verifyUrl,
            periodLabel
        );
    }

    private static ReportDefinitionResponse.FilterFieldDto toFilterFieldDto(ReportFilterField f) {
        return new ReportDefinitionResponse.FilterFieldDto(
            f.key(),
            f.type().name(),
            f.required(),
            f.allowedValues(),
            f.label(),
            f.helpText()
        );
    }

    private static String derivePeriodLabel(ReportRun run) {
        // best-effort: se periodType/month/year estao preenchidos, monta label basico
        if (run.getPeriodType() == null) return null;
        return switch (run.getPeriodType()) {
            case "year" -> run.getYear() != null ? "Ano " + run.getYear() : null;
            case "specific-month" -> {
                if (run.getMonth() != null && run.getYear() != null) {
                    yield run.getMonth() + "/" + run.getYear();
                }
                yield null;
            }
            default -> null;
        };
    }
}

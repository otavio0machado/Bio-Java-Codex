package com.biodiagnostico.dto.reports.v2;

import com.biodiagnostico.service.reports.v2.catalog.ReportCode;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

/**
 * Payload de {@code POST /api/reports/v2/preview}.
 */
public record PreviewReportV2Request(
    @NotNull ReportCode code,
    Map<String, Object> filters
) {}

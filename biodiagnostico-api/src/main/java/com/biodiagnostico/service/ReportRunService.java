package com.biodiagnostico.service;

import com.biodiagnostico.dto.response.ReportRunResponse;
import com.biodiagnostico.entity.ReportRun;
import com.biodiagnostico.repository.ReportRunRepository;
import com.biodiagnostico.util.ResponseMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Serviço de auditoria para geracao de relatorios. Grava uma linha por chamada
 * aos endpoints de {@code /api/reports/*} — em sucesso ou em falha — e expoe
 * o historico para a aba Relatorios do frontend.
 */
@Service
public class ReportRunService {

    public static final String TYPE_QC_PDF = "QC_PDF";
    public static final String TYPE_REAGENTS_PDF = "REAGENTS_PDF";
    public static final String STATUS_SUCCESS = "SUCCESS";
    public static final String STATUS_FAILURE = "FAILURE";

    private final ReportRunRepository repository;

    public ReportRunService(ReportRunRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void recordSuccess(
        String type, String area, String periodType, Integer month, Integer year,
        String reportNumber, String sha256, long sizeBytes, long durationMs,
        Authentication authentication
    ) {
        repository.save(ReportRun.builder()
            .id(UUID.randomUUID())
            .type(type)
            .area(area)
            .periodType(periodType)
            .month(month)
            .year(year)
            .reportNumber(reportNumber)
            .sha256(sha256)
            .sizeBytes(sizeBytes)
            .durationMs(durationMs)
            .status(STATUS_SUCCESS)
            .username(usernameOf(authentication))
            .build());
    }

    @Transactional
    public void recordFailure(
        String type, String area, String periodType, Integer month, Integer year,
        long durationMs, String errorMessage, Authentication authentication
    ) {
        repository.save(ReportRun.builder()
            .id(UUID.randomUUID())
            .type(type)
            .area(area)
            .periodType(periodType)
            .month(month)
            .year(year)
            .durationMs(durationMs)
            .status(STATUS_FAILURE)
            .errorMessage(truncate(errorMessage, 4_000))
            .username(usernameOf(authentication))
            .build());
    }

    @Transactional(readOnly = true)
    public List<ReportRunResponse> history(int limit) {
        int safeLimit = limit <= 0 ? 20 : Math.min(limit, 200);
        return repository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, safeLimit)).stream()
            .map(ResponseMapper::toReportRunResponse)
            .toList();
    }

    private String usernameOf(Authentication authentication) {
        return authentication == null ? null : authentication.getName();
    }

    private String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}

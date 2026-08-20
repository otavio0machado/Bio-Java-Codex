package com.biodiagnostico.service;

import com.biodiagnostico.dto.response.DashboardAlertsResponse;
import com.biodiagnostico.dto.response.DashboardKpiResponse;
import com.biodiagnostico.dto.response.MaintenanceResponse;
import com.biodiagnostico.dto.response.QcRecordResponse;
import com.biodiagnostico.dto.response.ReagentLotResponse;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.WestgardViolation;
import com.biodiagnostico.repository.MaintenanceRecordRepository;
import com.biodiagnostico.repository.QcRecordRepository;
import com.biodiagnostico.repository.ReagentLotRepository;
import com.biodiagnostico.repository.WestgardViolationRepository;
import com.biodiagnostico.util.ResponseMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {

    private final QcRecordRepository qcRecordRepository;
    private final ReagentLotRepository reagentLotRepository;
    private final MaintenanceService maintenanceService;
    private final WestgardViolationRepository westgardViolationRepository;

    public DashboardService(
        QcRecordRepository qcRecordRepository,
        ReagentLotRepository reagentLotRepository,
        MaintenanceService maintenanceService,
        WestgardViolationRepository westgardViolationRepository
    ) {
        this.qcRecordRepository = qcRecordRepository;
        this.reagentLotRepository = reagentLotRepository;
        this.maintenanceService = maintenanceService;
        this.westgardViolationRepository = westgardViolationRepository;
    }

    @Transactional(readOnly = true)
    public DashboardKpiResponse getKpis(String area) {
        LocalDate today = LocalDate.now();
        YearMonth currentMonth = YearMonth.now();
        LocalDate startMonth = currentMonth.atDay(1);
        LocalDate endMonth = currentMonth.atEndOfMonth();

        long totalToday;
        long totalMonth;
        Double rate;
        if (area != null && !area.isBlank()) {
            totalToday = qcRecordRepository.countByDateAndArea(today, area);
            totalMonth = qcRecordRepository.countByDateBetweenAndArea(startMonth, endMonth, area);
            rate = qcRecordRepository.calculateApprovalRateByArea(startMonth, endMonth, area);
        } else {
            totalToday = qcRecordRepository.countByDate(today);
            totalMonth = qcRecordRepository.countByDateBetween(startMonth, endMonth);
            rate = qcRecordRepository.calculateApprovalRate(startMonth, endMonth);
        }
        double approvalRate = rate != null ? rate : 0.0;
        long alertsCount = getAlertsCount();

        return new DashboardKpiResponse(
            totalToday,
            totalMonth,
            approvalRate,
            alertsCount > 0,
            alertsCount
        );
    }

    @Transactional(readOnly = true)
    public DashboardAlertsResponse getAlerts() {
        List<ReagentLotResponse> expiringReagents = reagentLotRepository
            .findExpiringLots(LocalDate.now(), LocalDate.now().plusDays(30))
            .stream()
            .map(ResponseMapper::toReagentLotResponse)
            .toList();

        List<MaintenanceResponse> pendingMaintenances = maintenanceService.getPendingMaintenances()
            .stream()
            .map(ResponseMapper::toMaintenanceResponse)
            .toList();
        List<QcRecordResponse> westgardViolations = mapRejectedRecordsOfCurrentMonth();

        return new DashboardAlertsResponse(
            new DashboardAlertsResponse.AlertSection<>(expiringReagents.size(), expiringReagents),
            new DashboardAlertsResponse.AlertSection<>(pendingMaintenances.size(), pendingMaintenances),
            new DashboardAlertsResponse.AlertSection<>(westgardViolations.size(), westgardViolations)
        );
    }

    @Transactional(readOnly = true)
    public List<QcRecordResponse> getRecentRecords(int limit) {
        return getRecentRecords(null, limit);
    }

    @Transactional(readOnly = true)
    public List<QcRecordResponse> getRecentRecords(String area, int limit) {
        List<QcRecord> records = qcRecordRepository.findRecentRecords(
            normalizeArea(area),
            PageRequest.of(0, limit)
        );
        Map<UUID, List<WestgardViolation>> violations = loadViolations(records);
        return records.stream()
            .map(record -> ResponseMapper.toQcRecordResponse(
                record,
                null,
                null,
                violations.getOrDefault(record.getId(), List.of())
            ))
            .toList();
    }

    private long getAlertsCount() {
        Instant startOfMonth = YearMonth.now().atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        long expiring = reagentLotRepository.countExpiringLots(LocalDate.now(), LocalDate.now().plusDays(30));
        long pendingMaintenances = maintenanceService.countPendingMaintenances();
        long rejected = westgardViolationRepository.countDistinctRejectedRecords(startOfMonth);
        return expiring + pendingMaintenances + rejected;
    }

    private List<QcRecordResponse> mapRejectedRecordsOfCurrentMonth() {
        Instant startOfMonth = YearMonth.now().atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        List<WestgardViolation> violations = westgardViolationRepository.findRecentRejections(startOfMonth);
        Map<UUID, QcRecord> uniqueRecords = new LinkedHashMap<>();
        for (WestgardViolation violation : violations) {
            if (violation.getQcRecord() != null) {
                uniqueRecords.putIfAbsent(violation.getQcRecord().getId(), violation.getQcRecord());
            }
        }
        Map<UUID, List<WestgardViolation>> violationsByRecord = loadViolations(
            new ArrayList<>(uniqueRecords.values())
        );
        List<QcRecordResponse> responses = new ArrayList<>();
        uniqueRecords.values().forEach(record -> responses.add(ResponseMapper.toQcRecordResponse(
            record,
            null,
            null,
            violationsByRecord.getOrDefault(record.getId(), List.of())
        )));
        return responses;
    }

    private Map<UUID, List<WestgardViolation>> loadViolations(List<QcRecord> records) {
        if (records.isEmpty()) {
            return Map.of();
        }
        List<UUID> ids = records.stream().map(QcRecord::getId).toList();
        Map<UUID, List<WestgardViolation>> grouped = new LinkedHashMap<>();
        westgardViolationRepository.findByQcRecordIdInOrderByCreatedAtDescIdDesc(ids)
            .forEach(violation -> grouped
                .computeIfAbsent(violation.getQcRecord().getId(), ignored -> new ArrayList<>())
                .add(violation));
        return grouped;
    }

    private String normalizeArea(String area) {
        return area == null || area.isBlank()
            ? ""
            : area.trim().toLowerCase(java.util.Locale.ROOT);
    }
}

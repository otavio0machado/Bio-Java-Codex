package com.biodiagnostico.dto.response;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ReagentLotResponse(
    UUID id,
    String name,
    String lotNumber,
    String manufacturer,
    String category,
    LocalDate expiryDate,
    Double quantityValue,
    String stockUnit,
    Double currentStock,
    Double estimatedConsumption,
    String storageTemp,
    LocalDate startDate,
    LocalDate endDate,
    String status,
    Integer alertThresholdDays,
    Instant createdAt,
    Instant updatedAt,
    long daysLeft,
    Double stockPct,
    Double daysToRupture,
    boolean nearExpiry,
    // ===== Fase 3: rastreabilidade forte =====
    String location,
    String supplier,
    LocalDate receivedDate,
    LocalDate openedDate,
    /**
     * Flag derivada: true quando o lote (match por lotNumber) apareceu em pelo menos
     * um registro de CQ nos ultimos 30 dias. Permite que o frontend destaque lotes
     * ativos em CQ e bloqueia decisoes de descarte apressadas.
     */
    boolean usedInQcRecently
) {
}

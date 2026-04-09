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
    boolean nearExpiry
) {
}

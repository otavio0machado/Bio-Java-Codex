package com.biodiagnostico.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record TemperatureRecordResponse(
    UUID id,
    UUID locationId,
    String locationName,
    String locationCode,
    String category,
    String area,
    BigDecimal minTempTarget,
    BigDecimal maxTempTarget,
    LocalDate date,
    LocalTime time,
    String period,
    BigDecimal tempCurrent,
    BigDecimal tempMax,
    BigDecimal tempMin,
    BigDecimal humidity,
    String status,
    String responsible,
    String actionTaken,
    String notes,
    String photoUrl,
    String photoFilename,
    Boolean ocrApplied,
    Instant createdAt,
    Instant updatedAt
) {
}

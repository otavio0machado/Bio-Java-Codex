package com.biodiagnostico.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record TemperatureLocationResponse(
    UUID id,
    String name,
    String code,
    String category,
    String area,
    BigDecimal minTempTarget,
    BigDecimal maxTempTarget,
    BigDecimal minHumidityTarget,
    BigDecimal maxHumidityTarget,
    String thermometerCode,
    String calibrationCertNumber,
    LocalDate calibrationDueDate,
    String frequency,
    Boolean active,
    String notes,
    Instant createdAt,
    Instant updatedAt
) {
}

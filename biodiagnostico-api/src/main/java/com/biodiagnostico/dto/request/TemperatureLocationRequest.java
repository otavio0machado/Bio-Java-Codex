package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record TemperatureLocationRequest(
    @NotBlank String name,
    @NotBlank String code,
    @NotBlank String category,
    String area,
    @NotNull BigDecimal minTempTarget,
    @NotNull BigDecimal maxTempTarget,
    BigDecimal minHumidityTarget,
    BigDecimal maxHumidityTarget,
    String thermometerCode,
    String calibrationCertNumber,
    LocalDate calibrationDueDate,
    String frequency,
    Boolean active,
    String notes
) {
}

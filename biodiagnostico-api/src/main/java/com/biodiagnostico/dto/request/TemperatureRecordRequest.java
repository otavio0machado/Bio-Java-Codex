package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record TemperatureRecordRequest(
    @NotNull UUID locationId,
    @NotNull LocalDate date,
    @NotNull LocalTime time,
    String period,
    BigDecimal tempCurrent,
    @NotNull BigDecimal tempMax,
    @NotNull BigDecimal tempMin,
    BigDecimal humidity,
    @NotBlank String responsible,
    String actionTaken,
    String notes,
    String photoUrl,
    String photoFilename,
    String ocrRawResult,
    Boolean ocrApplied
) {
}

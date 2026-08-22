package com.biodiagnostico.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TemperatureOcrResponse(
    String time,
    BigDecimal tempMax,
    BigDecimal tempMin,
    BigDecimal tempCurrent,
    BigDecimal humidity,
    LocalDate extractedDate,
    Double confidence,
    String statusMessage,
    String rawText
) {
}

package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record ReagentLotRequest(
    @NotBlank String name,
    @NotBlank String lotNumber,
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
    Integer alertThresholdDays,
    String status
) {
}

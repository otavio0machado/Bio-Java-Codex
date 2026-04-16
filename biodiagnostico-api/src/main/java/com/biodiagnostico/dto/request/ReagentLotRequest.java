package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record ReagentLotRequest(
    @NotBlank String name,
    @NotBlank String lotNumber,
    // Fase 2: fabricante e validade passam a ser obrigatorios para garantir rastreabilidade.
    @NotBlank String manufacturer,
    String category,
    @NotNull LocalDate expiryDate,
    Double quantityValue,
    String stockUnit,
    Double currentStock,
    Double estimatedConsumption,
    String storageTemp,
    LocalDate startDate,
    LocalDate endDate,
    Integer alertThresholdDays,
    String status,
    // Fase 3: rastreabilidade forte. Opcionais — o ADR vai decidir obrigatoriedade.
    String location,
    String supplier,
    LocalDate receivedDate,
    LocalDate openedDate
) {
}

package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record StockMovementRequest(
    @NotBlank String type,
    @NotNull @PositiveOrZero Double quantity,
    String responsible,
    String notes
) {
}

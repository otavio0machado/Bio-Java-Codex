package com.biodiagnostico.dto.response;

import java.time.Instant;
import java.util.UUID;

public record StockMovementResponse(
    UUID id,
    String type,
    Double quantity,
    String responsible,
    String notes,
    Double previousStock,
    Instant createdAt
) {
}

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
    // Fase 2: motivo do movimento (vide MovementReason). Pode ser null em
    // movimentos antigos cadastrados antes da migration V4.
    String reason,
    Instant createdAt
) {
}

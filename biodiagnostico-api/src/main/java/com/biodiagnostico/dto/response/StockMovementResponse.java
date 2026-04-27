package com.biodiagnostico.dto.response;

import java.time.Instant;
import java.util.UUID;

/**
 * Schema do contrato HTTP de um movimento de estoque apos refator v3.
 *
 * <p>Coexistencia de campos legados e pos-V14 (decisao 1.9):</p>
 * <ul>
 *   <li>{@code previousStock} (Double) — preenchido em movimentos pre-V14, NULL pos-V14.</li>
 *   <li>{@code previousUnitsInStock} / {@code previousUnitsInUse} (Integer) — NULL em
 *       movimentos pre-V14, preenchidos pos-V14.</li>
 *   <li>{@code isLegacy} (boolean) — true quando {@code previousStock != null AND
 *       previousUnitsInStock == null}. Frontend usa para escolher qual exibir.</li>
 * </ul>
 *
 * <p>NAO ha backfill retroativo — {@code previousStock} legado nao e copiado para o par
 * novo, porque perderia a distincao auditavel entre pre-refator-v3 e pos.</p>
 */
public record StockMovementResponse(
    UUID id,
    String type,
    Double quantity,
    String responsible,
    String notes,
    Double previousStock,
    Integer previousUnitsInStock,
    Integer previousUnitsInUse,
    boolean isLegacy,
    String reason,
    Instant createdAt
) {
}

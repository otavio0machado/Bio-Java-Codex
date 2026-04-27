package com.biodiagnostico.dto.response;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Schema do contrato HTTP do lote de reagente apos refator v2.
 *
 * <p>{@code label} substitui o antigo {@code name}. Saem do response: {@code quantityValue},
 * {@code stockUnit}, {@code estimatedConsumption}, {@code startDate}, {@code endDate},
 * {@code alertThresholdDays}, {@code stockPct}, {@code daysToRupture} (campos derivados
 * que perdiam sentido sem {@code quantityValue}/{@code estimatedConsumption}).</p>
 */
public record ReagentLotResponse(
    UUID id,
    String label,
    String lotNumber,
    String manufacturer,
    String category,
    LocalDate expiryDate,
    Double currentStock,
    String storageTemp,
    String status,
    Instant createdAt,
    Instant updatedAt,
    long daysLeft,
    boolean nearExpiry,
    String location,
    String supplier,
    LocalDate receivedDate,
    LocalDate openedDate,
    /**
     * Flag derivada: true quando o lote (match por lotNumber) apareceu em pelo menos
     * um registro de CQ nos ultimos 30 dias. Permite que o frontend destaque lotes
     * ativos em CQ e bloqueia decisoes de descarte apressadas.
     */
    boolean usedInQcRecently,
    /**
     * Diagnostico operacional derivado pelo backend. Alimenta a fila de saneamento
     * cadastral. Campos chave (ASCII): manufacturer, location, supplier, receivedDate.
     */
    boolean traceabilityComplete,
    List<String> traceabilityIssues,
    /**
     * Politica de movimentacao derivada do estado do lote. Lote {@code vencido} nao
     * aceita {@code ENTRADA}. Os demais aceitam — {@code fora_de_estoque} retorna a
     * {@code em_uso} via derivacao apos a entrada.
     */
    boolean canReceiveEntry,
    List<String> allowedMovementTypes,
    String movementWarning
) {
}

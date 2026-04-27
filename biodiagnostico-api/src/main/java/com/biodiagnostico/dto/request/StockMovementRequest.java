package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * Payload de movimento de estoque apos refator v3.
 *
 * <p>Tipos aceitos em escrita: {@code ENTRADA, ABERTURA, FECHAMENTO, CONSUMO, AJUSTE}.
 * {@code SAIDA} e descontinuado em escrita (read-only para historico).</p>
 *
 * <p>Validacoes cross-field aplicadas pelo service:</p>
 * <ul>
 *   <li>AJUSTE exige {@code targetUnitsInStock} e {@code targetUnitsInUse} (Min 0)
 *       e {@code reason} obrigatorio.</li>
 *   <li>ABERTURA / FECHAMENTO exigem {@code quantity == 1} (rejeita 400 se diferente).</li>
 *   <li>FECHAMENTO sem {@code reason} usa default {@code REVERSAO_ABERTURA}.</li>
 *   <li>CONSUMO em lote {@code vencido} exige {@code reason} (descarte registrado).</li>
 *   <li>ENTRADA / CONSUMO exigem {@code quantity > 0}.</li>
 * </ul>
 */
public record StockMovementRequest(
    @NotBlank String type,
    @NotNull @PositiveOrZero Double quantity,
    @NotBlank String responsible,
    String notes,
    String reason,
    @Min(0) Integer targetUnitsInStock,
    @Min(0) Integer targetUnitsInUse
) {
}

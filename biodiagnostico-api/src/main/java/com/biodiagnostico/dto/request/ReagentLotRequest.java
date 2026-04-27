package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * Payload de cadastro/edicao de lote de reagente apos refator v2.
 *
 * Campos obrigatorios canonicos (9): {@code label}, {@code lotNumber}, {@code manufacturer},
 * {@code category}, {@code currentStock}, {@code status}, {@code expiryDate}, {@code location},
 * {@code storageTemp}.
 *
 * <p>{@code label} substitui o antigo {@code name} — coluna {@code reagent_lots.name} se
 * mantem como sumario de etiqueta (vide ReagentLot).</p>
 *
 * <p>{@code category} e {@code storageTemp} aceitam apenas valores das listas fechadas
 * em {@code constants.ts}; o servico valida via lista explicita.</p>
 */
public record ReagentLotRequest(
    @NotBlank @Size(max = 255) String label,
    @NotBlank @Size(max = 255) String lotNumber,
    @NotBlank @Size(max = 128) String manufacturer,
    @NotBlank String category,
    @NotNull @Min(0) Double currentStock,
    @NotBlank String status,
    @NotNull LocalDate expiryDate,
    @NotBlank @Size(max = 128) String location,
    @NotBlank String storageTemp,
    @Size(max = 128) String supplier,
    LocalDate receivedDate,
    LocalDate openedDate
) {
}

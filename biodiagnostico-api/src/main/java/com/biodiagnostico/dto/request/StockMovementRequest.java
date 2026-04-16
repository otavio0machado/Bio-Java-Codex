package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record StockMovementRequest(
    @NotBlank String type,
    @NotNull @PositiveOrZero Double quantity,
    @NotBlank String responsible,
    String notes,
    // Fase 2: motivo obrigatorio para AJUSTE e SAIDA que zere o estoque.
    // Opcional neste DTO; a validacao de obrigatoriedade e feita no servico
    // conforme o tipo da movimentacao.
    String reason
) {
}

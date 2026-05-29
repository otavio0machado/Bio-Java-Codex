package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotBlank;

public record ImmunologyControlItemRequest(
    @NotBlank String name,
    @NotBlank String expectedResult
) {
}

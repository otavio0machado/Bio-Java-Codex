package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotBlank;

public record InterpretTrendRequest(
    @NotBlank String examName,
    @NotBlank String level,
    @NotBlank String area,
    Integer days
) {
}

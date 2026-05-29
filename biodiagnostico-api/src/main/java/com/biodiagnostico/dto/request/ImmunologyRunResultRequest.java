package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ImmunologyRunResultRequest(
    @NotNull UUID controlItemId,
    @NotBlank String observedResult
) {
}

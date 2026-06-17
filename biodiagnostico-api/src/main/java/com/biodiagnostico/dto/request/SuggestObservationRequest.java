package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotBlank;

public record SuggestObservationRequest(
    @NotBlank String kind,
    @NotBlank String context
) {
}

package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record TemperatureOcrRequest(
    @NotBlank String imageBase64,
    String mimeType,
    UUID locationId
) {
}

package com.biodiagnostico.dto.request;

import java.util.UUID;

public record TemperatureOcrRequest(
    String imageBase64,
    String mimeType,
    String imageMinBase64,
    String mimeTypeMin,
    UUID locationId
) {
}

package com.biodiagnostico.dto.response;

import java.util.UUID;

public record ImmunologyRunResultResponse(
    UUID id,
    UUID controlItemId,
    String controlName,
    String expectedResult,
    String observedResult,
    String status,
    Integer displayOrder
) {
}

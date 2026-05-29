package com.biodiagnostico.dto.response;

import java.util.UUID;

public record ImmunologyControlItemResponse(
    UUID id,
    String name,
    String expectedResult,
    Integer displayOrder
) {
}

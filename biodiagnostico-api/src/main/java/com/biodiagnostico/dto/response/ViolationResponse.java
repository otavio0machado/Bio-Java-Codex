package com.biodiagnostico.dto.response;

public record ViolationResponse(
    String rule,
    String description,
    String severity
) {
}

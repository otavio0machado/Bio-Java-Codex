package com.biodiagnostico.dto.response;

import java.util.UUID;

public record LabReportEmailResponse(
    UUID id,
    String email,
    String name,
    Boolean isActive
) {
}

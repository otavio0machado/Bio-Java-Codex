package com.biodiagnostico.dto.response;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ImmunologyControlSetResponse(
    UUID id,
    String analito,
    String manufacturer,
    String lotNumber,
    LocalDate validUntil,
    Boolean isActive,
    Boolean expired,
    Instant createdAt,
    Instant updatedAt,
    List<ImmunologyControlItemResponse> controls
) {
}

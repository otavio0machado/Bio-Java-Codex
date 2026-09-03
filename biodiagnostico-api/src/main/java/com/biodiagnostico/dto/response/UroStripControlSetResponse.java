package com.biodiagnostico.dto.response;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record UroStripControlSetResponse(
    UUID id,
    String controlLotNumber,
    String manufacturer,
    LocalDate validUntil,
    Double expectedPhMin,
    Double expectedPhMax,
    Double expectedDensityMin,
    Double expectedDensityMax,
    String expectedProteins,
    String expectedGlucose,
    String expectedKetones,
    String expectedBlood,
    String expectedUrobilinogen,
    String expectedNitrite,
    String expectedBilirubin,
    String expectedLeukocytes,
    Boolean isActive,
    Instant createdAt,
    Instant updatedAt
) {
}

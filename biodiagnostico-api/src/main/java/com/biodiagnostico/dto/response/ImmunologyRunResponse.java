package com.biodiagnostico.dto.response;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ImmunologyRunResponse(
    UUID id,
    UUID controlSetId,
    UUID reagentLotId,
    String reagentLabel,
    String reagentManufacturer,
    String reagentLotNumber,
    LocalDate reagentValidUntil,
    String reagentStatus,
    Integer reagentUnitsInStock,
    Integer reagentUnitsInUse,
    String reagentStorageTemp,
    String reagentLocation,
    LocalDate dataMedicao,
    String analito,
    String manufacturer,
    String lotNumber,
    LocalDate validUntil,
    String status,
    String analyst,
    String notes,
    Instant createdAt,
    List<ImmunologyRunResultResponse> results
) {
}

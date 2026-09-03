package com.biodiagnostico.dto.response;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record UroStripRunResponse(
    UUID id,
    UUID controlSetId,
    LocalDate dataMedicao,
    String controlLotSnapshot,
    LocalDate controlValidUntilSnapshot,
    UUID reagentLotId,
    String reagentLabelSnapshot,
    String reagentManufacturerSnapshot,
    String reagentLotNumberSnapshot,
    LocalDate reagentValidUntilSnapshot,
    Double measuredPh,
    String statusPh,
    Double measuredDensity,
    String statusDensity,
    String measuredProteins,
    String statusProteins,
    String measuredGlucose,
    String statusGlucose,
    String measuredKetones,
    String statusKetones,
    String measuredBlood,
    String statusBlood,
    String measuredUrobilinogen,
    String statusUrobilinogen,
    String measuredNitrite,
    String statusNitrite,
    String statusGeral,
    String correctiveAction,
    String analyst,
    String notes,
    Instant createdAt
) {
}

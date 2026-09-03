package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

public record UroStripRunRequest(
    @NotNull(message = "Controle de fita é obrigatório")
    UUID controlSetId,

    @NotNull(message = "Data da medição é obrigatória")
    LocalDate dataMedicao,

    UUID reagentLotId,
    Double measuredPh,
    Double measuredDensity,
    String measuredProteins,
    String measuredGlucose,
    String measuredKetones,
    String measuredBlood,
    String measuredUrobilinogen,
    String measuredNitrite,
    String correctiveAction,
    String analyst,
    String notes
) {
}

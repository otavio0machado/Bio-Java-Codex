package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record UroStripControlSetRequest(
    @NotBlank(message = "Lote do controle é obrigatório")
    String controlLotNumber,

    @NotBlank(message = "Fabricante/marca do controle é obrigatório")
    String manufacturer,

    @NotNull(message = "Validade do controle é obrigatória")
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
    String expectedLeukocytes
) {
}

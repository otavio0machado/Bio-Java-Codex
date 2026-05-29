package com.biodiagnostico.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ImmunologyRunRequest(
    @NotNull LocalDate dataMedicao,
    @NotNull UUID controlSetId,
    @Valid @NotEmpty List<ImmunologyRunResultRequest> results,
    String analyst,
    String notes
) {
}

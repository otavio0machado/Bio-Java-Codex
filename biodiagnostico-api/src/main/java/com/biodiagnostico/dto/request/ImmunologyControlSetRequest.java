package com.biodiagnostico.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

public record ImmunologyControlSetRequest(
    @NotBlank String analito,
    @NotBlank String manufacturer,
    @NotBlank String lotNumber,
    @NotNull LocalDate validUntil,
    @Valid @NotEmpty List<ImmunologyControlItemRequest> controls
) {
}

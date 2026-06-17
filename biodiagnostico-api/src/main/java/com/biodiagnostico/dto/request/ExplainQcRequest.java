package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ExplainQcRequest(
    @NotNull UUID recordId
) {
}

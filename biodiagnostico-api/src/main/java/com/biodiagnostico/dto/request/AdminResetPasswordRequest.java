package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AdminResetPasswordRequest(
    @NotBlank
    @Size(min = 4, max = 120)
    String newPassword
) {
}

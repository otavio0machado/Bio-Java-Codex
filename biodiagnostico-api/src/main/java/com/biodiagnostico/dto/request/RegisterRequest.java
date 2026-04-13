package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank @Email @Size(max = 120) String email,
    @NotBlank
    @Size(min = 8, max = 120)
    @Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$",
        message = "A senha deve conter ao menos uma letra maiúscula, uma minúscula e um número."
    )
    String password,
    @NotBlank @Size(max = 120) String name,
    @NotBlank
    @Pattern(regexp = "^(ADMIN|ANALYST|VIEWER)$", message = "Role inválida")
    String role
) {
}

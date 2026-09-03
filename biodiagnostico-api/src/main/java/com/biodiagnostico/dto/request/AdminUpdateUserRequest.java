package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Set;

public record AdminUpdateUserRequest(
    @Size(min = 3, max = 120) String username,
    @Size(max = 120) String name,
    @Pattern(regexp = "^(ADMIN|FUNCIONARIO|VIGILANCIA_SANITARIA|VISUALIZADOR)$", message = "Role inválida")
    String role,
    Boolean isActive,
    @Size(max = 120) String email,
    Set<String> permissions,
    Boolean mustChangePassword
) {
}

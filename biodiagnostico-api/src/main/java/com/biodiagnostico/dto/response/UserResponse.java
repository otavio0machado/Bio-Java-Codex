package com.biodiagnostico.dto.response;

import java.util.UUID;

public record UserResponse(
    UUID id,
    String email,
    String name,
    String role,
    Boolean isActive
) {
}

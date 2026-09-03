package com.biodiagnostico.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record UserResponse(
    UUID id,
    String username,
    String email,
    String name,
    String role,
    Boolean isActive,
    List<String> permissions,
    Instant createdAt,
    Instant lastLoginAt,
    Boolean mustChangePassword
) {
}

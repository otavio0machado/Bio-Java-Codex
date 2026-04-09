package com.biodiagnostico.dto.response;

public record PasswordResetResponse(
    String message,
    String resetUrl
) {
}

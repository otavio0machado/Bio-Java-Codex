package com.biodiagnostico.dto.response;

public record AuthResponse(
    String accessToken,
    String refreshToken,
    UserResponse user
) {
}

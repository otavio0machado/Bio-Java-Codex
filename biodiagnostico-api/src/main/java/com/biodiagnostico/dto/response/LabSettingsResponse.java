package com.biodiagnostico.dto.response;

public record LabSettingsResponse(
    String labName,
    String responsibleName,
    String responsibleRegistration,
    String address,
    String phone,
    String email
) {
}

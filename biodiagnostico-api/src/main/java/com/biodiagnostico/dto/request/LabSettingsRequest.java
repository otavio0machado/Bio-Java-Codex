package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record LabSettingsRequest(
    @Size(max = 200) String labName,
    @Size(max = 200) String responsibleName,
    @Size(max = 100) String responsibleRegistration,
    @Size(max = 300) String address,
    @Size(max = 50) String phone,
    @Email @Size(max = 200) String email
) {
}

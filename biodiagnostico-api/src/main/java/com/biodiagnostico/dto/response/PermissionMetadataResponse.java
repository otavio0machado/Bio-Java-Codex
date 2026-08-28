package com.biodiagnostico.dto.response;

import java.util.List;

public record PermissionMetadataResponse(
    String code,
    String label,
    String description,
    String module,
    String moduleLabel,
    String actionType,
    int displayOrder,
    List<String> implies
) {
}

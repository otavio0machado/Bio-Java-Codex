package com.biodiagnostico.dto.response;

import java.util.List;

public record PermissionCatalogResponse(
    List<ModuleGroup> modules,
    List<PermissionMetadataResponse> permissions
) {
    public record ModuleGroup(
        String module,
        String label,
        String description,
        int displayOrder,
        List<PermissionMetadataResponse> permissions
    ) {
    }
}

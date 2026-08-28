package com.biodiagnostico.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.biodiagnostico.dto.response.PermissionCatalogResponse;
import com.biodiagnostico.entity.Permission;
import com.biodiagnostico.exception.BusinessException;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PermissionCatalogTest {

    @Test
    @DisplayName("Deve conter catálogo completo com 16 permissões categorizadas")
    void shouldReturnFullCatalogWithAllSixteenPermissions() {
        PermissionCatalogResponse catalog = PermissionCatalog.getCatalogResponse();

        assertThat(catalog.modules()).hasSize(6);
        assertThat(catalog.permissions()).hasSize(16);

        assertThat(catalog.modules()).extracting("module")
            .containsExactly("DASHBOARD", "QC", "REAGENTS", "MAINTENANCE", "TEMPERATURE", "REPORTS");
    }

    @Test
    @DisplayName("Deve expandir automaticamente dependências de permissões (WRITE -> VIEW -> DASHBOARD_VIEW)")
    void shouldExpandImpliedPermissionsAutomatically() {
        Set<Permission> input = Set.of(Permission.QC_WRITE);
        Set<Permission> expanded = PermissionCatalog.expandImpliedPermissions(input);

        assertThat(expanded).containsExactlyInAnyOrder(
            Permission.QC_WRITE,
            Permission.QC_VIEW,
            Permission.DASHBOARD_VIEW
        );
    }

    @Test
    @DisplayName("Deve expandir dependências profundas de REAGENTS_DELETE para WRITE, VIEW e DASHBOARD")
    void shouldExpandReagentsDeleteDependencies() {
        Set<Permission> input = Set.of(Permission.REAGENTS_DELETE);
        Set<Permission> expanded = PermissionCatalog.expandImpliedPermissions(input);

        assertThat(expanded).containsExactlyInAnyOrder(
            Permission.REAGENTS_DELETE,
            Permission.REAGENTS_WRITE,
            Permission.REAGENTS_VIEW,
            Permission.DASHBOARD_VIEW
        );
    }

    @Test
    @DisplayName("Deve fazer parsing seguro e retrocompatível de nomes legados e sinônimos")
    void shouldParseLegacyAndStandardPermissionStrings() {
        assertThat(Permission.fromString("QC_WRITE")).isEqualTo(Permission.QC_WRITE);
        assertThat(Permission.fromString("REAGENT_WRITE")).isEqualTo(Permission.REAGENTS_WRITE);
        assertThat(Permission.fromString("REAGENTS_WRITE")).isEqualTo(Permission.REAGENTS_WRITE);
        assertThat(Permission.fromString("IMPORT")).isEqualTo(Permission.QC_IMPORT);
        assertThat(Permission.fromString("QC_IMPORT")).isEqualTo(Permission.QC_IMPORT);
        assertThat(Permission.fromString("DOWNLOAD")).isEqualTo(Permission.REPORTS_DOWNLOAD);
        assertThat(Permission.fromString("REPORTS_DOWNLOAD")).isEqualTo(Permission.REPORTS_DOWNLOAD);
        assertThat(Permission.fromString("TEMPERATURE_WRITE")).isEqualTo(Permission.TEMPERATURE_WRITE);
        assertThat(Permission.fromString("MAINTENANCE_WRITE")).isEqualTo(Permission.MAINTENANCE_WRITE);
    }

    @Test
    @DisplayName("Deve rejeitar permissões inválidas com exceção clara")
    void shouldRejectInvalidPermissionString() {
        assertThatThrownBy(() -> Permission.fromString("UNKNOWN_PERM"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("AdminService.parsePermissions deve rejeitar permissões desconhecidas com BusinessException")
    void shouldThrowBusinessExceptionOnInvalidPermission() {
        assertThatThrownBy(() -> AdminService.parsePermissions(Set.of("INVALID_PERM")))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Permissão inválida: INVALID_PERM");
    }
}

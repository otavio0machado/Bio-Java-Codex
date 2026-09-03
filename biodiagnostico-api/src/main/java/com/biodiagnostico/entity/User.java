package com.biodiagnostico.entity;

import com.biodiagnostico.service.PermissionCatalog;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String name;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role = Role.FUNCIONARIO;

    @Builder.Default
    @ElementCollection(targetClass = Permission.class, fetch = FetchType.EAGER)
    @CollectionTable(name = "user_permissions", joinColumns = @JoinColumn(name = "user_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "permission")
    private Set<Permission> permissions = new HashSet<>();

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = Boolean.TRUE;

    @Builder.Default
    @Column(name = "must_change_password", nullable = false)
    private Boolean mustChangePassword = Boolean.FALSE;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Set<Permission> getEffectivePermissions() {
        if (role == Role.ADMIN) {
            return PermissionCatalog.getAllPermissions();
        }
        if (role == Role.VIGILANCIA_SANITARIA) {
            return Set.of(
                Permission.DASHBOARD_VIEW,
                Permission.QC_VIEW,
                Permission.REAGENTS_VIEW,
                Permission.MAINTENANCE_VIEW,
                Permission.TEMPERATURE_VIEW,
                Permission.REPORTS_VIEW,
                Permission.REPORTS_DOWNLOAD
            );
        }
        if (role == Role.VISUALIZADOR) {
            return Set.of(
                Permission.DASHBOARD_VIEW,
                Permission.QC_VIEW,
                Permission.REAGENTS_VIEW,
                Permission.MAINTENANCE_VIEW,
                Permission.TEMPERATURE_VIEW,
                Permission.REPORTS_VIEW
            );
        }
        return permissions != null ? PermissionCatalog.expandImpliedPermissions(permissions) : Set.of();
    }

    public void setPermissions(Set<Permission> newPermissions) {
        if (this.permissions == null) {
            this.permissions = new HashSet<>();
        } else {
            this.permissions.clear();
        }
        if (newPermissions != null) {
            this.permissions.addAll(newPermissions);
        }
    }

    public boolean hasPermission(Permission permission) {
        if (permission == null) {
            return false;
        }
        if (role == Role.ADMIN) {
            return true;
        }
        return getEffectivePermissions().contains(permission);
    }
}

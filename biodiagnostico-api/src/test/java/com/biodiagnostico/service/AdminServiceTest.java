package com.biodiagnostico.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.biodiagnostico.dto.request.AdminUpdateUserRequest;
import com.biodiagnostico.dto.request.AdminUserRequest;
import com.biodiagnostico.dto.response.UserResponse;
import com.biodiagnostico.entity.Permission;
import com.biodiagnostico.entity.RefreshTokenSession;
import com.biodiagnostico.entity.Role;
import com.biodiagnostico.entity.User;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.repository.RefreshTokenSessionRepository;
import com.biodiagnostico.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class AdminServiceTest {

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private com.biodiagnostico.repository.AuditLogRepository auditLogRepository;
    private AuditService auditService;
    private RefreshTokenSessionRepository refreshTokenSessionRepository;
    private AdminService adminService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        auditLogRepository = mock(com.biodiagnostico.repository.AuditLogRepository.class);
        auditService = new AuditService(auditLogRepository, userRepository, new com.fasterxml.jackson.databind.ObjectMapper());
        refreshTokenSessionRepository = mock(RefreshTokenSessionRepository.class);
        adminService = new AdminService(
            userRepository,
            passwordEncoder,
            auditService,
            refreshTokenSessionRepository,
            auditLogRepository
        );
    }

    @Test
    @DisplayName("Deve criar funcionário expandindo automaticamente permissões implícitas (QC_WRITE -> QC_VIEW)")
    void shouldCreateFuncionarioWithExpandedPermissions() {
        AdminUserRequest request = new AdminUserRequest(
            "carlos.silva",
            "senha123",
            "Carlos Silva",
            "FUNCIONARIO",
            "carlos@biodiagnostico.com",
            Set.of("QC_WRITE"),
            false
        );

        when(userRepository.existsByUsername("carlos.silva")).thenReturn(false);
        when(userRepository.existsByEmailIgnoreCase("carlos@biodiagnostico.com")).thenReturn(false);
        when(passwordEncoder.encode("senha123")).thenReturn("encoded_hash");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            return User.builder()
                .id(UUID.randomUUID())
                .username(u.getUsername())
                .name(u.getName())
                .email(u.getEmail())
                .role(u.getRole())
                .permissions(u.getPermissions())
                .isActive(u.getIsActive())
                .mustChangePassword(u.getMustChangePassword())
                .build();
        });

        UserResponse response = adminService.createUser(request);

        assertThat(response.username()).isEqualTo("carlos.silva");
        assertThat(response.role()).isEqualTo("FUNCIONARIO");
        assertThat(response.permissions()).contains(
            "QC_WRITE",
            "QC_VIEW",
            "DASHBOARD_VIEW"
        );
    }

    @Test
    @DisplayName("Não deve permitir criar usuário com email já existente")
    void shouldFailWhenEmailAlreadyExists() {
        AdminUserRequest request = new AdminUserRequest(
            "novo.user",
            "senha123",
            "Novo User",
            "FUNCIONARIO",
            "duplicado@biodiagnostico.com",
            Set.of("QC_VIEW"),
            false
        );

        when(userRepository.existsByUsername("novo.user")).thenReturn(false);
        when(userRepository.existsByEmailIgnoreCase("duplicado@biodiagnostico.com")).thenReturn(true);

        assertThatThrownBy(() -> adminService.createUser(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Já existe um usuário com este e-mail");
    }

    @Test
    @DisplayName("Ao criar ADMIN, deve ignorar permissões passadas e persistir conjunto vazio (permissões são inerentes ao role)")
    void shouldIgnorePermissionsWhenCreatingAdmin() {
        AdminUserRequest request = new AdminUserRequest(
            "admin.master",
            "senha123",
            "Admin Master",
            "ADMIN",
            "admin@biodiagnostico.com",
            Set.of("QC_WRITE", "TEMPERATURE_WRITE"),
            false
        );

        when(userRepository.existsByUsername("admin.master")).thenReturn(false);
        when(userRepository.existsByEmailIgnoreCase("admin@biodiagnostico.com")).thenReturn(false);
        when(passwordEncoder.encode("senha123")).thenReturn("encoded_hash");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            return User.builder()
                .id(UUID.randomUUID())
                .username(u.getUsername())
                .name(u.getName())
                .email(u.getEmail())
                .role(u.getRole())
                .permissions(u.getPermissions())
                .isActive(u.getIsActive())
                .build();
        });

        UserResponse response = adminService.createUser(request);

        assertThat(response.role()).isEqualTo("ADMIN");
        assertThat(response.permissions()).hasSize(16);
    }

    @Test
    @DisplayName("Ao desativar usuário, deve revogar todas as sessões ativas")
    void shouldRevokeSessionsWhenDeactivatingUser() {
        UUID userId = UUID.randomUUID();
        UUID requestingAdminId = UUID.randomUUID();

        User user = User.builder()
            .id(userId)
            .username("joao")
            .name("João")
            .role(Role.FUNCIONARIO)
            .permissions(Set.of(Permission.QC_VIEW))
            .isActive(true)
            .build();

        RefreshTokenSession session = RefreshTokenSession.builder()
            .id(UUID.randomUUID())
            .user(user)
            .tokenId(UUID.randomUUID())
            .familyId(UUID.randomUUID())
            .tokenHash("hash123")
            .expiresAt(java.time.Instant.now().plusSeconds(3600))
            .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(refreshTokenSessionRepository.findByUser_IdAndRevokedAtIsNull(userId))
            .thenReturn(List.of(session));
        when(userRepository.save(any(User.class))).thenReturn(user);

        AdminUpdateUserRequest updateRequest = new AdminUpdateUserRequest(
            null,
            null,
            null,
            false,
            null,
            null,
            null
        );

        adminService.updateUser(userId, updateRequest, requestingAdminId);

        assertThat(user.getIsActive()).isFalse();
        assertThat(session.getRevokedAt()).isNotNull();
        verify(refreshTokenSessionRepository).save(session);
    }

    @Test
    @DisplayName("Deve revogar sessões avulsas com registro de auditoria")
    void shouldRevokeUserSessionsAndAudit() {
        UUID userId = UUID.randomUUID();
        User user = User.builder()
            .id(userId)
            .username("marcos")
            .isActive(true)
            .build();

        RefreshTokenSession session = RefreshTokenSession.builder()
            .id(UUID.randomUUID())
            .user(user)
            .tokenId(UUID.randomUUID())
            .familyId(UUID.randomUUID())
            .tokenHash("hash456")
            .expiresAt(java.time.Instant.now().plusSeconds(3600))
            .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(refreshTokenSessionRepository.findByUser_IdAndRevokedAtIsNull(userId))
            .thenReturn(List.of(session));

        adminService.revokeUserSessionsAndAudit(userId);

        assertThat(session.getRevokedAt()).isNotNull();
        verify(refreshTokenSessionRepository).save(session);
    }

    @Test
    @DisplayName("Não deve permitir que o administrador desative o próprio usuário")
    void shouldPreventSelfDeactivation() {
        UUID adminId = UUID.randomUUID();
        User adminUser = User.builder()
            .id(adminId)
            .username("admin")
            .role(Role.ADMIN)
            .isActive(true)
            .build();

        when(userRepository.findById(adminId)).thenReturn(Optional.of(adminUser));

        AdminUpdateUserRequest updateRequest = new AdminUpdateUserRequest(
            null,
            null,
            null,
            false,
            null,
            null,
            null
        );

        assertThatThrownBy(() -> adminService.updateUser(adminId, updateRequest, adminId))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Não é possível desativar o próprio usuário");
    }

    @Test
    @DisplayName("Ao excluir usuário sem histórico de auditoria, deve realizar exclusão física")
    void shouldDeleteUserWithNoHistory() {
        UUID userId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();

        User user = User.builder()
            .id(userId)
            .username("teste")
            .role(Role.FUNCIONARIO)
            .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(auditLogRepository.existsByUser_Id(userId)).thenReturn(false);

        java.util.Map<String, Object> result = adminService.deleteUser(userId, adminId);

        assertThat(result.get("status")).isEqualTo("DELETED");
        verify(userRepository).delete(user);
    }

    @Test
    @DisplayName("Ao excluir usuário que possui histórico de auditoria, deve inativar para preservar rastreabilidade")
    void shouldDeactivateUserWhenHasHistory() {
        UUID userId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();

        User user = User.builder()
            .id(userId)
            .username("auditoria.user")
            .role(Role.FUNCIONARIO)
            .isActive(true)
            .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(auditLogRepository.existsByUser_Id(userId)).thenReturn(true);

        java.util.Map<String, Object> result = adminService.deleteUser(userId, adminId);

        assertThat(result.get("status")).isEqualTo("DEACTIVATED");
        assertThat(user.getIsActive()).isFalse();
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("Não deve permitir que o administrador exclua o próprio usuário")
    void shouldBlockSelfDeletion() {
        UUID adminId = UUID.randomUUID();

        assertThatThrownBy(() -> adminService.deleteUser(adminId, adminId))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Não é possível excluir o próprio usuário administrador");
    }
}

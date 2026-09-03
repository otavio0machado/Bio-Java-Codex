package com.biodiagnostico.service;

import com.biodiagnostico.dto.request.AdminResetPasswordRequest;
import com.biodiagnostico.dto.request.AdminUpdateUserRequest;
import com.biodiagnostico.dto.request.AdminUserRequest;
import com.biodiagnostico.dto.response.PermissionCatalogResponse;
import com.biodiagnostico.dto.response.UserResponse;
import com.biodiagnostico.entity.Permission;
import com.biodiagnostico.entity.Role;
import com.biodiagnostico.entity.User;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.exception.ResourceNotFoundException;
import com.biodiagnostico.repository.RefreshTokenSessionRepository;
import com.biodiagnostico.repository.UserRepository;
import com.biodiagnostico.util.ResponseMapper;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final RefreshTokenSessionRepository refreshTokenSessionRepository;
    private final com.biodiagnostico.repository.AuditLogRepository auditLogRepository;

    public AdminService(
        UserRepository userRepository,
        PasswordEncoder passwordEncoder,
        AuditService auditService,
        RefreshTokenSessionRepository refreshTokenSessionRepository,
        com.biodiagnostico.repository.AuditLogRepository auditLogRepository
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
        this.refreshTokenSessionRepository = refreshTokenSessionRepository;
        this.auditLogRepository = auditLogRepository;
    }

    public List<UserResponse> listUsers() {
        return userRepository.findAll().stream()
            .map(ResponseMapper::toUserResponse)
            .toList();
    }

    public PermissionCatalogResponse getPermissionsCatalog() {
        return PermissionCatalog.getCatalogResponse();
    }

    public java.util.Optional<UUID> findUserIdByUsername(String username) {
        if (username == null || username.isBlank()) {
            return java.util.Optional.empty();
        }
        return userRepository.findByUsername(username.trim().toLowerCase()).map(User::getId);
    }

    @Transactional
    public UserResponse createUser(AdminUserRequest request) {
        String normalizedUsername = request.username().trim().toLowerCase();
        if (userRepository.existsByUsername(normalizedUsername)) {
            throw new BusinessException("Já existe um usuário com este nome de usuário");
        }

        if (request.email() != null && !request.email().trim().isEmpty()) {
            String email = request.email().trim();
            if (userRepository.existsByEmailIgnoreCase(email)) {
                throw new BusinessException("Já existe um usuário com este e-mail");
            }
        }

        Role role = AuthService.parseRole(request.role());
        Set<Permission> permissions = role == Role.FUNCIONARIO
            ? parsePermissions(request.permissions())
            : new HashSet<>();

        User user = User.builder()
            .username(normalizedUsername)
            .email(request.email() != null && !request.email().trim().isEmpty() ? request.email().trim() : null)
            .passwordHash(passwordEncoder.encode(request.password()))
            .name(request.name().trim())
            .role(role)
            .permissions(permissions)
            .isActive(Boolean.TRUE)
            .mustChangePassword(Boolean.TRUE.equals(request.mustChangePassword()))
            .build();

        User saved = userRepository.save(user);
        auditService.log("CRIAR_USUARIO", "User", saved.getId(),
            java.util.Map.of("username", saved.getUsername(), "role", saved.getRole().name()));
        return ResponseMapper.toUserResponse(saved);
    }

    @Transactional
    public UserResponse updateUser(UUID id, AdminUpdateUserRequest request, UUID requestingUserId) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));

        if (request.isActive() != null && !request.isActive() && id.equals(requestingUserId)) {
            throw new BusinessException("Não é possível desativar o próprio usuário");
        }

        if (request.username() != null && !request.username().trim().isEmpty()) {
            String newUsername = request.username().trim().toLowerCase();
            if (!newUsername.equals(user.getUsername())) {
                if (userRepository.existsByUsernameIgnoreCaseAndIdNot(newUsername, id)) {
                    throw new BusinessException("Já existe um usuário com este login");
                }
                user.setUsername(newUsername);
            }
        }

        if (request.name() != null && !request.name().trim().isEmpty()) {
            user.setName(request.name().trim());
        }
        if (request.email() != null) {
            String newEmail = request.email().trim().isEmpty() ? null : request.email().trim();
            if (newEmail != null && !newEmail.equalsIgnoreCase(user.getEmail())) {
                if (userRepository.existsByEmailIgnoreCaseAndIdNot(newEmail, id)) {
                    throw new BusinessException("Já existe um usuário com este e-mail");
                }
            }
            user.setEmail(newEmail);
        }
        if (request.isActive() != null) {
            user.setIsActive(request.isActive());
            if (!request.isActive()) {
                revokeUserSessions(id);
            }
        }
        if (request.mustChangePassword() != null) {
            user.setMustChangePassword(request.mustChangePassword());
        }
        if (request.role() != null) {
            Role newRole = AuthService.parseRole(request.role());
            user.setRole(newRole);
            if (newRole != Role.FUNCIONARIO) {
                user.setPermissions(new HashSet<>());
            }
        }
        if (request.permissions() != null && user.getRole() == Role.FUNCIONARIO) {
            user.setPermissions(parsePermissions(request.permissions()));
        }

        User updated = userRepository.save(user);
        auditService.log("EDITAR_USUARIO", "User", updated.getId(),
            java.util.Map.of(
                "username", updated.getUsername(),
                "role", updated.getRole().name(),
                "ativo", updated.getIsActive()
            ));
        return ResponseMapper.toUserResponse(updated);
    }

    @Transactional
    public void resetPassword(UUID id, AdminResetPasswordRequest request) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        if (request.mustChangePassword() != null) {
            user.setMustChangePassword(request.mustChangePassword());
        }
        userRepository.save(user);
        revokeUserSessions(id);
        auditService.log("RESETAR_SENHA", "User", id, java.util.Map.of("username", user.getUsername()));
    }

    @Transactional
    public void revokeUserSessionsAndAudit(UUID userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));
        revokeUserSessions(userId);
        auditService.log("REVOGAR_SESSOES", "User", userId, java.util.Map.of("username", user.getUsername()));
    }

    @Transactional
    public java.util.Map<String, Object> deleteUser(UUID id, UUID requestingUserId) {
        if (id.equals(requestingUserId)) {
            throw new BusinessException("Não é possível excluir o próprio usuário administrador");
        }
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));

        boolean hasAuditHistory = auditLogRepository.existsByUser_Id(id);

        if (hasAuditHistory) {
            user.setIsActive(false);
            userRepository.save(user);
            revokeUserSessions(id);
            auditService.log("DESATIVAR_USUARIO", "User", id, java.util.Map.of(
                "username", user.getUsername(),
                "motivo", "Inativado via solicitação de exclusão (preservando histórico regulatório)"
            ));
            return java.util.Map.of(
                "status", "DEACTIVATED",
                "message", "O usuário possui histórico regulatório no laboratório. Para manter a rastreabilidade legal, a conta foi inativada e as sessões foram encerradas."
            );
        } else {
            revokeUserSessions(id);
            userRepository.delete(user);
            auditService.log("EXCLUIR_USUARIO", "User", id, java.util.Map.of("username", user.getUsername()));
            return java.util.Map.of(
                "status", "DELETED",
                "message", "Usuário excluído com sucesso."
            );
        }
    }

    private void revokeUserSessions(UUID userId) {
        Instant now = Instant.now();
        refreshTokenSessionRepository.findByUser_IdAndRevokedAtIsNull(userId).forEach(session -> {
            session.setRevokedAt(now);
            refreshTokenSessionRepository.save(session);
        });
    }

    static Set<Permission> parsePermissions(Set<String> raw) {
        if (raw == null || raw.isEmpty()) {
            return new HashSet<>();
        }
        Set<Permission> result = new HashSet<>();
        for (String value : raw) {
            try {
                result.add(Permission.fromString(value));
            } catch (IllegalArgumentException exception) {
                throw new BusinessException("Permissão inválida: " + value);
            }
        }
        return PermissionCatalog.expandImpliedPermissions(result);
    }
}

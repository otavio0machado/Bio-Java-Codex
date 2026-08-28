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

    public AdminService(
        UserRepository userRepository,
        PasswordEncoder passwordEncoder,
        AuditService auditService,
        RefreshTokenSessionRepository refreshTokenSessionRepository
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
        this.refreshTokenSessionRepository = refreshTokenSessionRepository;
    }

    public List<UserResponse> listUsers() {
        return userRepository.findAll().stream()
            .map(ResponseMapper::toUserResponse)
            .toList();
    }

    public PermissionCatalogResponse getPermissionsCatalog() {
        return PermissionCatalog.getCatalogResponse();
    }

    @Transactional
    public UserResponse createUser(AdminUserRequest request) {
        String normalizedUsername = request.username().trim().toLowerCase();
        if (userRepository.existsByUsername(normalizedUsername)) {
            throw new BusinessException("Já existe um usuário com este nome de usuário");
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

        if (request.name() != null && !request.name().trim().isEmpty()) {
            user.setName(request.name().trim());
        }
        if (request.email() != null) {
            user.setEmail(request.email().trim().isEmpty() ? null : request.email().trim());
        }
        if (request.isActive() != null) {
            user.setIsActive(request.isActive());
            if (!request.isActive()) {
                revokeUserSessions(id);
            }
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
        userRepository.save(user);
        revokeUserSessions(id);
        auditService.log("RESETAR_SENHA", "User", id, java.util.Map.of("username", user.getUsername()));
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

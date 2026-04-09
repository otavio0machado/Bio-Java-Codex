package com.biodiagnostico.service;

import com.biodiagnostico.dto.request.LoginRequest;
import com.biodiagnostico.dto.request.RefreshTokenRequest;
import com.biodiagnostico.dto.request.RegisterRequest;
import com.biodiagnostico.dto.response.AuthResponse;
import com.biodiagnostico.dto.response.UserResponse;
import com.biodiagnostico.entity.User;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.exception.ResourceNotFoundException;
import com.biodiagnostico.repository.UserRepository;
import com.biodiagnostico.security.JwtTokenProvider;
import com.biodiagnostico.util.ResponseMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public AuthService(
        UserRepository userRepository,
        PasswordEncoder passwordEncoder,
        JwtTokenProvider jwtTokenProvider
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
            .orElseThrow(() -> new BusinessException("Credenciais inválidas"));

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new BusinessException("Usuário inativo");
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BusinessException("Credenciais inválidas");
        }

        return buildAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        String refreshToken = request.refreshToken();
        if (!jwtTokenProvider.isTokenValid(refreshToken)) {
            throw new BusinessException("Refresh token inválido ou expirado");
        }

        User user = userRepository.findById(jwtTokenProvider.getUserId(refreshToken))
            .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new BusinessException("Usuário inativo");
        }

        return buildAuthResponse(user);
    }

    @Transactional
    public UserResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException("Já existe um usuário com este email");
        }

        User user = User.builder()
            .email(request.email().trim().toLowerCase())
            .passwordHash(passwordEncoder.encode(request.password()))
            .name(request.name())
            .role(normalizeRole(request.role()))
            .isActive(Boolean.TRUE)
            .build();

        return ResponseMapper.toUserResponse(userRepository.save(user));
    }

    private AuthResponse buildAuthResponse(User user) {
        return new AuthResponse(
            jwtTokenProvider.generateAccessToken(user),
            jwtTokenProvider.generateRefreshToken(user),
            ResponseMapper.toUserResponse(user)
        );
    }

    private String normalizeRole(String role) {
        String normalized = role == null ? "ANALYST" : role.trim().toUpperCase();
        return switch (normalized) {
            case "ADMIN", "ANALYST", "VIEWER" -> normalized;
            default -> throw new BusinessException("Role inválida");
        };
    }
}

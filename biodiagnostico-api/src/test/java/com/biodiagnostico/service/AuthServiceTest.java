package com.biodiagnostico.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.biodiagnostico.dto.request.LoginRequest;
import com.biodiagnostico.dto.request.RefreshTokenRequest;
import com.biodiagnostico.dto.request.RegisterRequest;
import com.biodiagnostico.entity.User;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.repository.UserRepository;
import com.biodiagnostico.security.JwtTokenProvider;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private AuthService authService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void setUp() {
        jwtTokenProvider = new JwtTokenProvider(
            "test-secret-key-that-is-at-least-256-bits-long-for-testing",
            900_000,
            604_800_000
        );
        authService = new AuthService(userRepository, passwordEncoder, jwtTokenProvider);
    }

    @Test
    @DisplayName("deve fazer login com credenciais válidas")
    void shouldLoginWithValidCredentials() {
        User user = activeUser();
        when(userRepository.findByEmail("ana@bio.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("123456", user.getPasswordHash())).thenReturn(true);

        var response = authService.login(new LoginRequest("ana@bio.com", "123456"));

        assertThat(response.accessToken()).isNotBlank();
    }

    @Test
    @DisplayName("deve lançar erro para senha inválida")
    void shouldThrowOnInvalidPassword() {
        User user = activeUser();
        when(userRepository.findByEmail(any())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(any(), any())).thenReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest("ana@bio.com", "123456")))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("deve lançar erro para email inexistente")
    void shouldThrowOnNonExistentEmail() {
        when(userRepository.findByEmail(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("ana@bio.com", "123456")))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("deve lançar erro para usuário inativo")
    void shouldThrowOnInactiveUser() {
        User user = activeUser();
        user.setIsActive(false);
        when(userRepository.findByEmail(any())).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(new LoginRequest("ana@bio.com", "123456")))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("deve renovar token com sucesso")
    void shouldRefreshTokenSuccessfully() {
        User user = activeUser();
        String refreshToken = jwtTokenProvider.generateRefreshToken(user);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        var response = authService.refreshToken(new RefreshTokenRequest(refreshToken));

        assertThat(response.refreshToken()).isNotBlank();
    }

    @Test
    @DisplayName("deve lançar erro para refresh token expirado")
    void shouldThrowOnExpiredRefreshToken() {
        assertThatThrownBy(() -> authService.refreshToken(new RefreshTokenRequest("expired-token")))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("deve registrar novo usuário")
    void shouldRegisterNewUser() {
        when(userRepository.existsByEmail("novo@bio.com")).thenReturn(false);
        when(passwordEncoder.encode("123456")).thenReturn("hash");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = authService.register(new RegisterRequest("novo@bio.com", "123456", "Novo", "ADMIN"));

        assertThat(response.email()).isEqualTo("novo@bio.com");
    }

    @Test
    @DisplayName("deve lançar erro para email duplicado")
    void shouldThrowOnDuplicateEmail() {
        when(userRepository.existsByEmail("novo@bio.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(new RegisterRequest("novo@bio.com", "123456", "Novo", "ADMIN")))
            .isInstanceOf(BusinessException.class);
    }

    private User activeUser() {
        return User.builder()
            .id(UUID.randomUUID())
            .email("ana@bio.com")
            .passwordHash("hash")
            .name("Ana")
            .role("ADMIN")
            .isActive(true)
            .build();
    }
}

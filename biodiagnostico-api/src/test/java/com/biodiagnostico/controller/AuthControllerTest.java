package com.biodiagnostico.controller;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.biodiagnostico.config.SecurityConfig;
import com.biodiagnostico.dto.response.AuthResponse;
import com.biodiagnostico.dto.response.PasswordResetResponse;
import com.biodiagnostico.dto.response.UserResponse;
import com.biodiagnostico.exception.GlobalExceptionHandler;
import com.biodiagnostico.security.JwtAuthFilter;
import com.biodiagnostico.service.AuthService;
import com.biodiagnostico.service.PasswordResetService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, AuthControllerTest.NoOpJwtFilterConfig.class})
class AuthControllerTest {

    private static final String TEST_JWT_SECRET = "testsecretkeythatisfarlongerthanthirtytwobytesforjwt";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private StubAuthService authService;

    @Autowired
    private StubPasswordResetService passwordResetService;

    @Test
    @DisplayName("deve retornar 200 em login bem-sucedido")
    void shouldReturn200OnSuccessfulLogin() throws Exception {
        authService.authResponse = authResponse();

        mockMvc.perform(post("/api/auth/login")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new LoginBody())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").value("access"));
    }

    @Test
    @DisplayName("deve retornar 400 em login inválido")
    void shouldReturn400OnInvalidLoginRequest() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                .contentType("application/json")
                .content("{\"email\":\"invalido\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("deve retornar 200 em refresh")
    void shouldReturn200OnTokenRefresh() throws Exception {
        authService.authResponse = authResponse();

        mockMvc.perform(post("/api/auth/refresh")
                .contentType("application/json")
                .content("{\"refreshToken\":\"refresh\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.refreshToken").value("refresh"));
    }

    @Test
    @DisplayName("deve retornar 201 em register com admin")
    void shouldReturn201OnRegister() throws Exception {
        authService.userResponse = userResponse();

        mockMvc.perform(post("/api/auth/register")
                .with(user("admin").roles("ADMIN"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new RegisterBody())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.email").value("novo@bio.com"));
    }

    @Test
    @DisplayName("deve retornar 403 em register sem admin")
    void shouldReturn403OnRegisterWithoutAdminRole() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .with(user("viewer").roles("VIEWER"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new RegisterBody())))
            .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("deve retornar 200 em solicitação de recuperação de senha")
    void shouldReturn200OnForgotPassword() throws Exception {
        passwordResetService.passwordResetResponse =
            new PasswordResetResponse("mensagem", "http://localhost:5173/reset-password?token=abc");

        mockMvc.perform(post("/api/auth/forgot-password")
                .contentType("application/json")
                .content("{\"email\":\"ana@bio.com\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("mensagem"));
    }

    @Test
    @DisplayName("deve retornar 200 em redefinição de senha")
    void shouldReturn200OnResetPassword() throws Exception {
        passwordResetService.passwordResetResponse =
            new PasswordResetResponse("Senha redefinida com sucesso.", null);

        mockMvc.perform(post("/api/auth/reset-password")
                .contentType("application/json")
                .content("{\"token\":\"abc\",\"newPassword\":\"123456\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Senha redefinida com sucesso."));
    }

    @TestConfiguration
    static class NoOpJwtFilterConfig {
        @Bean
        StubAuthService stubAuthService() {
            return new StubAuthService();
        }

        @Bean
        StubPasswordResetService stubPasswordResetService() {
            return new StubPasswordResetService();
        }

        @Bean
        com.biodiagnostico.security.JwtTokenProvider jwtTokenProvider() {
            return new com.biodiagnostico.security.JwtTokenProvider(TEST_JWT_SECRET, 900_000, 604_800_000);
        }

        @Bean
        JwtAuthFilter jwtAuthFilter(com.biodiagnostico.security.JwtTokenProvider jwtTokenProvider) {
            return new JwtAuthFilter(jwtTokenProvider);
        }
    }

    static class StubAuthService extends AuthService {
        private AuthResponse authResponse;
        private UserResponse userResponse;

        StubAuthService() {
            super(
                null,
                null,
                new com.biodiagnostico.security.JwtTokenProvider(
                    TEST_JWT_SECRET,
                    900_000,
                    604_800_000
                )
            );
        }

        @Override
        public AuthResponse login(com.biodiagnostico.dto.request.LoginRequest request) {
            return authResponse;
        }

        @Override
        public AuthResponse refreshToken(com.biodiagnostico.dto.request.RefreshTokenRequest request) {
            return authResponse;
        }

        @Override
        public UserResponse register(com.biodiagnostico.dto.request.RegisterRequest request) {
            return userResponse;
        }
    }

    static class StubPasswordResetService extends PasswordResetService {
        private PasswordResetResponse passwordResetResponse;

        StubPasswordResetService() {
            super(null, null, null, null);
        }

        @Override
        public PasswordResetResponse requestReset(com.biodiagnostico.dto.request.ForgotPasswordRequest request) {
            return passwordResetResponse;
        }

        @Override
        public PasswordResetResponse resetPassword(com.biodiagnostico.dto.request.ResetPasswordRequest request) {
            return passwordResetResponse;
        }
    }

    private AuthResponse authResponse() {
        return new AuthResponse("access", "refresh", userResponse());
    }

    private UserResponse userResponse() {
        return new UserResponse(UUID.randomUUID(), "novo@bio.com", "Novo", "ADMIN", true);
    }

    private static final class LoginBody {
        public final String email = "ana@bio.com";
        public final String password = "123456";
    }

    private static final class RegisterBody {
        public final String email = "novo@bio.com";
        public final String password = "123456";
        public final String name = "Novo";
        public final String role = "ADMIN";
    }
}

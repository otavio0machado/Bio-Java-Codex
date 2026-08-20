package com.biodiagnostico.exception;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.hamcrest.Matchers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Onda 4 / Fase A — contrato HTTP do rate-limit da IA.
 *
 * <p>Verifica, de forma isolada (standalone, sem seguranca/JWT), que o
 * {@link GlobalExceptionHandler} mapeia {@link RateLimitException} para
 * <strong>429 Too Many Requests</strong> com header {@code Retry-After}
 * numerico e o mesmo envelope {@code ApiError} dos demais handlers.
 */
class GlobalExceptionHandlerRateLimitTest {

    @RestController
    static class ThrowingController {

        @GetMapping("/test/rate-limit")
        String rateLimited() {
            throw new RateLimitException("Limite de 10 análises por minuto excedido", 42L);
        }

        @GetMapping("/test/rate-limit-floor")
        String rateLimitedFloor() {
            throw new RateLimitException("Limite de 10 análises por minuto excedido", 1L);
        }
    }

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
            .standaloneSetup(new ThrowingController())
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
    }

    @Test
    @DisplayName("RateLimitException -> 429 com Retry-After numérico e envelope ApiError")
    void rateLimitMapsTo429WithRetryAfter() throws Exception {
        mockMvc.perform(get("/test/rate-limit"))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().string("Retry-After", "42"))
            // Retry-After deve ser estritamente numérico (segundos), não uma data HTTP.
            .andExpect(header().string("Retry-After", Matchers.matchesPattern("\\d+")))
            .andExpect(jsonPath("$.status").value(429))
            .andExpect(jsonPath("$.error").value("Too Many Requests"))
            .andExpect(jsonPath("$.message").value("Limite de 10 análises por minuto excedido"));
    }

    @Test
    @DisplayName("Retry-After respeita o piso de 1 segundo")
    void retryAfterFloorIsOne() throws Exception {
        mockMvc.perform(get("/test/rate-limit-floor"))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().string("Retry-After", "1"));
    }
}

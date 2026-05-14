package com.biodiagnostico.controller;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.biodiagnostico.config.SecurityConfig;
import com.biodiagnostico.dto.request.MaintenanceRequest;
import com.biodiagnostico.entity.MaintenanceRecord;
import com.biodiagnostico.exception.GlobalExceptionHandler;
import com.biodiagnostico.security.AccessTokenBlacklistService;
import com.biodiagnostico.security.JwtAuthFilter;
import com.biodiagnostico.service.MaintenanceService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@WebMvcTest(MaintenanceController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, MaintenanceControllerTest.NoOpJwtFilterConfig.class})
class MaintenanceControllerTest {

    private static final String TEST_JWT_SECRET = "testsecretkeythatisfarlongerthanthirtytwobytesforjwt";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private StubMaintenanceService maintenanceService;

    @Test
    @DisplayName("deve listar manutenções para usuário autenticado")
    void shouldListMaintenanceWhenAuthenticated() throws Exception {
        maintenanceService.records = List.of(record());

        mockMvc.perform(get("/api/maintenance").with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].equipment").value("AU680"));
    }

    @Test
    @DisplayName("deve criar manutenção com MAINTENANCE_WRITE")
    void shouldCreateMaintenanceWithPermission() throws Exception {
        maintenanceService.createResponse = record();

        mockMvc.perform(post("/api/maintenance")
                .with(maintenanceWriter())
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(validRequest())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.equipment").value("AU680"));
    }

    @Test
    @DisplayName("deve bloquear criação de manutenção sem MAINTENANCE_WRITE")
    void shouldRejectMaintenanceWriteWithoutPermission() throws Exception {
        mockMvc.perform(post("/api/maintenance")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(validRequest())))
            .andExpect(status().isForbidden());
    }

    private RequestPostProcessor maintenanceWriter() {
        return user("ana").authorities(
            new SimpleGrantedAuthority("ROLE_FUNCIONARIO"),
            new SimpleGrantedAuthority("MAINTENANCE_WRITE")
        );
    }

    private MaintenanceRequest validRequest() {
        return new MaintenanceRequest("AU680", "Preventiva", LocalDate.now(), LocalDate.now().plusDays(30), "Ana", null);
    }

    private MaintenanceRecord record() {
        return MaintenanceRecord.builder()
            .id(UUID.randomUUID())
            .equipment("AU680")
            .type("Preventiva")
            .date(LocalDate.now())
            .nextDate(LocalDate.now().plusDays(30))
            .technician("Ana")
            .createdAt(Instant.now())
            .build();
    }

    @TestConfiguration
    static class NoOpJwtFilterConfig {
        @Bean
        StubMaintenanceService stubMaintenanceService() {
            return new StubMaintenanceService();
        }

        @Bean
        io.micrometer.core.instrument.MeterRegistry meterRegistry() {
            return new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
        }

        @Bean
        com.biodiagnostico.security.JwtTokenProvider jwtTokenProvider() {
            return new com.biodiagnostico.security.JwtTokenProvider(TEST_JWT_SECRET, "test-issuer", 900_000, 604_800_000);
        }

        @Bean
        AccessTokenBlacklistService accessTokenBlacklistService() {
            return new AccessTokenBlacklistService();
        }

        @Bean
        JwtAuthFilter jwtAuthFilter(
            com.biodiagnostico.security.JwtTokenProvider jwtTokenProvider,
            AccessTokenBlacklistService accessTokenBlacklistService
        ) {
            return new JwtAuthFilter(jwtTokenProvider, accessTokenBlacklistService);
        }
    }

    static class StubMaintenanceService extends MaintenanceService {
        private List<MaintenanceRecord> records = List.of();
        private MaintenanceRecord createResponse;

        StubMaintenanceService() {
            super(null);
        }

        @Override
        public List<MaintenanceRecord> getRecords(String equipment) {
            return records;
        }

        @Override
        public MaintenanceRecord createRecord(MaintenanceRequest request) {
            return createResponse;
        }
    }
}

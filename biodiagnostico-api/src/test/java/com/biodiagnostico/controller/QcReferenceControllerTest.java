package com.biodiagnostico.controller;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.biodiagnostico.config.SecurityConfig;
import com.biodiagnostico.dto.request.QcReferenceRequest;
import com.biodiagnostico.entity.QcExam;
import com.biodiagnostico.entity.QcReferenceValue;
import com.biodiagnostico.exception.GlobalExceptionHandler;
import com.biodiagnostico.security.AccessTokenBlacklistService;
import com.biodiagnostico.security.JwtAuthFilter;
import com.biodiagnostico.service.QcReferenceService;
import com.fasterxml.jackson.databind.ObjectMapper;
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

@WebMvcTest(QcReferenceController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, QcReferenceControllerTest.NoOpJwtFilterConfig.class})
class QcReferenceControllerTest {

    private static final String TEST_JWT_SECRET = "testsecretkeythatisfarlongerthanthirtytwobytesforjwt";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private StubQcReferenceService qcReferenceService;

    @Test
    @DisplayName("deve listar referências para usuário autenticado")
    void shouldListReferencesWhenAuthenticated() throws Exception {
        qcReferenceService.references = List.of(reference());

        mockMvc.perform(get("/api/qc/references").with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("Controle Glicose"));
    }

    @Test
    @DisplayName("deve criar referência com ADMIN")
    void shouldCreateReferenceAsAdmin() throws Exception {
        qcReferenceService.createResponse = reference();

        mockMvc.perform(post("/api/qc/references")
                .with(user("admin").roles("ADMIN"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(validRequest())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Controle Glicose"));
    }

    @Test
    @DisplayName("deve criar referência com QC_WRITE")
    void shouldCreateReferenceWithQcWrite() throws Exception {
        qcReferenceService.createResponse = reference();

        mockMvc.perform(post("/api/qc/references")
                .with(qcWriter())
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(validRequest())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Controle Glicose"));
    }

    @Test
    @DisplayName("deve bloquear criação de referência sem QC_WRITE")
    void shouldRejectReferenceWriteWithoutQcWrite() throws Exception {
        mockMvc.perform(post("/api/qc/references")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(validRequest())))
            .andExpect(status().isForbidden());
    }

    private RequestPostProcessor qcWriter() {
        return user("ana").authorities(
            new SimpleGrantedAuthority("ROLE_FUNCIONARIO"),
            new SimpleGrantedAuthority("QC_WRITE")
        );
    }

    private QcReferenceRequest validRequest() {
        return new QcReferenceRequest(
            UUID.randomUUID(),
            "Controle Glicose",
            "Normal",
            null,
            null,
            100D,
            5D,
            10D,
            LocalDate.now(),
            null,
            null
        );
    }

    private QcReferenceValue reference() {
        return QcReferenceValue.builder()
            .id(UUID.randomUUID())
            .exam(QcExam.builder().id(UUID.randomUUID()).name("Glicose").area("bioquimica").isActive(Boolean.TRUE).build())
            .name("Controle Glicose")
            .level("Normal")
            .targetValue(100D)
            .targetSd(5D)
            .cvMaxThreshold(10D)
            .validFrom(LocalDate.now())
            .isActive(Boolean.TRUE)
            .build();
    }

    @TestConfiguration
    static class NoOpJwtFilterConfig {
        @Bean
        StubQcReferenceService stubQcReferenceService() {
            return new StubQcReferenceService();
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

    static class StubQcReferenceService extends QcReferenceService {
        private List<QcReferenceValue> references = List.of();
        private QcReferenceValue createResponse;

        StubQcReferenceService() {
            super(null, null);
        }

        @Override
        public List<QcReferenceValue> getReferences(UUID examId, Boolean activeOnly) {
            return references;
        }

        @Override
        public QcReferenceValue createReference(QcReferenceRequest request) {
            return createResponse;
        }
    }
}

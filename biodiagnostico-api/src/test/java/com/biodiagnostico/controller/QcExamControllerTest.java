package com.biodiagnostico.controller;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.biodiagnostico.config.SecurityConfig;
import com.biodiagnostico.dto.request.QcExamRequest;
import com.biodiagnostico.entity.QcExam;
import com.biodiagnostico.exception.GlobalExceptionHandler;
import com.biodiagnostico.security.AccessTokenBlacklistService;
import com.biodiagnostico.security.JwtAuthFilter;
import com.biodiagnostico.service.QcExamService;
import com.fasterxml.jackson.databind.ObjectMapper;
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

@WebMvcTest(QcExamController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, QcExamControllerTest.NoOpJwtFilterConfig.class})
class QcExamControllerTest {

    private static final String TEST_JWT_SECRET = "testsecretkeythatisfarlongerthanthirtytwobytesforjwt";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private StubQcExamService qcExamService;

    @Test
    @DisplayName("deve listar exames para usuário autenticado")
    void shouldListExamsWhenAuthenticated() throws Exception {
        qcExamService.exams = List.of(exam());

        mockMvc.perform(get("/api/qc/exams").with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("Glicose"));
    }

    @Test
    @DisplayName("deve criar exame com QC_WRITE")
    void shouldCreateExamWithQcWrite() throws Exception {
        qcExamService.createResponse = exam();

        mockMvc.perform(post("/api/qc/exams")
                .with(qcWriter())
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new QcExamRequest("Glicose", "bioquimica", "mg/dL"))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Glicose"));
    }

    @Test
    @DisplayName("deve bloquear criação de exame sem QC_WRITE")
    void shouldRejectExamWriteWithoutQcWrite() throws Exception {
        mockMvc.perform(post("/api/qc/exams")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new QcExamRequest("Glicose", "bioquimica", "mg/dL"))))
            .andExpect(status().isForbidden());
    }

    private RequestPostProcessor qcWriter() {
        return user("ana").authorities(
            new SimpleGrantedAuthority("ROLE_FUNCIONARIO"),
            new SimpleGrantedAuthority("QC_WRITE")
        );
    }

    private QcExam exam() {
        return QcExam.builder()
            .id(UUID.randomUUID())
            .name("Glicose")
            .area("bioquimica")
            .unit("mg/dL")
            .isActive(Boolean.TRUE)
            .build();
    }

    @TestConfiguration
    static class NoOpJwtFilterConfig {
        @Bean
        StubQcExamService stubQcExamService() {
            return new StubQcExamService();
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

    static class StubQcExamService extends QcExamService {
        private List<QcExam> exams = List.of();
        private QcExam createResponse;

        StubQcExamService() {
            super(null);
        }

        @Override
        public List<QcExam> getExams(String area) {
            return exams;
        }

        @Override
        public QcExam createExam(QcExamRequest request) {
            return createResponse;
        }
    }
}

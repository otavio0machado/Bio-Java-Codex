package com.biodiagnostico.controller;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.biodiagnostico.config.SecurityConfig;
import com.biodiagnostico.dto.request.ImmunologyControlItemRequest;
import com.biodiagnostico.dto.request.ImmunologyControlSetRequest;
import com.biodiagnostico.dto.request.ImmunologyRunRequest;
import com.biodiagnostico.dto.request.ImmunologyRunResultRequest;
import com.biodiagnostico.dto.response.ImmunologyControlItemResponse;
import com.biodiagnostico.dto.response.ImmunologyControlSetResponse;
import com.biodiagnostico.dto.response.ImmunologyRunResponse;
import com.biodiagnostico.dto.response.ImmunologyRunResultResponse;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.exception.GlobalExceptionHandler;
import com.biodiagnostico.security.AccessTokenBlacklistService;
import com.biodiagnostico.security.JwtAuthFilter;
import com.biodiagnostico.service.ImmunologyQcService;
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

@WebMvcTest(ImmunologyController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, ImmunologyControllerTest.NoOpJwtFilterConfig.class})
class ImmunologyControllerTest {

    private static final String TEST_JWT_SECRET = "testsecretkeythatisfarlongerthanthirtytwobytesforjwt";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private StubImmunologyQcService service;

    @Test
    @DisplayName("deve listar controles de imunologia")
    void shouldListControlSets() throws Exception {
        service.controlSets = List.of(controlSetResponse());

        mockMvc.perform(get("/api/qc/imunologia/control-sets").with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].analito").value("HIV"))
            .andExpect(jsonPath("$[0].controls[0].expectedResult").value("REAGENTE"));
    }

    @Test
    @DisplayName("deve retornar 201 ao cadastrar controles de imunologia")
    void shouldReturn201WhenCreatingControlSet() throws Exception {
        service.createControlSetResponse = controlSetResponse();

        mockMvc.perform(post("/api/qc/imunologia/control-sets")
                .with(qcWriter())
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(controlSetRequest())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.analito").value("HIV"))
            .andExpect(jsonPath("$.manufacturer").value("Wama"))
            .andExpect(jsonPath("$.controls.length()").value(2));
    }

    @Test
    @DisplayName("deve retornar 201 ao registrar análise qualitativa")
    void shouldReturn201WhenCreatingRun() throws Exception {
        service.createRunResponse = runResponse("APROVADO");

        mockMvc.perform(post("/api/qc/imunologia/runs")
                .with(qcWriter())
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(runRequest())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("APROVADO"))
            .andExpect(jsonPath("$.results[0].observedResult").value("REAGENTE"));
    }

    @Test
    @DisplayName("deve retornar 400 quando service bloquear regra de domínio")
    void shouldReturn400ForDomainBlock() throws Exception {
        service.createRunException = new BusinessException("Controle de imunologia vencido na data da análise.");

        mockMvc.perform(post("/api/qc/imunologia/runs")
                .with(qcWriter())
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(runRequest())))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(service.createRunException.getMessage()));
    }

    @Test
    @DisplayName("deve exigir autenticação para registrar análise")
    void shouldRequireAuthenticationForRun() throws Exception {
        mockMvc.perform(post("/api/qc/imunologia/runs")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(runRequest())))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("deve retornar 403 ao registrar análise sem QC_WRITE")
    void shouldReturn403WithoutQcWrite() throws Exception {
        mockMvc.perform(post("/api/qc/imunologia/runs")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(runRequest())))
            .andExpect(status().isForbidden());
    }

    private RequestPostProcessor qcWriter() {
        return user("ana").authorities(
            new SimpleGrantedAuthority("ROLE_FUNCIONARIO"),
            new SimpleGrantedAuthority("QC_WRITE")
        );
    }

    @TestConfiguration
    static class NoOpJwtFilterConfig {
        @Bean
        StubImmunologyQcService stubImmunologyQcService() {
            return new StubImmunologyQcService();
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

    static class StubImmunologyQcService extends ImmunologyQcService {
        private List<ImmunologyControlSetResponse> controlSets = List.of();
        private ImmunologyControlSetResponse createControlSetResponse;
        private ImmunologyRunResponse createRunResponse;
        private RuntimeException createRunException;

        StubImmunologyQcService() {
            super(null, null);
        }

        @Override
        public List<ImmunologyControlSetResponse> getControlSets(String analito) {
            return controlSets;
        }

        @Override
        public ImmunologyControlSetResponse createControlSet(ImmunologyControlSetRequest request) {
            return createControlSetResponse;
        }

        @Override
        public ImmunologyRunResponse createRun(ImmunologyRunRequest request) {
            if (createRunException != null) {
                throw createRunException;
            }
            return createRunResponse;
        }
    }

    private ImmunologyControlSetRequest controlSetRequest() {
        return new ImmunologyControlSetRequest(
            "HIV",
            "Wama",
            "1022",
            LocalDate.of(2027, 10, 1),
            List.of(
                new ImmunologyControlItemRequest("Controle 1", "REAGENTE"),
                new ImmunologyControlItemRequest("Controle 2", "NAO_REAGENTE")
            )
        );
    }

    private ImmunologyRunRequest runRequest() {
        return new ImmunologyRunRequest(
            LocalDate.of(2026, 5, 29),
            UUID.randomUUID(),
            List.of(new ImmunologyRunResultRequest(UUID.randomUUID(), "REAGENTE")),
            "Ana",
            "Rotina nominal"
        );
    }

    private ImmunologyControlSetResponse controlSetResponse() {
        return new ImmunologyControlSetResponse(
            UUID.randomUUID(),
            "HIV",
            "Wama",
            "1022",
            LocalDate.of(2027, 10, 1),
            true,
            false,
            Instant.now(),
            Instant.now(),
            List.of(
                new ImmunologyControlItemResponse(UUID.randomUUID(), "Controle 1", "REAGENTE", 1),
                new ImmunologyControlItemResponse(UUID.randomUUID(), "Controle 2", "NAO_REAGENTE", 2)
            )
        );
    }

    private ImmunologyRunResponse runResponse(String status) {
        return new ImmunologyRunResponse(
            UUID.randomUUID(),
            UUID.randomUUID(),
            LocalDate.of(2026, 5, 29),
            "HIV",
            "Wama",
            "1022",
            LocalDate.of(2027, 10, 1),
            status,
            "Ana",
            "Rotina nominal",
            Instant.now(),
            List.of(
                new ImmunologyRunResultResponse(UUID.randomUUID(), UUID.randomUUID(), "Controle 1", "REAGENTE", "REAGENTE", "APROVADO", 1)
            )
        );
    }
}

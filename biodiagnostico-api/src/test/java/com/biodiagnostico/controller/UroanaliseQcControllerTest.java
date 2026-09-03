package com.biodiagnostico.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.biodiagnostico.config.SecurityConfig;
import com.biodiagnostico.dto.request.UroSedimentRunRequest;
import com.biodiagnostico.dto.request.UroStripControlSetRequest;
import com.biodiagnostico.dto.request.UroStripRunRequest;
import com.biodiagnostico.dto.response.UroSedimentRunResponse;
import com.biodiagnostico.dto.response.UroStripControlSetResponse;
import com.biodiagnostico.dto.response.UroStripRunResponse;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.exception.GlobalExceptionHandler;
import com.biodiagnostico.security.AccessTokenBlacklistService;
import com.biodiagnostico.security.JwtAuthFilter;
import com.biodiagnostico.service.UroanaliseQcService;
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

@WebMvcTest(UroanaliseQcController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, UroanaliseQcControllerTest.NoOpJwtFilterConfig.class})
class UroanaliseQcControllerTest {

    private static final String TEST_JWT_SECRET = "testsecretkeythatisfarlongerthanthirtytwobytesforjwt";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private StubUroanaliseQcService service;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        service.reset();
    }

    @Test
    @DisplayName("deve listar controles de fita")
    void shouldListControlSets() throws Exception {
        service.controlSets = List.of(controlSetResponse());

        mockMvc.perform(get("/api/qc/uroanalise/control-sets").with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].controlLotNumber").value("URiE 02382024"))
            .andExpect(jsonPath("$[0].manufacturer").value("Uro-Trol"));
    }

    @Test
    @DisplayName("deve retornar 201 ao cadastrar controle de fita")
    void shouldReturn201WhenCreatingControlSet() throws Exception {
        service.createControlSetResponse = controlSetResponse();

        mockMvc.perform(post("/api/qc/uroanalise/control-sets")
                .with(qcWriter())
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(controlSetRequest())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.controlLotNumber").value("URiE 02382024"))
            .andExpect(jsonPath("$.expectedProteins").value("NEGATIVO"));
    }

    @Test
    @DisplayName("deve retornar 201 ao registrar corrida de fita reativa")
    void shouldReturn201WhenCreatingStripRun() throws Exception {
        service.createStripRunResponse = stripRunResponse("APROVADO");

        mockMvc.perform(post("/api/qc/uroanalise/strip/runs")
                .with(qcWriter())
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(stripRunRequest())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.statusGeral").value("APROVADO"))
            .andExpect(jsonPath("$.statusPh").value("APROVADO"));
    }

    @Test
    @DisplayName("deve retornar 201 ao registrar corrida de sedimento urinario")
    void shouldReturn201WhenCreatingSedimentRun() throws Exception {
        service.createSedimentRunResponse = sedimentRunResponse("APROVADO");

        mockMvc.perform(post("/api/qc/uroanalise/sediment/runs")
                .with(qcWriter())
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(sedimentRunRequest())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.statusGeral").value("APROVADO"))
            .andExpect(jsonPath("$.leukocytesCv").value(0.0));
    }

    @Test
    @DisplayName("deve retornar 400 quando service bloquear por falta de acao corretiva")
    void shouldReturn400WhenMissingCorrectiveAction() throws Exception {
        service.createStripRunException = new BusinessException("Ação corretiva é obrigatória para controles de fita reprovados.");

        mockMvc.perform(post("/api/qc/uroanalise/strip/runs")
                .with(qcWriter())
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(stripRunRequest())))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(service.createStripRunException.getMessage()));
    }

    @Test
    @DisplayName("deve exigir autenticação para endpoints de escrita")
    void shouldRequireAuthentication() throws Exception {
        mockMvc.perform(post("/api/qc/uroanalise/strip/runs")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(stripRunRequest())))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("deve retornar 403 ao tentar registrar sem autorizacao QC_WRITE ou QC_AREAS_WRITE")
    void shouldReturn403WithoutWritePermission() throws Exception {
        mockMvc.perform(post("/api/qc/uroanalise/strip/runs")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(stripRunRequest())))
            .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("deve retornar 204 ao excluir corrida de fita")
    void shouldReturn204WhenDeletingStripRun() throws Exception {
        UUID id = UUID.randomUUID();

        mockMvc.perform(delete("/api/qc/uroanalise/strip/runs/{id}", id).with(qcWriter()))
            .andExpect(status().isNoContent());

        assertThat(service.deletedStripRunId).isEqualTo(id);
    }

    @Test
    @DisplayName("deve retornar 204 ao excluir corrida de sedimento")
    void shouldReturn204WhenDeletingSedimentRun() throws Exception {
        UUID id = UUID.randomUUID();

        mockMvc.perform(delete("/api/qc/uroanalise/sediment/runs/{id}", id).with(qcWriter()))
            .andExpect(status().isNoContent());

        assertThat(service.deletedSedimentRunId).isEqualTo(id);
    }

    private RequestPostProcessor qcWriter() {
        return user("ana").authorities(
            new SimpleGrantedAuthority("ROLE_FUNCIONARIO"),
            new SimpleGrantedAuthority("QC_AREAS_WRITE")
        );
    }

    private UroStripControlSetRequest controlSetRequest() {
        return new UroStripControlSetRequest(
            "URiE 02382024",
            "Uro-Trol",
            LocalDate.of(2026, 4, 23),
            5.0,
            6.0,
            1.005,
            1.025,
            "NEGATIVO",
            "NEGATIVO",
            "NEGATIVO",
            "NEGATIVO",
            "NORMAL",
            "NEGATIVO",
            "NEGATIVO",
            "NEGATIVO"
        );
    }

    private UroStripControlSetResponse controlSetResponse() {
        return new UroStripControlSetResponse(
            UUID.randomUUID(),
            "URiE 02382024",
            "Uro-Trol",
            LocalDate.of(2026, 4, 23),
            5.0,
            6.0,
            1.005,
            1.025,
            "NEGATIVO",
            "NEGATIVO",
            "NEGATIVO",
            "NEGATIVO",
            "NORMAL",
            "NEGATIVO",
            "NEGATIVO",
            "NEGATIVO",
            true,
            Instant.now(),
            Instant.now()
        );
    }

    private UroStripRunRequest stripRunRequest() {
        return new UroStripRunRequest(
            UUID.randomUUID(),
            LocalDate.of(2026, 9, 3),
            null,
            5.5,
            1.010,
            "0",
            "0",
            "0",
            "0",
            "NORMAL",
            "NEGATIVO",
            null,
            "Analista Teste",
            null
        );
    }

    private UroStripRunResponse stripRunResponse(String statusGeral) {
        return new UroStripRunResponse(
            UUID.randomUUID(),
            UUID.randomUUID(),
            LocalDate.of(2026, 9, 3),
            "URiE 02382024",
            LocalDate.of(2026, 4, 23),
            null,
            null,
            null,
            null,
            null,
            5.5,
            "APROVADO",
            1.010,
            "APROVADO",
            "0",
            "APROVADO",
            "0",
            "APROVADO",
            "0",
            "APROVADO",
            "0",
            "APROVADO",
            "NORMAL",
            "APROVADO",
            "NEGATIVO",
            "APROVADO",
            statusGeral,
            null,
            "Analista Teste",
            null,
            Instant.now()
        );
    }

    private UroSedimentRunRequest sedimentRunRequest() {
        return new UroSedimentRunRequest(
            LocalDate.of(2026, 9, 3),
            "11111111",
            null,
            "Analista 1",
            null,
            "Analista 2",
            2.0,
            2.0,
            2.0,
            2.0,
            "Discreta",
            "Discreta",
            "Ausente",
            "Ausente",
            "Presente",
            "Presente",
            "Ausente",
            "Ausente",
            "Ausente",
            "Ausente",
            null,
            null
        );
    }

    private UroSedimentRunResponse sedimentRunResponse(String statusGeral) {
        return new UroSedimentRunResponse(
            UUID.randomUUID(),
            LocalDate.of(2026, 9, 3),
            "11111111",
            null,
            "Analista 1",
            null,
            "Analista 2",
            2.0,
            2.0,
            0.0,
            "APROVADO",
            2.0,
            2.0,
            0.0,
            "APROVADO",
            "Discreta",
            "Discreta",
            "APROVADO",
            "Ausente",
            "Ausente",
            "APROVADO",
            "Presente",
            "Presente",
            "APROVADO",
            "Ausente",
            "Ausente",
            "APROVADO",
            "Ausente",
            "Ausente",
            "APROVADO",
            statusGeral,
            null,
            null,
            Instant.now()
        );
    }

    @TestConfiguration
    static class NoOpJwtFilterConfig {
        @Bean
        StubUroanaliseQcService stubUroanaliseQcService() {
            return new StubUroanaliseQcService();
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

    static class StubUroanaliseQcService extends UroanaliseQcService {
        private List<UroStripControlSetResponse> controlSets = List.of();
        private UroStripControlSetResponse createControlSetResponse;
        private UroStripRunResponse createStripRunResponse;
        private UroSedimentRunResponse createSedimentRunResponse;
        private UUID deletedStripRunId;
        private UUID deletedSedimentRunId;
        private RuntimeException createStripRunException;

        StubUroanaliseQcService() {
            super(null, null, null, null, null);
        }

        void reset() {
            controlSets = List.of();
            createControlSetResponse = null;
            createStripRunResponse = null;
            createSedimentRunResponse = null;
            deletedStripRunId = null;
            deletedSedimentRunId = null;
            createStripRunException = null;
        }

        @Override
        public List<UroStripControlSetResponse> getControlSets(boolean includeInactive) {
            return controlSets;
        }

        @Override
        public UroStripControlSetResponse createControlSet(UroStripControlSetRequest request) {
            return createControlSetResponse;
        }

        @Override
        public UroStripRunResponse createStripRun(UroStripRunRequest request, String loggedUsername) {
            if (createStripRunException != null) {
                throw createStripRunException;
            }
            return createStripRunResponse;
        }

        @Override
        public void deleteStripRun(UUID id) {
            this.deletedStripRunId = id;
        }

        @Override
        public UroSedimentRunResponse createSedimentRun(UroSedimentRunRequest request) {
            return createSedimentRunResponse;
        }

        @Override
        public void deleteSedimentRun(UUID id) {
            this.deletedSedimentRunId = id;
        }
    }
}

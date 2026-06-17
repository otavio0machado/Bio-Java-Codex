package com.biodiagnostico.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.biodiagnostico.config.SecurityConfig;
import com.biodiagnostico.dto.request.BatchValidationRequest;
import com.biodiagnostico.dto.request.BatchValidationRequest.BatchRowDto;
import com.biodiagnostico.dto.request.ExplainQcRequest;
import com.biodiagnostico.dto.request.InterpretTrendRequest;
import com.biodiagnostico.dto.request.SuggestObservationRequest;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.exception.GlobalExceptionHandler;
import com.biodiagnostico.repository.QcRecordRepository;
import com.biodiagnostico.security.AccessTokenBlacklistService;
import com.biodiagnostico.security.JwtAuthFilter;
import com.biodiagnostico.service.AiService;
import com.biodiagnostico.service.AiService.BatchSuggestionResult;
import com.biodiagnostico.service.AiService.BatchValidationResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Pageable;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Testes de contrato dos endpoints assistivos de IA (A1/A2/C8).
 * O {@link AiService} é stubado (nenhuma chamada real à IA) e o
 * {@link QcRecordRepository} é um mock Mockito.
 */
@WebMvcTest(AiController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, AiControllerTest.TestBeans.class})
class AiControllerTest {

    private static final String TEST_JWT_SECRET = "testsecretkeythatisfarlongerthanthirtytwobytesforjwt";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private QcRecordRepository qcRecordRepository;

    private QcRecord record() {
        return QcRecord.builder()
            .id(UUID.randomUUID())
            .examName("GLICOSE")
            .area("bioquimica")
            .level("N1")
            .date(LocalDate.now())
            .value(105.0)
            .targetValue(100.0)
            .targetSd(2.0)
            .status("REPROVADO")
            .build();
    }

    // ---------- A1 /api/ai/qc/explain ----------

    @Test
    @DisplayName("A1 — explica CQ quando o registro existe (200)")
    void explainQcHappyPath() throws Exception {
        QcRecord record = record();
        UUID id = record.getId();
        when(qcRecordRepository.findById(id)).thenReturn(Optional.of(record));
        when(qcRecordRepository.findByExamNameAndLevelAndAreaOrderByDateDesc(
            eq("GLICOSE"), eq("N1"), eq("bioquimica"), any(Pageable.class)))
            .thenReturn(List.of(record));

        mockMvc.perform(post("/api/ai/qc/explain")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new ExplainQcRequest(id))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.explanation").value("Explicacao do registro."));
    }

    @Test
    @DisplayName("A1 — retorna 404 quando o UUID não corresponde a nenhum registro")
    void explainQcNotFound() throws Exception {
        when(qcRecordRepository.findById(any(UUID.class))).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/ai/qc/explain")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new ExplainQcRequest(UUID.randomUUID()))))
            .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("A1 — retorna 400 quando recordId é nulo")
    void explainQcNullRecordId() throws Exception {
        mockMvc.perform(post("/api/ai/qc/explain")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content("{}"))
            .andExpect(status().isBadRequest());
    }

    // ---------- A2 /api/ai/qc/interpret-trend ----------

    @Test
    @DisplayName("A2 — interpreta tendência com série existente (200)")
    void interpretTrendHappyPath() throws Exception {
        when(qcRecordRepository.findLeveyJenningsData(
            eq("GLICOSE"), eq("N1"), eq("bioquimica"), any(Pageable.class)))
            .thenReturn(List.of(record()));

        mockMvc.perform(post("/api/ai/qc/interpret-trend")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(
                    new InterpretTrendRequest("GLICOSE", "N1", "bioquimica", 30))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.interpretation").value("Tendencia interpretada."));
    }

    @Test
    @DisplayName("A2 — série vazia retorna texto de 'sem dados' (200) sem chamar a IA")
    void interpretTrendEmptySeries() throws Exception {
        when(qcRecordRepository.findLeveyJenningsData(
            any(), any(), any(), any(Pageable.class)))
            .thenReturn(List.of());

        mockMvc.perform(post("/api/ai/qc/interpret-trend")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(
                    new InterpretTrendRequest("GLICOSE", "N1", "bioquimica", null))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.interpretation")
                .value("Sem dados suficientes no período para interpretar tendência."));
    }

    @Test
    @DisplayName("A2 — retorna 400 quando examName está em branco")
    void interpretTrendBlankExam() throws Exception {
        mockMvc.perform(post("/api/ai/qc/interpret-trend")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(
                    new InterpretTrendRequest("", "N1", "bioquimica", 30))))
            .andExpect(status().isBadRequest());
    }

    // ---------- C8 /api/ai/suggest-observation ----------

    @Test
    @DisplayName("C8 — sugere observação para kind válido (200)")
    void suggestObservationHappyPath() throws Exception {
        mockMvc.perform(post("/api/ai/suggest-observation")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(
                    new SuggestObservationRequest("post-calibration", "Troca de lâmpada"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.suggestion").value("Observacao sugerida."));
    }

    @Test
    @DisplayName("C8 — retorna 400 para kind inválido (BusinessException)")
    void suggestObservationInvalidKind() throws Exception {
        mockMvc.perform(post("/api/ai/suggest-observation")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(
                    new SuggestObservationRequest("nope", "contexto"))))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("C8 — retorna 400 quando kind está em branco")
    void suggestObservationBlankKind() throws Exception {
        mockMvc.perform(post("/api/ai/suggest-observation")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(
                    new SuggestObservationRequest("", "contexto"))))
            .andExpect(status().isBadRequest());
    }

    // ---------- B5 /api/ai/validate-batch ----------

    @Test
    @DisplayName("B5 — valida lote e retorna sugestões + readinessScore (200)")
    void validateBatchHappyPath() throws Exception {
        BatchValidationRequest request = new BatchValidationRequest(
            "bioquimica",
            List.of(new BatchRowDto("glicos", "N1", 100.0, 100.0, 2.0, 5.0)));

        mockMvc.perform(post("/api/ai/validate-batch")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.readinessScore").value(0.5))
            .andExpect(jsonPath("$.suggestions[0].row").value(0))
            .andExpect(jsonPath("$.suggestions[0].field").value("examName"))
            .andExpect(jsonPath("$.suggestions[0].issue").value("TYPO"))
            .andExpect(jsonPath("$.suggestions[0].suggestion").value("Exame sugerido: GLICOSE"))
            .andExpect(jsonPath("$.suggestions[0].confidence").value(0.9));
    }

    @Test
    @DisplayName("B5 — retorna 400 quando area está em branco")
    void validateBatchBlankArea() throws Exception {
        BatchValidationRequest request = new BatchValidationRequest(
            "", List.of(new BatchRowDto("GLICOSE", "N1", 100.0, 100.0, 2.0, 5.0)));

        mockMvc.perform(post("/api/ai/validate-batch")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("B5 — retorna 400 quando rows está vazio")
    void validateBatchEmptyRows() throws Exception {
        BatchValidationRequest request = new BatchValidationRequest("bioquimica", List.of());

        mockMvc.perform(post("/api/ai/validate-batch")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest());
    }

    @TestConfiguration
    static class TestBeans {

        @Bean
        QcRecordRepository qcRecordRepository() {
            return Mockito.mock(QcRecordRepository.class);
        }

        @Bean
        AiService aiService() {
            return new StubAiService();
        }

        @Bean
        io.micrometer.core.instrument.MeterRegistry meterRegistry() {
            return new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
        }

        @Bean
        com.biodiagnostico.security.JwtTokenProvider jwtTokenProvider() {
            return new com.biodiagnostico.security.JwtTokenProvider(
                TEST_JWT_SECRET, "test-issuer", 900_000, 604_800_000);
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

    static class StubAiService extends AiService {

        StubAiService() {
            super(null, null, null, new com.biodiagnostico.config.AiProperties(),
                new io.micrometer.core.instrument.simple.SimpleMeterRegistry(), null);
        }

        @Override
        public String explainViolation(QcRecord record, List<QcRecord> history) {
            return "Explicacao do registro.";
        }

        @Override
        public String interpretTrend(String examName, String level, String area, List<QcRecord> series) {
            if (series == null || series.isEmpty()) {
                return "Sem dados suficientes no período para interpretar tendência.";
            }
            return "Tendencia interpretada.";
        }

        @Override
        public String suggestObservation(String kind, String context) {
            if (!List.of("post-calibration", "maintenance", "reagent", "qc").contains(kind)) {
                throw new com.biodiagnostico.exception.BusinessException("Tipo de observação inválido");
            }
            return "Observacao sugerida.";
        }

        @Override
        public BatchValidationResult validateBatch(
            String area,
            List<com.biodiagnostico.dto.request.BatchValidationRequest.BatchRowDto> rows
        ) {
            List<BatchSuggestionResult> suggestions = List.of(
                new BatchSuggestionResult(0, "examName", "TYPO", "Exame sugerido: GLICOSE", 0.9));
            return new BatchValidationResult(suggestions, 0.5);
        }
    }
}

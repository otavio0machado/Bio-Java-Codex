package com.biodiagnostico.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.biodiagnostico.config.SecurityConfig;
import com.biodiagnostico.dto.request.BatchValidationRequest;
import com.biodiagnostico.dto.request.BatchValidationRequest.BatchRowDto;
import com.biodiagnostico.dto.request.ExplainQcRequest;
import com.biodiagnostico.dto.request.InterpretTrendRequest;
import com.biodiagnostico.dto.request.RootCauseRequest;
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

    @Autowired
    private com.biodiagnostico.repository.ReagentLotRepository reagentLotRepository;

    @Autowired
    private com.biodiagnostico.repository.MaintenanceRecordRepository maintenanceRecordRepository;

    @Autowired
    private com.biodiagnostico.repository.WestgardViolationRepository westgardViolationRepository;

    @Autowired
    private com.biodiagnostico.repository.QcExamRepository qcExamRepository;

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

    // ---------- C9 /api/ai/dashboard/summary ----------

    @Test
    @DisplayName("C9 — resumo executivo do dashboard (200)")
    void dashboardSummaryHappyPath() throws Exception {
        when(westgardViolationRepository.findByAreaAndPeriod(any(), any(), any())).thenReturn(List.of());

        mockMvc.perform(get("/api/ai/dashboard/summary")
                .param("area", "bioquimica")
                .param("days", "7")
                .with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.summary").value("Resumo executivo gerado."));
    }

    @Test
    @DisplayName("C9 — usa default de 7 dias quando days é omitido (200)")
    void dashboardSummaryDefaultDays() throws Exception {
        when(westgardViolationRepository.findByAreaAndPeriod(any(), any(), any())).thenReturn(List.of());

        mockMvc.perform(get("/api/ai/dashboard/summary")
                .with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.summary").value("Resumo executivo gerado."));
    }

    // ---------- C10 /api/ai/audit/summary ----------

    @Test
    @DisplayName("C10 — ADMIN obtém resumo de auditoria (200)")
    void auditSummaryAdminHappyPath() throws Exception {
        mockMvc.perform(get("/api/ai/audit/summary")
                .param("days", "7")
                .with(user("admin").roles("ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.summary").value("Resumo de auditoria gerado."));
    }

    @Test
    @DisplayName("C10 — NÃO-ADMIN recebe 403 (autorização)")
    void auditSummaryForbiddenForNonAdmin() throws Exception {
        mockMvc.perform(get("/api/ai/audit/summary")
                .with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isForbidden());
    }

    // ---------- A3 /api/ai/qc/root-cause ----------

    @Test
    @DisplayName("A3 — análise de causa-raiz quando o registro existe (200)")
    void rootCauseHappyPath() throws Exception {
        QcRecord record = record();
        UUID id = record.getId();
        when(qcRecordRepository.findById(id)).thenReturn(Optional.of(record));
        when(qcRecordRepository.findByExamNameAndLevelAndAreaOrderByDateDesc(
            eq("GLICOSE"), eq("N1"), eq("bioquimica"), any(Pageable.class)))
            .thenReturn(List.of(record));
        when(reagentLotRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of());
        when(maintenanceRecordRepository.findByEquipment(any())).thenReturn(List.of());

        mockMvc.perform(post("/api/ai/qc/root-cause")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new RootCauseRequest(id))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.analysis").value("Analise de causa-raiz gerada."));
    }

    @Test
    @DisplayName("A3 — retorna 404 quando o UUID não corresponde a nenhum registro")
    void rootCauseNotFound() throws Exception {
        when(qcRecordRepository.findById(any(UUID.class))).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/ai/qc/root-cause")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(new RootCauseRequest(UUID.randomUUID()))))
            .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("A3 — retorna 400 quando recordId é nulo")
    void rootCauseNullRecordId() throws Exception {
        mockMvc.perform(post("/api/ai/qc/root-cause")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content("{}"))
            .andExpect(status().isBadRequest());
    }

    // ---------- D12 /api/ai/priorities ----------

    @Test
    @DisplayName("D12 — lista vazia: items=[] e recommendation vazia (200)")
    void prioritiesEmpty() throws Exception {
        when(reagentLotRepository.findExpiredWithStock()).thenReturn(List.of());
        when(reagentLotRepository.findExpiringLots(any(), any())).thenReturn(List.of());
        when(maintenanceRecordRepository.findOverdue(any())).thenReturn(List.of());
        when(maintenanceRecordRepository.findUpcoming(any(), any())).thenReturn(List.of());
        when(westgardViolationRepository.findByAreaAndPeriod(any(), any(), any())).thenReturn(List.of());

        mockMvc.perform(get("/api/ai/priorities")
                .with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items").isArray())
            .andExpect(jsonPath("$.items").isEmpty())
            .andExpect(jsonPath("$.recommendation").value(""));
    }

    @Test
    @DisplayName("D12 — com itens: items determinísticos + recommendation da IA (200)")
    void prioritiesWithItems() throws Exception {
        com.biodiagnostico.entity.ReagentLot lot = com.biodiagnostico.entity.ReagentLot.builder()
            .name("HDL")
            .lotNumber("L1")
            .manufacturer("ACME")
            .expiryDate(LocalDate.now().minusDays(1))
            .build();
        when(reagentLotRepository.findExpiredWithStock()).thenReturn(List.of(lot));
        when(reagentLotRepository.findExpiringLots(any(), any())).thenReturn(List.of());
        when(maintenanceRecordRepository.findOverdue(any())).thenReturn(List.of());
        when(maintenanceRecordRepository.findUpcoming(any(), any())).thenReturn(List.of());
        when(westgardViolationRepository.findByAreaAndPeriod(any(), any(), any())).thenReturn(List.of());

        mockMvc.perform(get("/api/ai/priorities")
                .param("area", "bioquimica")
                .with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].category").value("REAGENTE"))
            .andExpect(jsonPath("$.items[0].urgency").value("ALTA"))
            .andExpect(jsonPath("$.recommendation").value("Recomendacao priorizada."));
    }

    // ---------- D11 /api/ai/drift ----------

    /** Série crescente (DRIFT_UP) na ordem do repositório (mais recente primeiro). */
    private List<QcRecord> upwardDriftSeries() {
        double target = 100.0;
        double sd = 2.0;
        double[] chronologicalZ = {0.0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1};
        List<QcRecord> chronological = new java.util.ArrayList<>();
        LocalDate base = LocalDate.now().minusDays(chronologicalZ.length);
        for (int index = 0; index < chronologicalZ.length; index++) {
            chronological.add(QcRecord.builder()
                .examName("GLICOSE")
                .area("bioquimica")
                .level("N1")
                .date(base.plusDays(index))
                .value(target + chronologicalZ[index] * sd)
                .targetValue(target)
                .targetSd(sd)
                .status("APROVADO")
                .build());
        }
        List<QcRecord> mostRecentFirst = new java.util.ArrayList<>(chronological);
        java.util.Collections.reverse(mostRecentFirst);
        return mostRecentFirst;
    }

    @Test
    @DisplayName("D11 — sem candidatos: alerts=[] (200) e default de 14 dias")
    void driftNoCandidates() throws Exception {
        when(qcExamRepository.findByAreaAndIsActiveTrue(eq("bioquimica")))
            .thenReturn(List.of(com.biodiagnostico.entity.QcExam.builder()
                .name("GLICOSE").area("bioquimica").isActive(true).build()));
        when(qcRecordRepository.findByExamNameAndAreaOrderByDateDesc(eq("GLICOSE"), eq("bioquimica")))
            .thenReturn(List.of());

        mockMvc.perform(get("/api/ai/drift")
                .param("area", "bioquimica")
                .with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.alerts").isArray())
            .andExpect(jsonPath("$.alerts").isEmpty());
    }

    @Test
    @DisplayName("D11 — série com tendência clara gera alerta com pattern/severity e detail da IA (200)")
    void driftWithCandidate() throws Exception {
        when(qcExamRepository.findByAreaAndIsActiveTrue(eq("bioquimica")))
            .thenReturn(List.of(com.biodiagnostico.entity.QcExam.builder()
                .name("GLICOSE").area("bioquimica").isActive(true).build()));
        when(qcRecordRepository.findByExamNameAndAreaOrderByDateDesc(eq("GLICOSE"), eq("bioquimica")))
            .thenReturn(upwardDriftSeries());

        mockMvc.perform(get("/api/ai/drift")
                .param("area", "bioquimica")
                .param("days", "14")
                .with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.alerts[0].examName").value("GLICOSE"))
            .andExpect(jsonPath("$.alerts[0].level").value("N1"))
            .andExpect(jsonPath("$.alerts[0].pattern").value("DRIFT_UP"))
            .andExpect(jsonPath("$.alerts[0].severity").value(
                org.hamcrest.Matchers.anyOf(
                    org.hamcrest.Matchers.is("ALTA"),
                    org.hamcrest.Matchers.is("MEDIA"),
                    org.hamcrest.Matchers.is("BAIXA"))))
            .andExpect(jsonPath("$.alerts[0].detail").value("Interpretacao de drift."));
    }

    @Test
    @DisplayName("D11 — sem 'area' varre todos os exames ativos (findByIsActiveTrue)")
    void driftAllAreasUsesActiveExams() throws Exception {
        when(qcExamRepository.findByIsActiveTrue())
            .thenReturn(List.of(com.biodiagnostico.entity.QcExam.builder()
                .name("GLICOSE").area("bioquimica").isActive(true).build()));
        when(qcRecordRepository.findByExamNameAndAreaOrderByDateDesc(eq("GLICOSE"), eq("bioquimica")))
            .thenReturn(upwardDriftSeries());

        mockMvc.perform(get("/api/ai/drift")
                .with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.alerts[0].examName").value("GLICOSE"))
            .andExpect(jsonPath("$.alerts[0].pattern").value("DRIFT_UP"));

        Mockito.verify(qcExamRepository).findByIsActiveTrue();
    }

    @Test
    @DisplayName("D11 — exige autenticação (401 sem usuário)")
    void driftRequiresAuth() throws Exception {
        mockMvc.perform(get("/api/ai/drift"))
            .andExpect(status().isUnauthorized());
    }

    @TestConfiguration
    static class TestBeans {

        @Bean
        QcRecordRepository qcRecordRepository() {
            return Mockito.mock(QcRecordRepository.class);
        }

        @Bean
        com.biodiagnostico.service.DashboardService dashboardService() {
            return new StubDashboardService();
        }

        @Bean
        com.biodiagnostico.service.AuditService auditService() {
            return new StubAuditService();
        }

        @Bean
        com.biodiagnostico.repository.ReagentLotRepository reagentLotRepository() {
            return Mockito.mock(com.biodiagnostico.repository.ReagentLotRepository.class);
        }

        @Bean
        com.biodiagnostico.repository.MaintenanceRecordRepository maintenanceRecordRepository() {
            return Mockito.mock(com.biodiagnostico.repository.MaintenanceRecordRepository.class);
        }

        @Bean
        com.biodiagnostico.repository.WestgardViolationRepository westgardViolationRepository() {
            return Mockito.mock(com.biodiagnostico.repository.WestgardViolationRepository.class);
        }

        @Bean
        com.biodiagnostico.repository.QcExamRepository qcExamRepository() {
            return Mockito.mock(com.biodiagnostico.repository.QcExamRepository.class);
        }

        @Bean
        com.biodiagnostico.service.DriftDetector driftDetector() {
            return new com.biodiagnostico.service.DriftDetector();
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

        @Override
        public String executiveSummary(String area, int days, String context) {
            return "Resumo executivo gerado.";
        }

        @Override
        public String summarizeAuditLogs(String context) {
            return "Resumo de auditoria gerado.";
        }

        @Override
        public String analyzeRootCause(
            QcRecord record, List<QcRecord> history, String reagentContext, String maintenanceContext
        ) {
            return "Analise de causa-raiz gerada.";
        }

        @Override
        public String prioritize(String area, List<String> itemLines) {
            if (itemLines == null || itemLines.isEmpty()) {
                return "";
            }
            return "Recomendacao priorizada.";
        }

        @Override
        public List<String> describeDrift(List<String> candidateLines) {
            if (candidateLines == null || candidateLines.isEmpty()) {
                return List.of();
            }
            return candidateLines.stream().map(line -> "Interpretacao de drift.").toList();
        }
    }

    /**
     * Stub manual de {@link com.biodiagnostico.service.DashboardService} (concreto).
     * Evita mock de classe concreta (incompatível com o JDK do CI) seguindo o
     * mesmo padrão de {@link StubAiService}: super(null,...) pois todos os métodos
     * usados pelo controlador são sobrescritos e devolvem dados vazios fixos.
     */
    static class StubDashboardService extends com.biodiagnostico.service.DashboardService {

        StubDashboardService() {
            super(null, null, null, null);
        }

        @Override
        public com.biodiagnostico.dto.response.DashboardKpiResponse getKpis(String area) {
            return new com.biodiagnostico.dto.response.DashboardKpiResponse(0, 0, 0.0, false, 0);
        }

        @Override
        public com.biodiagnostico.dto.response.DashboardAlertsResponse getAlerts() {
            return new com.biodiagnostico.dto.response.DashboardAlertsResponse(
                new com.biodiagnostico.dto.response.DashboardAlertsResponse.AlertSection<
                    com.biodiagnostico.dto.response.ReagentLotResponse>(0L, List.of()),
                new com.biodiagnostico.dto.response.DashboardAlertsResponse.AlertSection<
                    com.biodiagnostico.dto.response.MaintenanceResponse>(0L, List.of()),
                new com.biodiagnostico.dto.response.DashboardAlertsResponse.AlertSection<
                    com.biodiagnostico.dto.response.QcRecordResponse>(0L, List.of()));
        }

        @Override
        public List<com.biodiagnostico.dto.response.QcRecordResponse> getRecentRecords(int limit) {
            return List.of();
        }
    }

    /**
     * Stub manual de {@link com.biodiagnostico.service.AuditService} (concreto).
     * Mesmo motivo do {@link StubDashboardService}.
     */
    static class StubAuditService extends com.biodiagnostico.service.AuditService {

        StubAuditService() {
            super(null, null, null);
        }

        @Override
        public List<com.biodiagnostico.entity.AuditLog> getRecentLogs(int limit) {
            return List.of();
        }

        @Override
        public List<com.biodiagnostico.entity.AuditLog> getLogsByUser(java.util.UUID userId) {
            return List.of();
        }
    }
}

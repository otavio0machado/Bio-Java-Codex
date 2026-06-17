package com.biodiagnostico.controller;

import com.biodiagnostico.dto.request.AiAnalysisRequest;
import com.biodiagnostico.dto.request.BatchValidationRequest;
import com.biodiagnostico.dto.request.ExplainQcRequest;
import com.biodiagnostico.dto.request.InterpretTrendRequest;
import com.biodiagnostico.dto.request.RootCauseRequest;
import com.biodiagnostico.dto.request.SuggestObservationRequest;
import com.biodiagnostico.dto.request.VoiceFormRequest;
import com.biodiagnostico.dto.response.AiAnalysisResponse;
import com.biodiagnostico.dto.response.AuditSummaryResponse;
import com.biodiagnostico.dto.response.BatchValidationResponse;
import com.biodiagnostico.dto.response.BatchValidationResponse.BatchSuggestion;
import com.biodiagnostico.dto.response.DashboardAlertsResponse;
import com.biodiagnostico.dto.response.DashboardKpiResponse;
import com.biodiagnostico.dto.response.DriftResponse;
import com.biodiagnostico.dto.response.DriftResponse.DriftAlert;
import com.biodiagnostico.dto.response.ExecutiveSummaryResponse;
import com.biodiagnostico.dto.response.ExplainQcResponse;
import com.biodiagnostico.dto.response.InterpretTrendResponse;
import com.biodiagnostico.dto.response.MaintenanceResponse;
import com.biodiagnostico.dto.response.PrioritiesResponse;
import com.biodiagnostico.dto.response.PrioritiesResponse.PriorityItem;
import com.biodiagnostico.dto.response.QcRecordResponse;
import com.biodiagnostico.dto.response.ReagentLotResponse;
import com.biodiagnostico.dto.response.RootCauseResponse;
import com.biodiagnostico.dto.response.SuggestObservationResponse;
import com.biodiagnostico.entity.AuditLog;
import com.biodiagnostico.entity.MaintenanceRecord;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.entity.WestgardViolation;
import com.biodiagnostico.exception.ResourceNotFoundException;
import com.biodiagnostico.repository.MaintenanceRecordRepository;
import com.biodiagnostico.repository.QcExamRepository;
import com.biodiagnostico.repository.QcRecordRepository;
import com.biodiagnostico.repository.ReagentLotRepository;
import com.biodiagnostico.repository.WestgardViolationRepository;
import com.biodiagnostico.service.AiService;
import com.biodiagnostico.service.AuditService;
import com.biodiagnostico.service.DashboardService;
import com.biodiagnostico.service.DriftDetector;
import com.biodiagnostico.service.DriftDetector.DriftCandidate;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private static final int DEFAULT_TREND_DAYS = 30;
    private static final int EXPLAIN_HISTORY_SIZE = 15;
    private static final int TREND_MAX_POINTS = 500;

    // Onda 3 — limites e janelas determinísticos dos novos endpoints assistivos.
    private static final int SUMMARY_DEFAULT_DAYS = 7;
    private static final int SUMMARY_RECENT_RECORDS = 10;
    private static final int SUMMARY_MAX_VIOLATIONS = 30;
    private static final int AUDIT_DEFAULT_DAYS = 7;
    private static final int AUDIT_MAX_LOGS = 200;
    private static final int ROOT_CAUSE_HISTORY_SIZE = 15;
    private static final int PRIORITIES_EXPIRY_WINDOW_DAYS = 30;
    private static final int PRIORITIES_MAINTENANCE_WINDOW_DAYS = 30;
    private static final int PRIORITIES_QC_WINDOW_DAYS = 7;
    private static final int URGENCY_HIGH_DAYS = 7;

    // D11 — detecção proativa de drift (sob demanda, read-only).
    private static final int DRIFT_DEFAULT_DAYS = 14;
    private static final int DRIFT_MAX_POINTS = 60;
    private static final int DRIFT_MAX_ALERTS = 50;

    private static final String CATEGORY_REAGENT = "REAGENTE";
    private static final String CATEGORY_MAINTENANCE = "MANUTENCAO";
    private static final String CATEGORY_QC = "CQ";
    private static final String URGENCY_HIGH = "ALTA";
    private static final String URGENCY_MEDIUM = "MEDIA";
    private static final String URGENCY_LOW = "BAIXA";

    private final AiService aiService;
    private final QcRecordRepository qcRecordRepository;
    private final DashboardService dashboardService;
    private final AuditService auditService;
    private final ReagentLotRepository reagentLotRepository;
    private final MaintenanceRecordRepository maintenanceRecordRepository;
    private final WestgardViolationRepository westgardViolationRepository;
    private final QcExamRepository qcExamRepository;
    private final DriftDetector driftDetector;

    public AiController(
        AiService aiService,
        QcRecordRepository qcRecordRepository,
        DashboardService dashboardService,
        AuditService auditService,
        ReagentLotRepository reagentLotRepository,
        MaintenanceRecordRepository maintenanceRecordRepository,
        WestgardViolationRepository westgardViolationRepository,
        QcExamRepository qcExamRepository,
        DriftDetector driftDetector
    ) {
        this.aiService = aiService;
        this.qcRecordRepository = qcRecordRepository;
        this.dashboardService = dashboardService;
        this.auditService = auditService;
        this.reagentLotRepository = reagentLotRepository;
        this.maintenanceRecordRepository = maintenanceRecordRepository;
        this.westgardViolationRepository = westgardViolationRepository;
        this.qcExamRepository = qcExamRepository;
        this.driftDetector = driftDetector;
    }

    @PostMapping("/analyze")
    public ResponseEntity<AiAnalysisResponse> analyze(@Valid @RequestBody AiAnalysisRequest request) {
        String response;
        if (request.area() != null && !request.area().isBlank()) {
            int days = request.days() == null ? 30 : request.days();
            LocalDate startDate = LocalDate.now().minusDays(days);
            List<QcRecord> records = qcRecordRepository.findAllByOrderByDateDesc().stream()
                .filter(record -> request.area().equalsIgnoreCase(record.getArea()))
                .filter(record -> request.examName() == null || request.examName().isBlank()
                    || request.examName().equalsIgnoreCase(record.getExamName()))
                .filter(record -> !record.getDate().isBefore(startDate))
                .toList();
            response = aiService.analyze(request.prompt(), aiService.buildQcContext(records));
        } else {
            response = aiService.analyze(request.prompt(), request.context());
        }
        return ResponseEntity.ok(new AiAnalysisResponse(response));
    }

    @PostMapping("/voice-to-form")
    public ResponseEntity<Map<String, Object>> voiceToForm(@Valid @RequestBody VoiceFormRequest request) {
        return ResponseEntity.ok(
            aiService.processVoiceForm(request.audioBase64(), request.formType(), request.mimeType())
        );
    }

    /**
     * A1 — Explica o resultado/violação de um registro de CQ (assistivo, read-only).
     *
     * <p>{@code recordId} é o {@code UUID} (chave primária real de {@link QcRecord}).
     * O Jackson desserializa a string JSON do UUID automaticamente; UUID malformado
     * resulta em 400. Quando nenhum registro corresponde ao id, lança
     * {@link ResourceNotFoundException} (404).
     */
    @PostMapping("/qc/explain")
    public ResponseEntity<ExplainQcResponse> explainQc(@Valid @RequestBody ExplainQcRequest request) {
        QcRecord record = qcRecordRepository.findById(request.recordId())
            .orElseThrow(() -> new ResourceNotFoundException(
                "Registro de CQ não encontrado: " + request.recordId()));

        List<QcRecord> history = qcRecordRepository
            .findByExamNameAndLevelAndAreaOrderByDateDesc(
                record.getExamName(),
                record.getLevel(),
                record.getArea(),
                PageRequest.of(0, EXPLAIN_HISTORY_SIZE))
            .stream()
            .filter(item -> item.getId() == null || !item.getId().equals(record.getId()))
            .toList();

        String explanation = aiService.explainViolation(record, history);
        return ResponseEntity.ok(new ExplainQcResponse(explanation));
    }

    /**
     * A2 — Interpreta a tendência (Levey-Jennings) de exame+nível+área no período (assistivo, read-only).
     */
    @PostMapping("/qc/interpret-trend")
    public ResponseEntity<InterpretTrendResponse> interpretTrend(
        @Valid @RequestBody InterpretTrendRequest request
    ) {
        int days = request.days() == null ? DEFAULT_TREND_DAYS : request.days();
        LocalDate startDate = LocalDate.now().minusDays(days);

        Pageable pageable = PageRequest.of(0, TREND_MAX_POINTS);
        List<QcRecord> series = qcRecordRepository
            .findLeveyJenningsData(request.examName(), request.level(), request.area(), pageable)
            .stream()
            .filter(record -> record.getDate() != null && !record.getDate().isBefore(startDate))
            .toList();

        String interpretation = aiService.interpretTrend(
            request.examName(), request.level(), request.area(), series);
        return ResponseEntity.ok(new InterpretTrendResponse(interpretation));
    }

    /**
     * C8 — Sugere observação/justificativa padronizada (assistivo, read-only).
     * {@code kind} inválido propaga BusinessException (mapeada para 400).
     */
    @PostMapping("/suggest-observation")
    public ResponseEntity<SuggestObservationResponse> suggestObservation(
        @Valid @RequestBody SuggestObservationRequest request
    ) {
        String suggestion = aiService.suggestObservation(request.kind(), request.context());
        return ResponseEntity.ok(new SuggestObservationResponse(suggestion));
    }

    /**
     * B5 — Validação inteligente (assistiva, read-only) de um lote de importação
     * de CQ ANTES de importar.
     *
     * <p>NÃO importa, NÃO grava e NÃO decide aprovar/reprovar: apenas analisa as
     * linhas enviadas e devolve sugestões para revisão humana. A validação
     * estrutural é determinística; apenas nomes de exame não reconhecidos passam
     * pela IA (sugestão de typo a partir da lista da área), com degradação
     * graciosa quando a IA falha.
     */
    @PostMapping("/validate-batch")
    public ResponseEntity<BatchValidationResponse> validateBatch(
        @Valid @RequestBody BatchValidationRequest request
    ) {
        AiService.BatchValidationResult result = aiService.validateBatch(request.area(), request.rows());
        List<BatchSuggestion> suggestions = result.suggestions().stream()
            .map(item -> new BatchSuggestion(
                item.row(), item.field(), item.issue(), item.suggestion(), item.confidence()))
            .toList();
        return ResponseEntity.ok(new BatchValidationResponse(suggestions, result.readinessScore()));
    }

    /**
     * C9 — Resumo executivo do dashboard (assistivo, read-only).
     *
     * <p>Monta o contexto factual a partir do {@link DashboardService} (KPIs,
     * alertas e registros recentes) e das violações de Westgard do período, e
     * delega a narrativa à IA. NÃO grava nem decide. {@code days} default 7.
     */
    @GetMapping("/dashboard/summary")
    public ResponseEntity<ExecutiveSummaryResponse> dashboardSummary(
        @RequestParam(required = false) String area,
        @RequestParam(required = false) Integer days
    ) {
        int window = days == null ? SUMMARY_DEFAULT_DAYS : days;
        String context = buildDashboardContext(area, window);
        String summary = aiService.executiveSummary(area, window, context);
        return ResponseEntity.ok(new ExecutiveSummaryResponse(summary));
    }

    /**
     * C10 — Sumarização de audit logs (assistiva, read-only).
     *
     * <p>AUTORIZAÇÃO: restrita a ADMIN (mesma proteção dos endpoints de
     * auditoria/admin atuais). Carrega os logs mais recentes do período (ou de um
     * usuário), monta o contexto e delega o resumo à IA. {@code days} default 7.
     */
    @GetMapping("/audit/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AuditSummaryResponse> auditSummary(
        @RequestParam(required = false) Integer days,
        @RequestParam(required = false) java.util.UUID userId
    ) {
        int window = days == null ? AUDIT_DEFAULT_DAYS : days;
        String context = buildAuditContext(window, userId);
        String summary = aiService.summarizeAuditLogs(context);
        return ResponseEntity.ok(new AuditSummaryResponse(summary));
    }

    /**
     * A3 — Análise de causa-raiz correlacionada (assistiva, read-only). Tier ADVANCED.
     *
     * <p>Busca o {@link QcRecord} (404 se inexistente) + histórico recente do
     * mesmo exame+nível+área + correlações determinísticas (lotes de reagente
     * ativos na área na data; manutenção/calibração mais recente do equipamento)
     * e delega as hipóteses à IA. Recomendação, não decisão.
     */
    @PostMapping("/qc/root-cause")
    public ResponseEntity<RootCauseResponse> rootCause(@Valid @RequestBody RootCauseRequest request) {
        QcRecord record = qcRecordRepository.findById(request.recordId())
            .orElseThrow(() -> new ResourceNotFoundException(
                "Registro de CQ não encontrado: " + request.recordId()));

        List<QcRecord> history = qcRecordRepository
            .findByExamNameAndLevelAndAreaOrderByDateDesc(
                record.getExamName(),
                record.getLevel(),
                record.getArea(),
                PageRequest.of(0, ROOT_CAUSE_HISTORY_SIZE))
            .stream()
            .filter(item -> item.getId() == null || !item.getId().equals(record.getId()))
            .toList();

        String reagentContext = buildReagentCorrelationContext(record);
        String maintenanceContext = buildMaintenanceCorrelationContext(record);

        String analysis = aiService.analyzeRootCause(record, history, reagentContext, maintenanceContext);
        return ResponseEntity.ok(new RootCauseResponse(analysis));
    }

    /**
     * D12 — Priorização inteligente (assistiva, read-only).
     *
     * <p>Coleta DETERMINISTICAMENTE os itens candidatos (reagentes vencendo/
     * vencidos, manutenções vencidas/próximas, exames com violações de Westgard
     * recentes), ranqueia por urgência (heurística) e pede à IA apenas a
     * recomendação textual. A lista {@code items} é determinística; se a IA
     * falhar, {@code recommendation} vem vazia (degradação graciosa).
     */
    @GetMapping("/priorities")
    public ResponseEntity<PrioritiesResponse> priorities(@RequestParam(required = false) String area) {
        List<PriorityItem> items = collectPriorityItems(area);
        List<String> itemLines = items.stream()
            .map(item -> item.category() + " | " + item.urgency() + " | " + item.title()
                + " — " + item.detail())
            .toList();
        String recommendation = aiService.prioritize(area, itemLines);
        return ResponseEntity.ok(new PrioritiesResponse(items, recommendation));
    }

    /**
     * D11 — Detecção proativa de drift, SOB DEMANDA (assistiva, read-only).
     *
     * <p>A DETECÇÃO é DETERMINÍSTICA (estatística pura, no {@link DriftDetector}):
     * para cada exame+nível ativo (na {@code area} informada, ou em todas se
     * vazia), carrega a série recente (últimos {@code days} dias, default 14,
     * limite de pontos) e procura séries que AINDA NÃO violaram rejeição mas
     * exibem tendência (sequência longa do mesmo lado e/ou inclinação
     * significativa). Séries com violação de rejeição recente são EXCLUÍDAS
     * (tratadas pelo CQ/D12). NÃO reimplementa Westgard nem recalcula status.
     *
     * <p>Só quando há candidatos a IA é chamada — apenas para INTERPRETAR cada
     * candidato; ela não adiciona candidatos nem inventa números. Se a IA falhar,
     * os alertas são retornados com {@code detail} vazio (degradação graciosa).
     * Lista vazia quando não há candidatos (a IA nem é chamada).
     */
    @GetMapping("/drift")
    public ResponseEntity<DriftResponse> drift(
        @RequestParam(required = false) String area,
        @RequestParam(required = false) Integer days
    ) {
        int window = days == null ? DRIFT_DEFAULT_DAYS : days;
        List<DriftCandidate> candidates = collectDriftCandidates(area, window);
        if (candidates.isEmpty()) {
            return ResponseEntity.ok(new DriftResponse(List.of()));
        }

        List<String> candidateLines = candidates.stream()
            .map(this::driftCandidateLine)
            .toList();
        List<String> details = aiService.describeDrift(candidateLines);

        List<DriftAlert> alerts = new ArrayList<>(candidates.size());
        for (int index = 0; index < candidates.size(); index++) {
            DriftCandidate candidate = candidates.get(index);
            String detail = index < details.size() && details.get(index) != null
                ? details.get(index) : "";
            alerts.add(new DriftAlert(
                candidate.examName(), candidate.level(),
                candidate.pattern(), candidate.severity(), detail));
        }
        return ResponseEntity.ok(new DriftResponse(alerts));
    }

    // ----------------------------------------------------------------------
    // Montagem determinística de contexto (read-only) para os endpoints Onda 3.
    // ----------------------------------------------------------------------

    private String buildDashboardContext(String area, int days) {
        LocalDate today = LocalDate.now();
        LocalDate start = today.minusDays(days);

        DashboardKpiResponse kpi = dashboardService.getKpis(area);
        DashboardAlertsResponse alerts = dashboardService.getAlerts();
        List<QcRecordResponse> recent = dashboardService.getRecentRecords(SUMMARY_RECENT_RECORDS);

        StringBuilder sb = new StringBuilder("Indicadores do dashboard (Laboratório Biodiagnóstico):\n");
        sb.append(String.format(Locale.ROOT,
            "- Taxa de aprovação do mês: %.2f%%%n", kpi.approvalRate()));
        sb.append("- Controles registrados hoje: ").append(kpi.totalToday()).append('\n');
        sb.append("- Controles registrados no mês: ").append(kpi.totalMonth()).append('\n');
        sb.append("- Total de alertas ativos: ").append(kpi.alertsCount()).append('\n');

        sb.append("\nAlertas — reagentes vencendo (próximos 30 dias): ")
            .append(alerts.expiringReagents().count()).append('\n');
        for (ReagentLotResponse lot : alerts.expiringReagents().items()) {
            sb.append("  - ").append(safe(lot.label()))
                .append(" (lote ").append(safe(lot.lotNumber())).append(")")
                .append(" vence em ").append(lot.expiryDate())
                .append(" (").append(lot.daysLeft()).append(" dia(s))\n");
        }

        sb.append("Alertas — manutenções pendentes: ")
            .append(alerts.pendingMaintenances().count()).append('\n');
        for (MaintenanceResponse maintenance : alerts.pendingMaintenances().items()) {
            sb.append("  - ").append(safe(maintenance.equipment()))
                .append(" (").append(safe(maintenance.type())).append(")")
                .append(" prevista para ").append(maintenance.nextDate()).append('\n');
        }

        sb.append("Alertas — registros reprovados no mês (violações de Westgard): ")
            .append(alerts.westgardViolations().count()).append('\n');

        List<WestgardViolation> periodViolations = westgardViolationRepository.findByAreaAndPeriod(
            normalizeArea(area), start, today);
        sb.append("\nViolações de Westgard no período (últimos ").append(days).append(" dia(s)): ")
            .append(periodViolations.size()).append('\n');
        periodViolations.stream().limit(SUMMARY_MAX_VIOLATIONS).forEach(violation -> {
            QcRecord qc = violation.getQcRecord();
            sb.append("  - ").append(violation.getRule())
                .append(" [").append(safe(violation.getSeverity())).append("]");
            if (qc != null) {
                sb.append(" em ").append(safe(qc.getExamName()))
                    .append(" nível ").append(safe(qc.getLevel()))
                    .append(" (").append(qc.getDate()).append(")");
            }
            sb.append('\n');
        });

        sb.append("\nRegistros de CQ mais recentes (até ").append(SUMMARY_RECENT_RECORDS).append("):\n");
        for (QcRecordResponse qc : recent) {
            sb.append("  - ").append(qc.date())
                .append(" | ").append(safe(qc.examName()))
                .append(" | nível ").append(safe(qc.level()))
                .append(" | status ").append(safe(qc.status())).append('\n');
        }
        return sb.toString();
    }

    private String buildAuditContext(int days, java.util.UUID userId) {
        LocalDate startDate = LocalDate.now().minusDays(days);

        List<AuditLog> logs = userId != null
            ? auditService.getLogsByUser(userId)
            : auditService.getRecentLogs(AUDIT_MAX_LOGS);

        List<AuditLog> windowLogs = logs.stream()
            .filter(log -> log.getCreatedAt() != null
                && !log.getCreatedAt().isBefore(startDate.atStartOfDay(java.time.ZoneOffset.UTC).toInstant()))
            .limit(AUDIT_MAX_LOGS)
            .toList();

        StringBuilder sb = new StringBuilder("Registros de auditoria (audit log) do laboratório.\n");
        sb.append("Janela: últimos ").append(days).append(" dia(s).");
        if (userId != null) {
            sb.append(" Filtrado pelo usuário: ").append(userId).append(".");
        }
        sb.append("\nTotal de registros no contexto: ").append(windowLogs.size()).append("\n\n");

        for (AuditLog log : windowLogs) {
            String user = log.getUser() != null ? log.getUser().getUsername() : "desconhecido";
            sb.append("- ").append(log.getCreatedAt())
                .append(" | usuário=").append(safe(user))
                .append(" | ação=").append(safe(log.getAction()))
                .append(" | entidade=").append(safe(log.getEntityType()));
            if (log.getEntityId() != null) {
                sb.append(" (id=").append(log.getEntityId()).append(")");
            }
            sb.append('\n');
        }
        return sb.toString();
    }

    private String buildReagentCorrelationContext(QcRecord record) {
        LocalDate referenceDate = record.getDate() == null ? LocalDate.now() : record.getDate();
        // Lotes ativos na área na data do registro: vigentes (validade >= data) e ainda não terminais.
        List<ReagentLot> active = reagentLotRepository.findAllByOrderByCreatedAtDesc().stream()
            .filter(lot -> lot.getExpiryDate() != null && !lot.getExpiryDate().isBefore(referenceDate))
            .filter(lot -> lot.getStatus() == null
                || (!"vencido".equals(lot.getStatus()) && !"inativo".equals(lot.getStatus())))
            .limit(20)
            .toList();

        if (active.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (ReagentLot lot : active) {
            sb.append("  - ").append(safe(lot.getName()))
                .append(" (lote ").append(safe(lot.getLotNumber())).append(")")
                .append(", fabricante ").append(safe(lot.getManufacturer()))
                .append(", validade ").append(lot.getExpiryDate())
                .append(", status ").append(safe(lot.getStatus())).append('\n');
        }
        return sb.toString();
    }

    private String buildMaintenanceCorrelationContext(QcRecord record) {
        String equipment = record.getEquipment();
        if (equipment == null || equipment.isBlank()) {
            return "";
        }
        MaintenanceRecord latest = maintenanceRecordRepository.findByEquipment(equipment).stream()
            .filter(maintenance -> maintenance.getDate() != null)
            .max(Comparator.comparing(MaintenanceRecord::getDate))
            .orElse(null);
        if (latest == null) {
            return "";
        }
        return "  - Equipamento " + safe(latest.getEquipment())
            + ": " + safe(latest.getType())
            + " em " + latest.getDate()
            + (latest.getNextDate() != null ? " (próxima prevista: " + latest.getNextDate() + ")" : "")
            + (latest.getNotes() != null && !latest.getNotes().isBlank()
                ? " — " + latest.getNotes() : "")
            + "\n";
    }

    private List<PriorityItem> collectPriorityItems(String area) {
        LocalDate today = LocalDate.now();
        List<PriorityItem> items = new ArrayList<>();

        // Reagentes vencidos com estoque: urgência ALTA.
        for (ReagentLot lot : reagentLotRepository.findExpiredWithStock()) {
            items.add(new PriorityItem(
                CATEGORY_REAGENT,
                safe(lot.getName()) + " (lote " + safe(lot.getLotNumber()) + ")",
                URGENCY_HIGH,
                "Lote vencido com estoque (validade " + lot.getExpiryDate() + ")."));
        }
        // Reagentes vencendo nos próximos 30 dias: ALTA (<=7 dias) ou MEDIA.
        for (ReagentLot lot : reagentLotRepository.findExpiringLots(
                today, today.plusDays(PRIORITIES_EXPIRY_WINDOW_DAYS))) {
            long daysLeft = lot.getExpiryDate() == null
                ? Long.MAX_VALUE : ChronoUnit.DAYS.between(today, lot.getExpiryDate());
            String urgency = daysLeft <= URGENCY_HIGH_DAYS ? URGENCY_HIGH : URGENCY_MEDIUM;
            items.add(new PriorityItem(
                CATEGORY_REAGENT,
                safe(lot.getName()) + " (lote " + safe(lot.getLotNumber()) + ")",
                urgency,
                "Vence em " + daysLeft + " dia(s) (" + lot.getExpiryDate() + ")."));
        }

        // Manutenções atrasadas: ALTA.
        for (MaintenanceRecord maintenance : maintenanceRecordRepository.findOverdue(today)) {
            items.add(new PriorityItem(
                CATEGORY_MAINTENANCE,
                safe(maintenance.getEquipment()) + " (" + safe(maintenance.getType()) + ")",
                URGENCY_HIGH,
                "Manutenção atrasada (prevista para " + maintenance.getNextDate() + ")."));
        }
        // Manutenções próximas (próximos 30 dias): MEDIA.
        for (MaintenanceRecord maintenance : maintenanceRecordRepository.findUpcoming(
                today, today.plusDays(PRIORITIES_MAINTENANCE_WINDOW_DAYS))) {
            items.add(new PriorityItem(
                CATEGORY_MAINTENANCE,
                safe(maintenance.getEquipment()) + " (" + safe(maintenance.getType()) + ")",
                URGENCY_MEDIUM,
                "Manutenção prevista para " + maintenance.getNextDate() + "."));
        }

        // Exames com violações de Westgard recentes: ALTA (REJECTION) ou MEDIA.
        List<WestgardViolation> recentViolations = westgardViolationRepository.findByAreaAndPeriod(
            normalizeArea(area), today.minusDays(PRIORITIES_QC_WINDOW_DAYS), today);
        for (WestgardViolation violation : recentViolations) {
            QcRecord qc = violation.getQcRecord();
            String exam = qc != null ? safe(qc.getExamName()) : "(exame desconhecido)";
            String level = qc != null ? safe(qc.getLevel()) : "";
            boolean rejection = "REJECTION".equalsIgnoreCase(violation.getSeverity());
            items.add(new PriorityItem(
                CATEGORY_QC,
                exam + (level.isBlank() ? "" : " nível " + level),
                rejection ? URGENCY_HIGH : URGENCY_MEDIUM,
                "Violação " + safe(violation.getRule())
                    + (qc != null && qc.getDate() != null ? " em " + qc.getDate() : "") + "."));
        }

        // Ordena por urgência (ALTA > MEDIA > BAIXA); estável dentro de cada categoria.
        items.sort(Comparator.comparingInt(item -> urgencyRank(item.urgency())));
        return items;
    }

    private int urgencyRank(String urgency) {
        if (URGENCY_HIGH.equals(urgency)) {
            return 0;
        }
        if (URGENCY_MEDIUM.equals(urgency)) {
            return 1;
        }
        return 2;
    }

    /**
     * Coleta DETERMINISTICAMENTE (read-only) os candidatos a drift. Para cada
     * exame ativo (na área, ou em todas se vazia), carrega a série recente da
     * janela, agrupa por nível e delega ao {@link DriftDetector}. A IA NÃO é
     * tocada aqui — a detecção é estatística pura. Limita o número de alertas
     * para proteger o payload.
     */
    private List<DriftCandidate> collectDriftCandidates(String area, int days) {
        LocalDate startDate = LocalDate.now().minusDays(days);
        boolean allAreas = area == null || area.isBlank();

        List<com.biodiagnostico.entity.QcExam> exams = allAreas
            ? qcExamRepository.findByIsActiveTrue()
            : qcExamRepository.findByAreaAndIsActiveTrue(area.toLowerCase(Locale.ROOT));

        List<DriftCandidate> candidates = new ArrayList<>();
        for (com.biodiagnostico.entity.QcExam exam : exams) {
            String examName = exam.getName();
            String examArea = exam.getArea();
            if (examName == null || examName.isBlank()) {
                continue;
            }

            // Série recente do exame na área, mais recente primeiro; janela aplicada em memória.
            List<QcRecord> records = qcRecordRepository
                .findByExamNameAndAreaOrderByDateDesc(examName, examArea).stream()
                .filter(record -> record.getDate() != null && !record.getDate().isBefore(startDate))
                .limit(DRIFT_MAX_POINTS)
                .toList();
            if (records.isEmpty()) {
                continue;
            }

            // Agrupa por nível preservando a ordem (mais recente primeiro) dentro de cada nível.
            Map<String, List<QcRecord>> byLevel = new LinkedHashMap<>();
            for (QcRecord record : records) {
                String level = record.getLevel() == null ? "" : record.getLevel();
                byLevel.computeIfAbsent(level, ignored -> new ArrayList<>()).add(record);
            }

            for (Map.Entry<String, List<QcRecord>> entry : byLevel.entrySet()) {
                driftDetector.detect(examName, entry.getKey(), examArea, entry.getValue())
                    .ifPresent(candidates::add);
                if (candidates.size() >= DRIFT_MAX_ALERTS) {
                    return candidates;
                }
            }
        }
        return candidates;
    }

    /**
     * Linha textual factual de um candidato para o contexto da IA. Os números já
     * foram calculados deterministicamente; a IA apenas os descreve (não estima).
     */
    private String driftCandidateLine(DriftCandidate candidate) {
        return "Exame: " + safe(candidate.examName())
            + " | Nível: " + safe(candidate.level())
            + " | Área: " + safe(candidate.area())
            + " | Padrão: " + candidate.pattern()
            + " | Severidade: " + candidate.severity()
            + " | Pontos na série: " + candidate.points()
            + " | Sequência recente do mesmo lado: " + candidate.recentSameSideRun()
            + String.format(Locale.ROOT,
                " | Inclinação (Z por ponto): %.3f | Z-score do ponto mais recente: %.2f",
                candidate.slopePerPoint(), candidate.lastZScore());
    }

    /** Normaliza a área para as queries que esperam lowercase (ou null = todas). */
    private String normalizeArea(String area) {
        return (area == null || area.isBlank()) ? null : area.toLowerCase(Locale.ROOT);
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}

package com.biodiagnostico.controller;

import com.biodiagnostico.dto.request.AiAnalysisRequest;
import com.biodiagnostico.dto.request.BatchValidationRequest;
import com.biodiagnostico.dto.request.ExplainQcRequest;
import com.biodiagnostico.dto.request.InterpretTrendRequest;
import com.biodiagnostico.dto.request.SuggestObservationRequest;
import com.biodiagnostico.dto.request.VoiceFormRequest;
import com.biodiagnostico.dto.response.AiAnalysisResponse;
import com.biodiagnostico.dto.response.BatchValidationResponse;
import com.biodiagnostico.dto.response.BatchValidationResponse.BatchSuggestion;
import com.biodiagnostico.dto.response.ExplainQcResponse;
import com.biodiagnostico.dto.response.InterpretTrendResponse;
import com.biodiagnostico.dto.response.SuggestObservationResponse;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.exception.ResourceNotFoundException;
import com.biodiagnostico.repository.QcRecordRepository;
import com.biodiagnostico.service.AiService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private static final int DEFAULT_TREND_DAYS = 30;
    private static final int EXPLAIN_HISTORY_SIZE = 15;
    private static final int TREND_MAX_POINTS = 500;

    private final AiService aiService;
    private final QcRecordRepository qcRecordRepository;

    public AiController(AiService aiService, QcRecordRepository qcRecordRepository) {
        this.aiService = aiService;
        this.qcRecordRepository = qcRecordRepository;
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
}

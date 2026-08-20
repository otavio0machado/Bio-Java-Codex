package com.biodiagnostico.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.biodiagnostico.config.AiProperties;
import com.biodiagnostico.dto.request.BatchValidationRequest.BatchRowDto;
import com.biodiagnostico.entity.QcExam;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.WestgardViolation;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.exception.RateLimitException;
import com.biodiagnostico.repository.QcExamRepository;
import com.biodiagnostico.service.AiService.BatchSuggestionResult;
import com.biodiagnostico.service.AiService.BatchValidationResult;
import com.biodiagnostico.service.ai.AiMessage;
import com.biodiagnostico.service.ai.AiModelRouter;
import com.biodiagnostico.service.ai.AiProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * Testa os metodos assistivos de IA (A1/A2/C8) e voice-form do {@link AiService}.
 *
 * <p>O provedor de IA e simulado por um stub de {@link AiProvider} — nenhuma
 * chamada HTTP real e feita. O {@link AiModelRouter} e real, alimentado por um
 * {@link AiProperties} com os defaults de codigo, validando indiretamente o
 * roteamento tarefa-&gt;tier-&gt;modelo.
 */
class AiServiceTest {

    /** Stub de AiProvider configuravel: captura as mensagens e o modelo, devolve texto fixo ou erro. */
    private static final class StubProvider implements AiProvider {

        private final String textToReturn;
        private final RuntimeException errorToThrow;
        final AtomicInteger textCalls = new AtomicInteger();
        final AtomicInteger audioCalls = new AtomicInteger();
        final AtomicReference<List<AiMessage>> lastMessages = new AtomicReference<>();
        final AtomicReference<String> lastTextModel = new AtomicReference<>();
        final List<String> audioModels = new ArrayList<>();
        final List<String> audioFormats = new ArrayList<>();
        // Para voice-form: respostas em sequencia (uma por tentativa).
        private final List<String> audioResponses = new ArrayList<>();

        private StubProvider(String textToReturn, RuntimeException errorToThrow) {
            this.textToReturn = textToReturn;
            this.errorToThrow = errorToThrow;
        }

        static StubProvider returningText(String text) {
            return new StubProvider(text, null);
        }

        static StubProvider throwing(RuntimeException error) {
            return new StubProvider(null, error);
        }

        StubProvider withAudioResponses(String... responses) {
            this.audioResponses.addAll(List.of(responses));
            return this;
        }

        @Override
        public String completeText(String model, List<AiMessage> messages, boolean jsonOutput) {
            textCalls.incrementAndGet();
            lastTextModel.set(model);
            lastMessages.set(messages);
            if (errorToThrow != null) {
                throw errorToThrow;
            }
            return textToReturn;
        }

        @Override
        public String completeAudio(String model, String prompt, String audioBase64, String audioFormat) {
            int idx = audioCalls.getAndIncrement();
            audioModels.add(model);
            audioFormats.add(audioFormat);
            if (errorToThrow != null) {
                throw errorToThrow;
            }
            if (!audioResponses.isEmpty()) {
                return audioResponses.get(Math.min(idx, audioResponses.size() - 1));
            }
            return textToReturn;
        }
    }

    private AiService buildService(AiProvider provider) {
        return buildService(provider, null);
    }

    private AiService buildService(AiProvider provider, QcExamRepository examRepository) {
        AiProperties properties = new AiProperties();
        AiModelRouter router = new AiModelRouter(properties);
        return new AiService(
            provider, router, new ObjectMapper(), properties, new SimpleMeterRegistry(), examRepository);
    }

    /** Mock de QcExamRepository devolvendo os exames ativos informados para a área. */
    private QcExamRepository examRepositoryWith(String area, String... examNames) {
        QcExamRepository repository = Mockito.mock(QcExamRepository.class);
        List<QcExam> exams = new ArrayList<>();
        for (String name : examNames) {
            exams.add(QcExam.builder().name(name).area(area).isActive(true).build());
        }
        Mockito.when(repository.findByAreaAndIsActiveTrue(area)).thenReturn(exams);
        return repository;
    }

    private BatchRowDto goodRow() {
        return new BatchRowDto("GLICOSE", "N1", 100.0, 100.0, 2.0, 5.0);
    }

    private QcRecord record(String status, String rule) {
        QcRecord record = QcRecord.builder()
            .id(UUID.randomUUID())
            .examName("GLICOSE")
            .area("bioquimica")
            .level("N1")
            .date(LocalDate.now())
            .value(105.0)
            .targetValue(100.0)
            .targetSd(2.0)
            .cv(2.0)
            .status(status)
            .build();
        if (rule != null) {
            WestgardViolation violation = WestgardViolation.builder()
                .rule(rule)
                .description("Violação " + rule)
                .severity("REJECT")
                .build();
            record.getViolations().add(violation);
        }
        return record;
    }

    /**
     * Onda 4 / Fase A: produz um contexto de CQ textual representativo (como o
     * {@link com.biodiagnostico.service.ai.AiContextAssembler} montaria, com as
     * violacoes ja materializadas), para alimentar os metodos do AiService que
     * passaram a receber o contexto JA MONTADO (String). O conteudo exato nao e
     * relevante para as assercoes (que checam constantes de prompt); espelha o
     * formato real por fidelidade.
     */
    private String qcContextFor(QcRecord... records) {
        StringBuilder context = new StringBuilder(
            "Dados de Controle de Qualidade do Laboratório Biodiagnóstico:\n\n");
        for (QcRecord record : records) {
            context.append(String.format(
                "Data: %s | Exame: %s | Nível: %s | Valor: %.2f | Alvo: %.2f | SD: %.2f | CV: %.2f%% | Status: %s%n",
                record.getDate(), record.getExamName(), record.getLevel(),
                record.getValue(), record.getTargetValue(), record.getTargetSd(),
                record.getCv(), record.getStatus()));
            if (record.getViolations() != null) {
                record.getViolations().forEach(violation -> context
                    .append("  -> Violação: ").append(violation.getRule())
                    .append(" - ").append(violation.getDescription()).append('\n'));
            }
        }
        return context.toString();
    }

    private String promptText(StubProvider provider) {
        StringBuilder sb = new StringBuilder();
        for (AiMessage message : provider.lastMessages.get()) {
            sb.append(message.role()).append(": ").append(message.content()).append('\n');
        }
        return sb.toString();
    }

    // ---------- A1 explainViolation ----------
    //
    // Onda 4 / Fase A: explainViolation passou a receber o contexto JA MONTADO
    // (String) pelo AiContextAssembler — a materializacao das violacoes (lazy)
    // acontece no assembler, dentro de transacao. Aqui o contexto e um texto
    // representativo; o conteudo so importa nos testes de blindagem de prompt.

    @Test
    @DisplayName("A1 — explainViolation retorna o texto da IA no caminho feliz")
    void explainViolationHappyPath() {
        AiService service = buildService(StubProvider.returningText("Explicacao clara da violacao 1-3s."));
        String result = service.explainViolation(qcContextFor(record("REPROVADO", "1-3s")));
        assertThat(result).isEqualTo("Explicacao clara da violacao 1-3s.");
    }

    @Test
    @DisplayName("A1 — explainViolation aceita contexto sem histórico")
    void explainViolationEmptyHistory() {
        AiService service = buildService(StubProvider.returningText("Explicacao sem historico."));
        String result = service.explainViolation(qcContextFor(record("REPROVADO", "1-3s")));
        assertThat(result).isEqualTo("Explicacao sem historico.");
    }

    @Test
    @DisplayName("A1 — explainViolation aceita contexto nulo (degrada para texto da IA)")
    void explainViolationNullHistory() {
        AiService service = buildService(StubProvider.returningText("Explicacao sem historico nulo."));
        String result = service.explainViolation(null);
        assertThat(result).isEqualTo("Explicacao sem historico nulo.");
    }

    @Test
    @DisplayName("A1 — explainViolation retorna mensagem amigável quando a IA falha (IO/Runtime)")
    void explainViolationFriendlyErrorOnFailure() {
        AiService service = buildService(StubProvider.throwing(new RuntimeException("provider down")));
        String result = service.explainViolation(qcContextFor(record("REPROVADO", "1-3s")));
        assertThat(result).isEqualTo("Não foi possível analisar no momento. Tente novamente.");
    }

    @Test
    @DisplayName("A1 — explainViolation roteia para o modelo medium")
    void explainViolationRoutesToMedium() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);
        service.explainViolation(qcContextFor(record("REPROVADO", "1-3s")));
        assertThat(provider.lastTextModel.get()).isEqualTo("gpt-5.4");
    }

    // ---------- A2 interpretTrend ----------

    @Test
    @DisplayName("A2 — interpretTrend retorna o texto da IA para contexto não vazio")
    void interpretTrendHappyPath() {
        AiService service = buildService(StubProvider.returningText("Tendencia estavel, sem deriva relevante."));
        String result = service.interpretTrend(
            "GLICOSE", "N1", "bioquimica",
            qcContextFor(record("APROVADO", null), record("APROVADO", null)));
        assertThat(result).isEqualTo("Tendencia estavel, sem deriva relevante.");
    }

    @Test
    @DisplayName("A2 — interpretTrend devolve texto de 'sem dados' e NÃO chama a IA quando o contexto é vazio")
    void interpretTrendEmptySeriesShortCircuits() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider);
        String result = service.interpretTrend("GLICOSE", "N1", "bioquimica", "");
        assertThat(result).isEqualTo("Sem dados suficientes no período para interpretar tendência.");
        assertThat(provider.textCalls.get()).isZero();
    }

    @Test
    @DisplayName("A2 — interpretTrend trata contexto nulo como sem dados, sem chamar a IA")
    void interpretTrendNullSeriesShortCircuits() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider);
        String result = service.interpretTrend("GLICOSE", "N1", "bioquimica", (String) null);
        assertThat(result).isEqualTo("Sem dados suficientes no período para interpretar tendência.");
        assertThat(provider.textCalls.get()).isZero();
    }

    // ---------- C8 suggestObservation ----------

    @Test
    @DisplayName("C8 — suggestObservation retorna o texto da IA para kind válido")
    void suggestObservationHappyPath() {
        AiService service = buildService(
            StubProvider.returningText("Calibracao realizada; controle conforme apos ajuste."));
        String result = service.suggestObservation("post-calibration", "Troca de lâmpada do AU680");
        assertThat(result).isEqualTo("Calibracao realizada; controle conforme apos ajuste.");
    }

    @Test
    @DisplayName("C8 — suggestObservation aceita todos os kinds válidos")
    void suggestObservationAllValidKinds() {
        for (String kind : List.of("post-calibration", "maintenance", "reagent", "qc")) {
            AiService service = buildService(StubProvider.returningText("ok"));
            assertThat(service.suggestObservation(kind, "contexto")).isEqualTo("ok");
        }
    }

    @Test
    @DisplayName("C8 — suggestObservation lança BusinessException para kind inválido e não chama a IA")
    void suggestObservationInvalidKind() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider);
        assertThatThrownBy(() -> service.suggestObservation("invalid-kind", "contexto qualquer"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Tipo de observação inválido");
        assertThat(provider.textCalls.get()).isZero();
    }

    @Test
    @DisplayName("C8 — suggestObservation roteia para o modelo basic")
    void suggestObservationRoutesToBasic() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);
        service.suggestObservation("qc", "contexto");
        assertThat(provider.lastTextModel.get()).isEqualTo("gpt-5.4-mini");
    }

    // ---------- Voice-form ----------

    @Test
    @DisplayName("Voice — processVoiceForm parseia o JSON da IA no caminho feliz")
    void voiceFormHappyPath() {
        StubProvider provider = StubProvider.returningText(null)
            .withAudioResponses("{\"equipment\":\"AU680\",\"type\":\"Calibração\"}");
        AiService service = buildService(provider);
        var result = service.processVoiceForm(validAudioBase64(), "manutencao", "audio/wav");
        assertThat(result).containsEntry("equipment", "AU680").containsEntry("type", "Calibração");
        assertThat(provider.audioCalls.get()).isEqualTo(1);
        assertThat(provider.audioModels.get(0)).isEqualTo("gpt-audio-1.5");
    }

    @Test
    @DisplayName("Voice — formato é derivado do mimeType (audio/wav -> wav)")
    void voiceFormDerivesFormatFromMime() {
        StubProvider provider = StubProvider.returningText(null)
            .withAudioResponses("{\"equipment\":\"x\"}");
        AiService service = buildService(provider);
        service.processVoiceForm(validAudioBase64(), "manutencao", "audio/wav");
        assertThat(provider.audioFormats.get(0)).isEqualTo("wav");
    }

    @Test
    @DisplayName("Voice — JSON inválido na 1ª tentativa escala e usa a 2ª resposta válida")
    void voiceFormEscalatesOnInvalidJson() {
        StubProvider provider = StubProvider.returningText(null)
            .withAudioResponses("isto nao e json", "{\"equipment\":\"AU680\"}");
        AiService service = buildService(provider);
        var result = service.processVoiceForm(validAudioBase64(), "manutencao", "audio/wav");
        assertThat(result).containsEntry("equipment", "AU680");
        assertThat(provider.audioCalls.get()).as("deve ter feito 1 tentativa + 1 escalonamento").isEqualTo(2);
    }

    @Test
    @DisplayName("Voice — JSON inválido nas duas tentativas lança BusinessException com a mensagem legada")
    void voiceFormFailsAfterEscalation() {
        StubProvider provider = StubProvider.returningText(null)
            .withAudioResponses("nao e json", "ainda nao e json");
        AiService service = buildService(provider);
        assertThatThrownBy(() -> service.processVoiceForm(validAudioBase64(), "manutencao", "audio/wav"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Não foi possível interpretar a resposta da IA.");
        assertThat(provider.audioCalls.get()).isEqualTo(2);
    }

    @Test
    @DisplayName("Voice — formType inválido lança BusinessException sem chamar a IA")
    void voiceFormInvalidFormType() {
        StubProvider provider = StubProvider.returningText(null);
        AiService service = buildService(provider);
        assertThatThrownBy(() -> service.processVoiceForm(validAudioBase64(), "inexistente", "audio/wav"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Tipo de formulário de voz inválido");
        assertThat(provider.audioCalls.get()).isZero();
    }

    @Test
    @DisplayName("Voice — áudio muito curto lança BusinessException sem chamar a IA")
    void voiceFormAudioTooShort() {
        StubProvider provider = StubProvider.returningText(null);
        AiService service = buildService(provider);
        // 8 bytes decodificados (< 100)
        String shortAudio = java.util.Base64.getEncoder().encodeToString(new byte[8]);
        assertThatThrownBy(() -> service.processVoiceForm(shortAudio, "manutencao", "audio/wav"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Áudio muito curto");
        assertThat(provider.audioCalls.get()).isZero();
    }

    private String validAudioBase64() {
        return java.util.Base64.getEncoder().encodeToString(new byte[200]);
    }

    // ---------- Blindagem: salvaguardas anti-invenção de números no prompt ----------

    @Test
    @DisplayName("Blindagem — o prompt de interpretTrend enviado à IA contém a trava anti-invenção de números")
    void interpretTrendPromptCarriesAntiInventionGuard() {
        StubProvider provider = StubProvider.returningText("Tendencia interpretada.");
        AiService service = buildService(provider);

        String result = service.interpretTrend(
            "GLICOSE", "N1", "bioquimica", qcContextFor(record("APROVADO", null)));

        assertThat(result).isEqualTo("Tendencia interpretada.");
        String prompt = promptText(provider);
        assertThat(prompt)
            .as("o prompt deve proibir inventar números e citar SD/Z-score")
            .containsIgnoringCase("não invente")
            .contains("SD")
            .contains("Z-score");
        assertThat(prompt)
            .as("o prompt deve reafirmar Westgard como fonte de verdade e proibir decisão de status")
            .contains("motor determinístico de Westgard")
            .containsIgnoringCase("não decida liberar");
    }

    @Test
    @DisplayName("Blindagem — o prompt de suggestObservation enviado à IA contém a trava anti-invenção de números")
    void suggestObservationPromptCarriesAntiInventionGuard() {
        StubProvider provider = StubProvider.returningText("Observacao sugerida.");
        AiService service = buildService(provider);

        String result = service.suggestObservation("qc", "Controle N1 do dia");

        assertThat(result).isEqualTo("Observacao sugerida.");
        String prompt = promptText(provider);
        assertThat(prompt)
            .as("o prompt deve proibir inventar/estimar valores e citar SD e Z-score")
            .containsIgnoringCase("não invente")
            .contains("SD")
            .contains("Z-score");
        assertThat(prompt)
            .as("o prompt deve atribuir a decisão de status ao motor de Westgard")
            .contains("motor determinístico de Westgard");
    }

    // ---------- C9 executiveSummary ----------

    @Test
    @DisplayName("C9 — executiveSummary retorna o texto da IA no caminho feliz")
    void executiveSummaryHappyPath() {
        AiService service = buildService(StubProvider.returningText("Resumo executivo do período."));
        String result = service.executiveSummary("bioquimica", 7, "Taxa de aprovação: 95%");
        assertThat(result).isEqualTo("Resumo executivo do período.");
    }

    @Test
    @DisplayName("C9 — executiveSummary retorna mensagem amigável quando a IA falha")
    void executiveSummaryFriendlyErrorOnFailure() {
        AiService service = buildService(StubProvider.throwing(new RuntimeException("provider down")));
        String result = service.executiveSummary("bioquimica", 7, "contexto");
        assertThat(result).isEqualTo("Não foi possível analisar no momento. Tente novamente.");
    }

    @Test
    @DisplayName("C9 — executiveSummary roteia para o modelo medium")
    void executiveSummaryRoutesToMedium() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);
        service.executiveSummary("bioquimica", 7, "contexto");
        assertThat(provider.lastTextModel.get()).isEqualTo("gpt-5.4");
    }

    @Test
    @DisplayName("C9 — o prompt carrega a trava anti-invenção de números e a referência a Westgard")
    void executiveSummaryPromptCarriesGuards() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);
        service.executiveSummary("bioquimica", 7, "Taxa de aprovação: 95%");
        String prompt = promptText(provider);
        assertThat(prompt)
            .containsIgnoringCase("não invente")
            .contains("determinístico de Westgard");
    }

    // ---------- C10 summarizeAuditLogs ----------

    @Test
    @DisplayName("C10 — summarizeAuditLogs retorna o texto da IA no caminho feliz")
    void summarizeAuditLogsHappyPath() {
        AiService service = buildService(StubProvider.returningText("Resumo dos logs por categoria."));
        String result = service.summarizeAuditLogs("- 2026-06-17 | usuário=ana | ação=DELETE");
        assertThat(result).isEqualTo("Resumo dos logs por categoria.");
    }

    @Test
    @DisplayName("C10 — summarizeAuditLogs retorna mensagem amigável quando a IA falha")
    void summarizeAuditLogsFriendlyErrorOnFailure() {
        AiService service = buildService(StubProvider.throwing(new RuntimeException("provider down")));
        String result = service.summarizeAuditLogs("contexto");
        assertThat(result).isEqualTo("Não foi possível analisar no momento. Tente novamente.");
    }

    @Test
    @DisplayName("C10 — summarizeAuditLogs roteia para o modelo medium")
    void summarizeAuditLogsRoutesToMedium() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);
        service.summarizeAuditLogs("contexto");
        assertThat(provider.lastTextModel.get()).isEqualTo("gpt-5.4");
    }

    @Test
    @DisplayName("C10 — o prompt proíbe inventar eventos e enquadra como descritivo (não acusação)")
    void summarizeAuditLogsPromptCarriesGuards() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);
        service.summarizeAuditLogs("contexto");
        String prompt = promptText(provider);
        assertThat(prompt)
            .containsIgnoringCase("não invente eventos")
            .containsIgnoringCase("não uma acusação");
    }

    // ---------- A3 analyzeRootCause ----------

    @Test
    @DisplayName("A3 — analyzeRootCause retorna o texto da IA no caminho feliz")
    void analyzeRootCauseHappyPath() {
        AiService service = buildService(StubProvider.returningText("Hipótese: erro sistemático."));
        String result = service.analyzeRootCause(
            qcContextFor(record("REPROVADO", "1-3s"), record("APROVADO", null)),
            "  - HDL (lote L1)\n",
            "  - Equipamento AU680: Calibração em 2026-06-10\n");
        assertThat(result).isEqualTo("Hipótese: erro sistemático.");
    }

    @Test
    @DisplayName("A3 — analyzeRootCause aceita contextos de correlação vazios")
    void analyzeRootCauseEmptyCorrelations() {
        AiService service = buildService(StubProvider.returningText("Sem correlação clara."));
        String result = service.analyzeRootCause(qcContextFor(record("REPROVADO", "1-3s")), "", "");
        assertThat(result).isEqualTo("Sem correlação clara.");
    }

    @Test
    @DisplayName("A3 — analyzeRootCause retorna mensagem amigável quando a IA falha")
    void analyzeRootCauseFriendlyErrorOnFailure() {
        AiService service = buildService(StubProvider.throwing(new RuntimeException("provider down")));
        String result = service.analyzeRootCause(qcContextFor(record("REPROVADO", "1-3s")), "", "");
        assertThat(result).isEqualTo("Não foi possível analisar no momento. Tente novamente.");
    }

    @Test
    @DisplayName("A3 — analyzeRootCause roteia para o modelo advanced (tier ADVANCED)")
    void analyzeRootCauseRoutesToAdvanced() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);
        service.analyzeRootCause(qcContextFor(record("REPROVADO", "1-3s")), "", "");
        assertThat(provider.lastTextModel.get()).isEqualTo("gpt-5.5");
    }

    @Test
    @DisplayName("A3 — o prompt carrega travas anti-invenção, correlação≠causalidade e Westgard")
    void analyzeRootCausePromptCarriesGuards() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);
        service.analyzeRootCause(qcContextFor(record("REPROVADO", "1-3s")), "ctx-reagente", "ctx-manut");
        String prompt = promptText(provider);
        assertThat(prompt)
            .containsIgnoringCase("não invente")
            .contains("Z-score")
            .containsIgnoringCase("correlação não é causalidade")
            .containsIgnoringCase("não decida liberar")
            .contains("motor determinístico de Westgard");
        assertThat(prompt)
            .as("os contextos de correlação devem ir no prompt")
            .contains("ctx-reagente")
            .contains("ctx-manut");
    }

    // ---------- D12 prioritize ----------

    @Test
    @DisplayName("D12 — prioritize retorna a narrativa da IA quando há itens")
    void prioritizeHappyPath() {
        AiService service = buildService(StubProvider.returningText("Trate primeiro os vencidos."));
        String result = service.prioritize("bioquimica", List.of("REAGENTE | ALTA | HDL — vencido"));
        assertThat(result).isEqualTo("Trate primeiro os vencidos.");
    }

    @Test
    @DisplayName("D12 — prioritize devolve string vazia e NÃO chama a IA quando a lista é vazia")
    void prioritizeEmptyShortCircuits() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider);
        assertThat(service.prioritize("bioquimica", List.of())).isEmpty();
        assertThat(provider.textCalls.get()).isZero();
    }

    @Test
    @DisplayName("D12 — prioritize trata lista nula como vazia, sem chamar a IA")
    void prioritizeNullShortCircuits() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider);
        assertThat(service.prioritize("bioquimica", null)).isEmpty();
        assertThat(provider.textCalls.get()).isZero();
    }

    @Test
    @DisplayName("D12 — degradação graciosa: IA falha e prioritize devolve string vazia (não FRIENDLY_ERROR)")
    void prioritizeGracefulDegradationOnFailure() {
        AiService service = buildService(StubProvider.throwing(new RuntimeException("provider down")));
        String result = service.prioritize("bioquimica", List.of("MANUTENCAO | ALTA | AU680 — atrasada"));
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("D12 — prioritize roteia para o modelo medium")
    void prioritizeRoutesToMedium() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);
        service.prioritize("bioquimica", List.of("CQ | MEDIA | GLICOSE — 1-2s"));
        assertThat(provider.lastTextModel.get()).isEqualTo("gpt-5.4");
    }

    @Test
    @DisplayName("D12 — o prompt proíbe inventar itens e enquadra como sugestão para revisão humana")
    void prioritizePromptCarriesGuards() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);
        service.prioritize("bioquimica", List.of("REAGENTE | ALTA | HDL — vencido"));
        String prompt = promptText(provider);
        assertThat(prompt)
            .containsIgnoringCase("não invente itens")
            .containsIgnoringCase("revisão humana")
            .as("a lista de itens deve ir no prompt")
            .contains("REAGENTE | ALTA | HDL");
    }

    // ---------- D11 describeDrift ----------

    @Test
    @DisplayName("D11 — describeDrift devolve os detalhes da IA reconciliados por id")
    void describeDriftHappyPath() {
        StubProvider provider = StubProvider.returningText(
            "{\"items\":[{\"id\":0,\"detail\":\"Tendência de alta; verifique calibração.\"},"
            + "{\"id\":1,\"detail\":\"Sequência do mesmo lado; investigue lote.\"}]}");
        AiService service = buildService(provider);

        List<String> details = service.describeDrift(List.of(
            "Exame: GLICOSE | Padrão: DRIFT_UP",
            "Exame: UREIA | Padrão: RUN"));

        assertThat(details).containsExactly(
            "Tendência de alta; verifique calibração.",
            "Sequência do mesmo lado; investigue lote.");
    }

    @Test
    @DisplayName("D11 — describeDrift devolve lista vazia e NÃO chama a IA quando não há candidatos")
    void describeDriftEmptyShortCircuits() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider);
        assertThat(service.describeDrift(List.of())).isEmpty();
        assertThat(provider.textCalls.get()).isZero();
    }

    @Test
    @DisplayName("D11 — describeDrift trata lista nula como vazia, sem chamar a IA")
    void describeDriftNullShortCircuits() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider);
        assertThat(service.describeDrift(null)).isEmpty();
        assertThat(provider.textCalls.get()).isZero();
    }

    @Test
    @DisplayName("D11 — degradação graciosa: IA falha e describeDrift devolve detalhes vazios do mesmo tamanho")
    void describeDriftGracefulDegradationOnFailure() {
        AiService service = buildService(StubProvider.throwing(new RuntimeException("provider down")));
        List<String> details = service.describeDrift(List.of(
            "Exame: GLICOSE | Padrão: DRIFT_UP",
            "Exame: UREIA | Padrão: RUN"));
        assertThat(details).hasSize(2).containsOnly("");
    }

    @Test
    @DisplayName("D11 — JSON inválido degrada para detalhes vazios do mesmo tamanho")
    void describeDriftInvalidJsonDegrades() {
        AiService service = buildService(StubProvider.returningText("isto não é json"));
        List<String> details = service.describeDrift(List.of("Exame: GLICOSE | Padrão: DRIFT_UP"));
        assertThat(details).hasSize(1).containsOnly("");
    }

    @Test
    @DisplayName("D11 — candidato não coberto pela IA fica com detalhe vazio (reconciliação por id)")
    void describeDriftPartialCoverage() {
        // A IA só responde o id 0; o id 1 deve vir vazio.
        StubProvider provider = StubProvider.returningText(
            "{\"items\":[{\"id\":0,\"detail\":\"Só o primeiro.\"}]}");
        AiService service = buildService(provider);

        List<String> details = service.describeDrift(List.of(
            "Exame: GLICOSE | Padrão: DRIFT_UP",
            "Exame: UREIA | Padrão: RUN"));

        assertThat(details).containsExactly("Só o primeiro.", "");
    }

    @Test
    @DisplayName("D11 — describeDrift roteia para o modelo medium")
    void describeDriftRoutesToMedium() {
        StubProvider provider = StubProvider.returningText("{\"items\":[]}");
        AiService service = buildService(provider);
        service.describeDrift(List.of("Exame: GLICOSE | Padrão: DRIFT_UP"));
        assertThat(provider.lastTextModel.get()).isEqualTo("gpt-5.4");
    }

    @Test
    @DisplayName("D11 — o prompt proíbe inventar números/candidatos e enquadra como alerta preventivo")
    void describeDriftPromptCarriesGuards() {
        StubProvider provider = StubProvider.returningText("{\"items\":[]}");
        AiService service = buildService(provider);
        service.describeDrift(List.of("Exame: GLICOSE | Padrão: DRIFT_UP | Severidade: ALTA"));
        String prompt = promptText(provider);
        assertThat(prompt)
            .containsIgnoringCase("não invente")
            .containsIgnoringCase("alerta preventivo")
            .containsIgnoringCase("revisão humana")
            .contains("motor determinístico de Westgard");
        assertThat(prompt)
            .as("a lista de candidatos deve ir no prompt")
            .contains("Exame: GLICOSE | Padrão: DRIFT_UP");
    }

    // ---------- B5 validateBatch ----------

    @Test
    @DisplayName("B5 — linha boa (exame da área, numéricos OK) não gera sugestão e readiness=1.0")
    void validateBatchGoodRowNoSuggestion() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider, examRepositoryWith("bioquimica", "GLICOSE"));

        BatchValidationResult result = service.validateBatch("bioquimica", List.of(goodRow()));

        assertThat(result.suggestions()).isEmpty();
        assertThat(result.readinessScore()).isEqualTo(1.0);
        assertThat(provider.textCalls.get()).as("linha boa não aciona a IA").isZero();
    }

    @Test
    @DisplayName("B5 — typo de examName: IA sugere o nome da lista (TYPO) com o nome canônico")
    void validateBatchTypoSuggestsNameFromList() {
        StubProvider provider = StubProvider.returningText(
            "{\"items\":[{\"row\":0,\"issue\":\"TYPO\",\"suggestedExamName\":\"GLICOSE\",\"confidence\":0.92}]}");
        AiService service = buildService(provider, examRepositoryWith("bioquimica", "GLICOSE", "UREIA"));

        BatchRowDto typo = new BatchRowDto("glicos", "N1", 100.0, 100.0, 2.0, 5.0);
        BatchValidationResult result = service.validateBatch("bioquimica", List.of(typo));

        assertThat(result.suggestions()).hasSize(1);
        BatchSuggestionResult suggestion = result.suggestions().get(0);
        assertThat(suggestion.row()).isZero();
        assertThat(suggestion.field()).isEqualTo("examName");
        assertThat(suggestion.issue()).isEqualTo("TYPO");
        assertThat(suggestion.suggestion()).contains("GLICOSE");
        assertThat(suggestion.confidence()).isEqualTo(0.92);
        assertThat(result.readinessScore()).isEqualTo(0.0);
    }

    @Test
    @DisplayName("B5 — IA roteia para o modelo medium (gpt-5.4) na resolução de exame")
    void validateBatchRoutesToMedium() {
        StubProvider provider = StubProvider.returningText(
            "{\"items\":[{\"row\":0,\"issue\":\"UNKNOWN_EXAM\",\"suggestedExamName\":\"\",\"confidence\":0.4}]}");
        AiService service = buildService(provider, examRepositoryWith("bioquimica", "GLICOSE"));

        service.validateBatch("bioquimica", List.of(
            new BatchRowDto("XPTO", "N1", 10.0, 10.0, 1.0, 5.0)));

        assertThat(provider.lastTextModel.get()).isEqualTo("gpt-5.4");
    }

    @Test
    @DisplayName("B5 — IA que rebaixa nome inexistente na lista vira UNKNOWN_EXAM (reconciliação)")
    void validateBatchRejectsSuggestedNameNotInList() {
        // A IA "alucina" um nome fora da lista; o serviço deve rebaixar para UNKNOWN_EXAM.
        StubProvider provider = StubProvider.returningText(
            "{\"items\":[{\"row\":0,\"issue\":\"TYPO\",\"suggestedExamName\":\"COLESTEROL\",\"confidence\":0.9}]}");
        AiService service = buildService(provider, examRepositoryWith("bioquimica", "GLICOSE"));

        BatchValidationResult result = service.validateBatch("bioquimica", List.of(
            new BatchRowDto("colest", "N1", 180.0, 180.0, 5.0, 5.0)));

        assertThat(result.suggestions()).hasSize(1);
        assertThat(result.suggestions().get(0).issue()).isEqualTo("UNKNOWN_EXAM");
    }

    @Test
    @DisplayName("B5 — valor ausente: validação estrutural marca MISSING sem depender da IA")
    void validateBatchMissingValueStructural() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider, examRepositoryWith("bioquimica", "GLICOSE"));

        BatchRowDto missingValue = new BatchRowDto("GLICOSE", "N1", null, 100.0, 2.0, 5.0);
        BatchValidationResult result = service.validateBatch("bioquimica", List.of(missingValue));

        assertThat(result.suggestions()).hasSize(1);
        BatchSuggestionResult suggestion = result.suggestions().get(0);
        assertThat(suggestion.field()).isEqualTo("value");
        assertThat(suggestion.issue()).isEqualTo("MISSING");
        assertThat(provider.textCalls.get()).as("exame válido + numérico ausente não aciona IA").isZero();
        assertThat(result.readinessScore()).isEqualTo(0.0);
    }

    @Test
    @DisplayName("B5 — SD <= 0 e valor negativo geram OUT_OF_RANGE/SUSPECT_VALUE (estrutural)")
    void validateBatchNumericOutOfRangeStructural() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider, examRepositoryWith("bioquimica", "GLICOSE"));

        BatchRowDto bad = new BatchRowDto("GLICOSE", "N1", -5.0, 100.0, 0.0, -1.0);
        BatchValidationResult result = service.validateBatch("bioquimica", List.of(bad));

        assertThat(result.suggestions())
            .extracting(BatchSuggestionResult::issue)
            .contains("SUSPECT_VALUE", "OUT_OF_RANGE");
        assertThat(result.suggestions())
            .extracting(BatchSuggestionResult::field)
            .contains("value", "targetSd", "cvLimit");
        assertThat(provider.textCalls.get()).isZero();
    }

    @Test
    @DisplayName("B5 — degradação graciosa: IA falha e mismatch de exame vira UNKNOWN_EXAM")
    void validateBatchGracefulDegradationWhenAiFails() {
        StubProvider provider = StubProvider.throwing(new RuntimeException("provider down"));
        AiService service = buildService(provider, examRepositoryWith("bioquimica", "GLICOSE"));

        BatchRowDto typo = new BatchRowDto("glicos", "N1", 100.0, 100.0, 2.0, 5.0);
        BatchValidationResult result = service.validateBatch("bioquimica", List.of(typo));

        assertThat(result.suggestions()).hasSize(1);
        BatchSuggestionResult suggestion = result.suggestions().get(0);
        assertThat(suggestion.field()).isEqualTo("examName");
        assertThat(suggestion.issue()).isEqualTo("UNKNOWN_EXAM");
        assertThat(provider.textCalls.get()).as("a IA foi tentada uma vez").isEqualTo(1);
    }

    @Test
    @DisplayName("B5 — readinessScore = fração de linhas SEM problema")
    void validateBatchReadinessScoreFraction() {
        // 2 linhas boas + 1 com valor ausente => 2/3 prontas.
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider, examRepositoryWith("bioquimica", "GLICOSE"));

        BatchValidationResult result = service.validateBatch("bioquimica", List.of(
            goodRow(),
            goodRow(),
            new BatchRowDto("GLICOSE", "N1", null, 100.0, 2.0, 5.0)));

        assertThat(result.readinessScore()).isEqualTo(2.0 / 3.0);
    }

    @Test
    @DisplayName("B5 — múltiplas sugestões na mesma linha contam a linha uma única vez no readiness")
    void validateBatchMultipleSuggestionsSameRowCountedOnce() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider, examRepositoryWith("bioquimica", "GLICOSE"));

        // Uma linha com value ausente E targetSd inválido: 2 sugestões, 1 linha "suja".
        BatchValidationResult result = service.validateBatch("bioquimica", List.of(
            new BatchRowDto("GLICOSE", "N1", null, 100.0, 0.0, 5.0)));

        assertThat(result.suggestions()).hasSizeGreaterThanOrEqualTo(2);
        assertThat(result.readinessScore()).as("linha única toda suja => 0.0").isEqualTo(0.0);
    }

    @Test
    @DisplayName("B5 — examName em branco gera MISSING e não vai para a IA")
    void validateBatchBlankExamNameMissing() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider, examRepositoryWith("bioquimica", "GLICOSE"));

        BatchValidationResult result = service.validateBatch("bioquimica", List.of(
            new BatchRowDto("  ", "N1", 100.0, 100.0, 2.0, 5.0)));

        assertThat(result.suggestions()).hasSize(1);
        assertThat(result.suggestions().get(0).field()).isEqualTo("examName");
        assertThat(result.suggestions().get(0).issue()).isEqualTo("MISSING");
        assertThat(provider.textCalls.get()).as("examName em branco é estrutural, não vai à IA").isZero();
    }

    @Test
    @DisplayName("B5 — lote vazio retorna readiness=1.0 sem sugestões e sem IA")
    void validateBatchEmptyRows() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider, examRepositoryWith("bioquimica", "GLICOSE"));

        BatchValidationResult result = service.validateBatch("bioquimica", List.of());

        assertThat(result.suggestions()).isEmpty();
        assertThat(result.readinessScore()).isEqualTo(1.0);
        assertThat(provider.textCalls.get()).isZero();
    }

    @Test
    @DisplayName("B5 — match de examName é case-insensitive (não aciona IA)")
    void validateBatchExamNameCaseInsensitive() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider, examRepositoryWith("bioquimica", "GLICOSE"));

        BatchValidationResult result = service.validateBatch("bioquimica", List.of(
            new BatchRowDto("glicose", "N1", 100.0, 100.0, 2.0, 5.0)));

        assertThat(result.suggestions()).isEmpty();
        assertThat(provider.textCalls.get()).isZero();
    }

    @Test
    @DisplayName("B5 — valor grosseiramente fora de banda (|z|>10) sinaliza SUSPECT_VALUE sem IA")
    void validateBatchGrossOutlierSuspect() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider, examRepositoryWith("bioquimica", "GLICOSE"));

        // alvo 100, SD 2, valor 200 => z = 50 >> 10.
        BatchValidationResult result = service.validateBatch("bioquimica", List.of(
            new BatchRowDto("GLICOSE", "N1", 200.0, 100.0, 2.0, 5.0)));

        assertThat(result.suggestions())
            .extracting(BatchSuggestionResult::issue)
            .contains("SUSPECT_VALUE");
        assertThat(provider.textCalls.get()).isZero();
    }

    @Test
    @DisplayName("B5 — o prompt enviado à IA contém as travas anti-invenção e a lista de exames")
    void validateBatchPromptCarriesGuards() {
        StubProvider provider = StubProvider.returningText(
            "{\"items\":[{\"row\":0,\"issue\":\"UNKNOWN_EXAM\",\"suggestedExamName\":\"\",\"confidence\":0.3}]}");
        AiService service = buildService(provider, examRepositoryWith("bioquimica", "GLICOSE", "UREIA"));

        service.validateBatch("bioquimica", List.of(
            new BatchRowDto("zzz", "N1", 10.0, 10.0, 1.0, 5.0)));

        String prompt = promptText(provider);
        assertThat(prompt)
            .as("o prompt deve proibir inventar números e só sugerir nomes da lista")
            .containsIgnoringCase("não invente")
            .containsIgnoringCase("revisão humana");
        assertThat(prompt)
            .as("o prompt deve conter a lista de exames válidos da área")
            .contains("GLICOSE")
            .contains("UREIA");
    }

    // ---------- Onda 4 / Fase A — rate-limit como RateLimitException (429) ----------

    /**
     * Esgota a janela de rate-limit chamando {@code analyze} 10 vezes (o limiar).
     * Como nao ha SecurityContext no teste, todas as chamadas compartilham a chave
     * "anonymous", entao a 11a chamada de qualquer metodo assistivo estoura.
     */
    private void exhaustRateLimit(AiService service) {
        for (int i = 0; i < 10; i++) {
            service.analyze("pergunta " + i, "contexto");
        }
    }

    @Test
    @DisplayName("Rate-limit — a 11ª chamada lança RateLimitException com retryAfterSeconds em [1,60]")
    void rateLimitThrowsRateLimitExceptionWithinBounds() {
        AiService service = buildService(StubProvider.returningText("ok"));
        exhaustRateLimit(service);

        assertThatThrownBy(() -> service.analyze("estouro", "contexto"))
            .isInstanceOf(RateLimitException.class)
            .satisfies(thrown -> {
                long retry = ((RateLimitException) thrown).getRetryAfterSeconds();
                assertThat(retry)
                    .as("retryAfterSeconds deve respeitar piso 1 e teto 60")
                    .isBetween(1L, 60L);
            });
    }

    @Test
    @DisplayName("Rate-limit — NÃO estende BusinessException (garante propagação, não degradação)")
    void rateLimitIsNotBusinessException() {
        AiService service = buildService(StubProvider.returningText("ok"));
        exhaustRateLimit(service);

        assertThatThrownBy(() -> service.analyze("estouro", "contexto"))
            .isInstanceOf(RateLimitException.class)
            .isNotInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("Regressão D12 — prioritize NÃO degrada sob rate-limit: propaga RateLimitException")
    void prioritizeDoesNotSwallowRateLimit() {
        AiService service = buildService(StubProvider.returningText("Recomendacao."));
        exhaustRateLimit(service);

        // Lista NÃO vazia para passar do short-circuit e alcançar ensureRateLimit().
        assertThatThrownBy(() -> service.prioritize("bioquimica", List.of("- item urgente")))
            .as("D12 captura BusinessException/RuntimeException para degradar; "
                + "RateLimitException deve escapar e NÃO virar recomendação vazia")
            .isInstanceOf(RateLimitException.class);
    }

    @Test
    @DisplayName("Regressão D11 — describeDrift NÃO degrada sob rate-limit: propaga RateLimitException")
    void describeDriftDoesNotSwallowRateLimit() {
        AiService service = buildService(StubProvider.returningText("[]"));
        exhaustRateLimit(service);

        // Lista NÃO vazia para alcançar ensureRateLimit() (vazia faz short-circuit).
        assertThatThrownBy(() -> service.describeDrift(List.of("id=0 | GLICOSE/N1 DRIFT_UP")))
            .as("D11 degrada para detalhes vazios em falha; RateLimitException deve escapar")
            .isInstanceOf(RateLimitException.class);
    }

    @Test
    @DisplayName("Regressão B5 — validateBatch NÃO degrada sob rate-limit: propaga RateLimitException")
    void validateBatchDoesNotSwallowRateLimit() {
        // examName 'zzz' não casa com a lista -> aciona resolveExamMismatches -> ensureRateLimit().
        AiService service = buildService(
            StubProvider.returningText("{\"items\":[]}"),
            examRepositoryWith("bioquimica", "GLICOSE"));
        exhaustRateLimit(service);

        assertThatThrownBy(() -> service.validateBatch("bioquimica", List.of(
            new BatchRowDto("zzz", "N1", 10.0, 10.0, 1.0, 5.0))))
            .as("B5 degrada para UNKNOWN_EXAM em falha da IA; RateLimitException deve escapar")
            .isInstanceOf(RateLimitException.class);
    }

    // ==================================================================
    // Onda 4 / Fase A — STREAMING (variantes *Stream do AiService)
    //
    // O StubProvider NAO sobrescreve completeTextStream: usa o DEFAULT da
    // interface, que emite a resposta inteira de completeText como 1 delta. Como
    // completeText do stub captura lastMessages/lastTextModel e incrementa
    // textCalls, ganhamos roteamento de modelo e captura de prompt de graca; aqui
    // acumulamos os deltas via o Consumer e validamos a igualdade do texto.
    // ==================================================================

    /** Coletor simples de deltas: junta os pedacos recebidos e conta as chamadas. */
    private static final class DeltaCollector {

        private final StringBuilder text = new StringBuilder();
        final List<String> chunks = new ArrayList<>();

        void accept(String delta) {
            chunks.add(delta);
            text.append(delta);
        }

        String text() {
            return text.toString();
        }
    }

    // ---------- analyzeStream ----------

    @Test
    @DisplayName("Stream — analyzeStream acumula os deltas formando o texto da IA")
    void analyzeStreamAccumulatesDeltas() {
        StubProvider provider = StubProvider.returningText("Resposta de chat em streaming.");
        AiService service = buildService(provider);
        DeltaCollector collector = new DeltaCollector();

        service.analyzeStream(
            List.of(AiMessage.user("Como interpreto a regra 1-3s?")), null, collector::accept);

        assertThat(collector.text()).isEqualTo("Resposta de chat em streaming.");
        assertThat(collector.chunks).as("default emite a resposta inteira como 1 delta").hasSize(1);
    }

    @Test
    @DisplayName("Stream — analyzeStream roteia para o modelo medium (CHAT)")
    void analyzeStreamRoutesToMedium() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);

        service.analyzeStream(List.of(AiMessage.user("oi")), null, ignored -> { });

        assertThat(provider.lastTextModel.get()).isEqualTo("gpt-5.4");
    }

    @Test
    @DisplayName("Stream — analyzeStream põe system(SYSTEM_PROMPT) como 1ª mensagem e mantém a ordem do histórico")
    void analyzeStreamBuildsSystemFirstAndKeepsHistoryOrder() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);

        List<AiMessage> conversation = List.of(
            AiMessage.user("primeira pergunta"),
            AiMessage.assistant("primeira resposta"),
            AiMessage.user("segunda pergunta"));
        service.analyzeStream(conversation, null, ignored -> { });

        List<AiMessage> sent = provider.lastMessages.get();
        assertThat(sent).hasSize(4);
        assertThat(sent.get(0).role()).isEqualTo("system");
        assertThat(sent.get(0).content()).contains("especialista em controle de qualidade laboratorial");
        // Histórico repassado na ordem, logo após o system (sem areaContext).
        assertThat(sent.get(1)).isEqualTo(AiMessage.user("primeira pergunta"));
        assertThat(sent.get(2)).isEqualTo(AiMessage.assistant("primeira resposta"));
        assertThat(sent.get(3)).isEqualTo(AiMessage.user("segunda pergunta"));
    }

    @Test
    @DisplayName("Stream — analyzeStream insere areaContext como user-message logo após o system quando presente")
    void analyzeStreamInsertsAreaContextAfterSystem() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);

        service.analyzeStream(
            List.of(AiMessage.user("pergunta")), "Contexto da área: bioquímica", ignored -> { });

        List<AiMessage> sent = provider.lastMessages.get();
        assertThat(sent).hasSize(3);
        assertThat(sent.get(0).role()).isEqualTo("system");
        assertThat(sent.get(1)).isEqualTo(AiMessage.user("Contexto da área: bioquímica"));
        assertThat(sent.get(2)).isEqualTo(AiMessage.user("pergunta"));
    }

    @Test
    @DisplayName("Stream — analyzeStream ignora areaContext vazio/em branco (não vira mensagem)")
    void analyzeStreamIgnoresBlankAreaContext() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);

        service.analyzeStream(List.of(AiMessage.user("pergunta")), "   ", ignored -> { });

        List<AiMessage> sent = provider.lastMessages.get();
        assertThat(sent).hasSize(2);
        assertThat(sent.get(0).role()).isEqualTo("system");
        assertThat(sent.get(1)).isEqualTo(AiMessage.user("pergunta"));
    }

    @Test
    @DisplayName("Stream — analyzeStream NÃO checa rate-limit interno (responsabilidade do controlador via checkRateLimit)")
    void analyzeStreamDoesNotSelfCheckRateLimit() {
        // Onda 4 / Fase A (parte 2): o rate-limit do streaming e checado pelo
        // controlador (checkRateLimit) ANTES do SseEmitter. Os *Stream NAO chamam
        // ensureRateLimit internamente — evita consumir 2 slots/requisicao. Logo,
        // mesmo com a janela esgotada, analyzeStream prossegue e emite normalmente.
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);
        exhaustRateLimit(service);
        DeltaCollector collector = new DeltaCollector();

        service.analyzeStream(List.of(AiMessage.user("apos esgotar a janela")), null, collector::accept);

        assertThat(collector.text()).isEqualTo("ok");
        assertThat(provider.textCalls.get()).as("o stream prossegue sem barrar por rate-limit").isPositive();
    }

    @Test
    @DisplayName("Stream — analyzeStream encerra graciosamente em falha de transporte (não relança, sem deltas)")
    void analyzeStreamSwallowsTransportFailure() {
        AiService service = buildService(StubProvider.throwing(new RuntimeException("provider down")));
        DeltaCollector collector = new DeltaCollector();

        service.analyzeStream(List.of(AiMessage.user("oi")), null, collector::accept);

        assertThat(collector.chunks).isEmpty();
    }

    // ---------- executiveSummaryStream ----------

    @Test
    @DisplayName("Stream — executiveSummaryStream acumula os deltas formando o texto da IA")
    void executiveSummaryStreamAccumulatesDeltas() {
        StubProvider provider = StubProvider.returningText("Resumo executivo em streaming.");
        AiService service = buildService(provider);
        DeltaCollector collector = new DeltaCollector();

        service.executiveSummaryStream("bioquimica", 7, "Taxa de aprovação: 95%", collector::accept);

        assertThat(collector.text()).isEqualTo("Resumo executivo em streaming.");
    }

    @Test
    @DisplayName("Stream — executiveSummaryStream roteia para o modelo medium")
    void executiveSummaryStreamRoutesToMedium() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);

        service.executiveSummaryStream("bioquimica", 7, "contexto", ignored -> { });

        assertThat(provider.lastTextModel.get()).isEqualTo("gpt-5.4");
    }

    @Test
    @DisplayName("Stream — executiveSummaryStream carrega as mesmas travas do bloqueante no prompt")
    void executiveSummaryStreamPromptCarriesGuards() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);

        service.executiveSummaryStream("bioquimica", 7, "Taxa de aprovação: 95%", ignored -> { });

        String prompt = promptText(provider);
        assertThat(prompt)
            .containsIgnoringCase("não invente")
            .contains("determinístico de Westgard");
    }

    @Test
    @DisplayName("Stream — executiveSummaryStream NÃO checa rate-limit interno (responsabilidade do controlador)")
    void executiveSummaryStreamDoesNotSelfCheckRateLimit() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);
        exhaustRateLimit(service);
        DeltaCollector collector = new DeltaCollector();

        service.executiveSummaryStream("bioquimica", 7, "contexto", collector::accept);

        assertThat(collector.text()).isEqualTo("ok");
    }

    // ---------- summarizeAuditLogsStream ----------

    @Test
    @DisplayName("Stream — summarizeAuditLogsStream acumula os deltas formando o texto da IA")
    void summarizeAuditLogsStreamAccumulatesDeltas() {
        StubProvider provider = StubProvider.returningText("Resumo dos logs em streaming.");
        AiService service = buildService(provider);
        DeltaCollector collector = new DeltaCollector();

        service.summarizeAuditLogsStream("- 2026-06-17 | usuário=ana | ação=DELETE", collector::accept);

        assertThat(collector.text()).isEqualTo("Resumo dos logs em streaming.");
    }

    @Test
    @DisplayName("Stream — summarizeAuditLogsStream roteia para o modelo medium")
    void summarizeAuditLogsStreamRoutesToMedium() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);

        service.summarizeAuditLogsStream("contexto", ignored -> { });

        assertThat(provider.lastTextModel.get()).isEqualTo("gpt-5.4");
    }

    @Test
    @DisplayName("Stream — summarizeAuditLogsStream carrega as mesmas travas do bloqueante no prompt")
    void summarizeAuditLogsStreamPromptCarriesGuards() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);

        service.summarizeAuditLogsStream("contexto", ignored -> { });

        String prompt = promptText(provider);
        assertThat(prompt)
            .containsIgnoringCase("não invente eventos")
            .containsIgnoringCase("não uma acusação");
    }

    @Test
    @DisplayName("Stream — summarizeAuditLogsStream NÃO checa rate-limit interno (responsabilidade do controlador)")
    void summarizeAuditLogsStreamDoesNotSelfCheckRateLimit() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);
        exhaustRateLimit(service);
        DeltaCollector collector = new DeltaCollector();

        service.summarizeAuditLogsStream("contexto", collector::accept);

        assertThat(collector.text()).isEqualTo("ok");
    }

    // ---------- analyzeRootCauseStream ----------

    @Test
    @DisplayName("Stream — analyzeRootCauseStream acumula os deltas formando o texto da IA")
    void analyzeRootCauseStreamAccumulatesDeltas() {
        StubProvider provider = StubProvider.returningText("Hipótese em streaming: erro sistemático.");
        AiService service = buildService(provider);
        DeltaCollector collector = new DeltaCollector();

        service.analyzeRootCauseStream(
            qcContextFor(record("REPROVADO", "1-3s")),
            "  - HDL (lote L1)\n",
            "  - Equipamento AU680: Calibração em 2026-06-10\n",
            collector::accept);

        assertThat(collector.text()).isEqualTo("Hipótese em streaming: erro sistemático.");
    }

    @Test
    @DisplayName("Stream — analyzeRootCauseStream roteia para o modelo advanced (tier ADVANCED)")
    void analyzeRootCauseStreamRoutesToAdvanced() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);

        service.analyzeRootCauseStream(qcContextFor(record("REPROVADO", "1-3s")), "", "", ignored -> { });

        assertThat(provider.lastTextModel.get()).isEqualTo("gpt-5.5");
    }

    @Test
    @DisplayName("Stream — analyzeRootCauseStream carrega as mesmas travas e os contextos no prompt")
    void analyzeRootCauseStreamPromptCarriesGuards() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);

        service.analyzeRootCauseStream(
            qcContextFor(record("REPROVADO", "1-3s")), "ctx-reagente", "ctx-manut", ignored -> { });

        String prompt = promptText(provider);
        assertThat(prompt)
            .containsIgnoringCase("não invente")
            .contains("Z-score")
            .containsIgnoringCase("correlação não é causalidade")
            .containsIgnoringCase("não decida liberar")
            .contains("motor determinístico de Westgard")
            .contains("ctx-reagente")
            .contains("ctx-manut");
    }

    @Test
    @DisplayName("Stream — analyzeRootCauseStream NÃO checa rate-limit interno (responsabilidade do controlador)")
    void analyzeRootCauseStreamDoesNotSelfCheckRateLimit() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);
        exhaustRateLimit(service);
        DeltaCollector collector = new DeltaCollector();

        service.analyzeRootCauseStream(qcContextFor(record("REPROVADO", "1-3s")), "", "", collector::accept);

        assertThat(collector.text()).isEqualTo("ok");
    }

    // ---------- checkRateLimit ----------

    @Test
    @DisplayName("Stream — checkRateLimit lança RateLimitException quando a janela está esgotada")
    void checkRateLimitThrowsWhenExhausted() {
        AiService service = buildService(StubProvider.returningText("ok"));
        exhaustRateLimit(service);

        assertThatThrownBy(service::checkRateLimit)
            .isInstanceOf(RateLimitException.class)
            .isNotInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("Stream — checkRateLimit não lança quando há janela disponível")
    void checkRateLimitPassesWhenWithinWindow() {
        AiService service = buildService(StubProvider.returningText("ok"));
        // Nenhuma chamada anterior: a janela está livre.
        service.checkRateLimit();
    }
}

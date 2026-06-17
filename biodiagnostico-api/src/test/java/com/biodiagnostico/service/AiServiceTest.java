package com.biodiagnostico.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.biodiagnostico.config.AiProperties;
import com.biodiagnostico.dto.request.BatchValidationRequest.BatchRowDto;
import com.biodiagnostico.entity.QcExam;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.WestgardViolation;
import com.biodiagnostico.exception.BusinessException;
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

    private String promptText(StubProvider provider) {
        StringBuilder sb = new StringBuilder();
        for (AiMessage message : provider.lastMessages.get()) {
            sb.append(message.role()).append(": ").append(message.content()).append('\n');
        }
        return sb.toString();
    }

    // ---------- A1 explainViolation ----------

    @Test
    @DisplayName("A1 — explainViolation retorna o texto da IA no caminho feliz")
    void explainViolationHappyPath() {
        AiService service = buildService(StubProvider.returningText("Explicacao clara da violacao 1-3s."));
        String result = service.explainViolation(
            record("REPROVADO", "1-3s"),
            List.of(record("APROVADO", null)));
        assertThat(result).isEqualTo("Explicacao clara da violacao 1-3s.");
    }

    @Test
    @DisplayName("A1 — explainViolation aceita histórico vazio")
    void explainViolationEmptyHistory() {
        AiService service = buildService(StubProvider.returningText("Explicacao sem historico."));
        String result = service.explainViolation(record("REPROVADO", "1-3s"), List.of());
        assertThat(result).isEqualTo("Explicacao sem historico.");
    }

    @Test
    @DisplayName("A1 — explainViolation aceita histórico nulo")
    void explainViolationNullHistory() {
        AiService service = buildService(StubProvider.returningText("Explicacao sem historico nulo."));
        String result = service.explainViolation(record("REPROVADO", "1-3s"), null);
        assertThat(result).isEqualTo("Explicacao sem historico nulo.");
    }

    @Test
    @DisplayName("A1 — explainViolation retorna mensagem amigável quando a IA falha (IO/Runtime)")
    void explainViolationFriendlyErrorOnFailure() {
        AiService service = buildService(StubProvider.throwing(new RuntimeException("provider down")));
        String result = service.explainViolation(record("REPROVADO", "1-3s"), List.of());
        assertThat(result).isEqualTo("Não foi possível analisar no momento. Tente novamente.");
    }

    @Test
    @DisplayName("A1 — explainViolation roteia para o modelo medium")
    void explainViolationRoutesToMedium() {
        StubProvider provider = StubProvider.returningText("ok");
        AiService service = buildService(provider);
        service.explainViolation(record("REPROVADO", "1-3s"), List.of());
        assertThat(provider.lastTextModel.get()).isEqualTo("gpt-5.4");
    }

    // ---------- A2 interpretTrend ----------

    @Test
    @DisplayName("A2 — interpretTrend retorna o texto da IA para série não vazia")
    void interpretTrendHappyPath() {
        AiService service = buildService(StubProvider.returningText("Tendencia estavel, sem deriva relevante."));
        String result = service.interpretTrend(
            "GLICOSE", "N1", "bioquimica",
            List.of(record("APROVADO", null), record("APROVADO", null)));
        assertThat(result).isEqualTo("Tendencia estavel, sem deriva relevante.");
    }

    @Test
    @DisplayName("A2 — interpretTrend devolve texto de 'sem dados' e NÃO chama a IA quando a série é vazia")
    void interpretTrendEmptySeriesShortCircuits() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider);
        String result = service.interpretTrend("GLICOSE", "N1", "bioquimica", List.of());
        assertThat(result).isEqualTo("Sem dados suficientes no período para interpretar tendência.");
        assertThat(provider.textCalls.get()).isZero();
    }

    @Test
    @DisplayName("A2 — interpretTrend trata série nula como sem dados, sem chamar a IA")
    void interpretTrendNullSeriesShortCircuits() {
        StubProvider provider = StubProvider.returningText("não deveria ser chamado");
        AiService service = buildService(provider);
        String result = service.interpretTrend("GLICOSE", "N1", "bioquimica", null);
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
            "GLICOSE", "N1", "bioquimica", List.of(record("APROVADO", null)));

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
}

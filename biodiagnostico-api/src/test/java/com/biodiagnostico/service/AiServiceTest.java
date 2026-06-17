package com.biodiagnostico.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.biodiagnostico.config.AiProperties;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.WestgardViolation;
import com.biodiagnostico.exception.BusinessException;
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
        AiProperties properties = new AiProperties();
        AiModelRouter router = new AiModelRouter(properties);
        return new AiService(provider, router, new ObjectMapper(), properties, new SimpleMeterRegistry());
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
}

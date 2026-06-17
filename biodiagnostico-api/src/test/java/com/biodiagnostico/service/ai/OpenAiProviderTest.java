package com.biodiagnostico.service.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.biodiagnostico.config.AiProperties;
import com.biodiagnostico.exception.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

/**
 * Testa o {@link OpenAiProvider}. O HTTP e simulado por um {@link RestTemplate}
 * falso que sobrescreve {@code postForEntity} — nenhuma chamada real e feita.
 * Nao se usa {@code Mockito.mock(RestTemplate.class)} porque o mockmaker inline
 * nao consegue instrumentar {@code RestTemplate} no JDK atual.
 */
class OpenAiProviderTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    private AiProperties properties(String apiKey, String baseUrl) {
        AiProperties props = new AiProperties();
        props.getOpenai().setApiKey(apiKey);
        if (baseUrl != null) {
            props.getOpenai().setBaseUrl(baseUrl);
        }
        return props;
    }

    private OpenAiProvider provider(
        AiProperties props,
        Supplier<ResponseEntity<String>> response,
        AtomicReference<String> capturedUrl,
        AtomicReference<HttpHeaders> capturedHeaders,
        AtomicReference<JsonNode> capturedBody,
        RuntimeException error
    ) {
        RestTemplate fake = new RestTemplate() {
            @Override
            public <T> ResponseEntity<T> postForEntity(
                String url, Object request, Class<T> responseType, Object... uriVariables
            ) {
                capture(url, request);
                if (error != null) {
                    throw error;
                }
                @SuppressWarnings("unchecked")
                ResponseEntity<T> typed = (ResponseEntity<T>) response.get();
                return typed;
            }

            @Override
            public <T> ResponseEntity<T> postForEntity(URI url, Object request, Class<T> responseType) {
                capture(url.toString(), request);
                if (error != null) {
                    throw error;
                }
                @SuppressWarnings("unchecked")
                ResponseEntity<T> typed = (ResponseEntity<T>) response.get();
                return typed;
            }

            private void capture(String url, Object request) {
                if (capturedUrl != null) {
                    capturedUrl.set(url);
                }
                if (request instanceof HttpEntity<?> entity) {
                    if (capturedHeaders != null) {
                        capturedHeaders.set(entity.getHeaders());
                    }
                    if (capturedBody != null) {
                        try {
                            capturedBody.set(objectMapper.valueToTree(entity.getBody()));
                        } catch (RuntimeException ignored) {
                            // corpo nao serializavel — deixa null
                        }
                    }
                }
            }
        };
        return new OpenAiProvider(fake, objectMapper, props);
    }

    private ResponseEntity<String> chatResponse(String content) {
        return ResponseEntity.ok(
            "{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"" + content + "\"}}]}");
    }

    // ---------- completeText ----------

    @Test
    @DisplayName("completeText monta URL, header Bearer e body com model+messages, e parseia o content")
    void completeTextHappyPath() throws Exception {
        AtomicReference<String> url = new AtomicReference<>();
        AtomicReference<HttpHeaders> headers = new AtomicReference<>();
        AtomicReference<JsonNode> body = new AtomicReference<>();
        OpenAiProvider provider = provider(
            properties("sk-test", "https://api.openai.com/v1"),
            () -> chatResponse("Resposta da IA."),
            url, headers, body, null);

        String result = provider.completeText(
            "gpt-5.4",
            List.of(AiMessage.system("voce e um assistente"), AiMessage.user("ola")),
            false);

        assertThat(result).isEqualTo("Resposta da IA.");
        assertThat(url.get()).isEqualTo("https://api.openai.com/v1/chat/completions");
        assertThat(headers.get().getFirst(HttpHeaders.AUTHORIZATION)).isEqualTo("Bearer sk-test");
        assertThat(body.get().path("model").asText()).isEqualTo("gpt-5.4");
        JsonNode messages = body.get().path("messages");
        assertThat(messages.isArray()).isTrue();
        assertThat(messages).hasSize(2);
        assertThat(messages.path(0).path("role").asText()).isEqualTo("system");
        assertThat(messages.path(0).path("content").asText()).isEqualTo("voce e um assistente");
        assertThat(messages.path(1).path("role").asText()).isEqualTo("user");
        assertThat(messages.path(1).path("content").asText()).isEqualTo("ola");
    }

    @Test
    @DisplayName("completeText omite response_format quando jsonOutput=false")
    void completeTextNoJsonFormat() throws Exception {
        AtomicReference<JsonNode> body = new AtomicReference<>();
        OpenAiProvider provider = provider(
            properties("sk-test", null),
            () -> chatResponse("ok"), null, null, body, null);

        provider.completeText("gpt-5.4", List.of(AiMessage.user("oi")), false);

        assertThat(body.get().has("response_format")).isFalse();
    }

    @Test
    @DisplayName("completeText inclui response_format json_object quando jsonOutput=true")
    void completeTextJsonFormat() throws Exception {
        AtomicReference<JsonNode> body = new AtomicReference<>();
        OpenAiProvider provider = provider(
            properties("sk-test", null),
            () -> chatResponse("{}"), null, null, body, null);

        provider.completeText("gpt-5.4", List.of(AiMessage.user("oi")), true);

        assertThat(body.get().path("response_format").path("type").asText()).isEqualTo("json_object");
    }

    @Test
    @DisplayName("completeText remove a barra final da base-url ao montar a URL")
    void completeTextTrimsTrailingSlash() throws Exception {
        AtomicReference<String> url = new AtomicReference<>();
        OpenAiProvider provider = provider(
            properties("sk-test", "https://proxy.local/v1/"),
            () -> chatResponse("ok"), url, null, null, null);

        provider.completeText("gpt-5.4", List.of(AiMessage.user("oi")), false);

        assertThat(url.get()).isEqualTo("https://proxy.local/v1/chat/completions");
    }

    @Test
    @DisplayName("completeText lança BusinessException quando a API key está ausente, sem chamar HTTP")
    void completeTextMissingApiKey() {
        AtomicReference<String> url = new AtomicReference<>();
        OpenAiProvider provider = provider(
            properties("", null),
            () -> chatResponse("nunca"), url, null, null, null);

        assertThatThrownBy(() -> provider.completeText("gpt-5.4", List.of(AiMessage.user("oi")), false))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("OPENAI_API_KEY");
        assertThat(url.get()).isNull();
    }

    @Test
    @DisplayName("completeText lança BusinessException quando a resposta não tem choices")
    void completeTextEmptyChoices() {
        OpenAiProvider provider = provider(
            properties("sk-test", null),
            () -> ResponseEntity.ok("{\"choices\":[]}"), null, null, null, null);

        assertThatThrownBy(() -> provider.completeText("gpt-5.4", List.of(AiMessage.user("oi")), false))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Resposta vazia");
    }

    @Test
    @DisplayName("completeText lança BusinessException quando o content está em branco")
    void completeTextBlankContent() {
        OpenAiProvider provider = provider(
            properties("sk-test", null),
            () -> chatResponse(""), null, null, null, null);

        assertThatThrownBy(() -> provider.completeText("gpt-5.4", List.of(AiMessage.user("oi")), false))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Resposta vazia");
    }

    @Test
    @DisplayName("completeText propaga erro de transporte do RestTemplate")
    void completeTextTransportError() {
        OpenAiProvider provider = provider(
            properties("sk-test", null),
            () -> chatResponse("nunca"), null, null, null,
            new RestClientException("connection reset"));

        assertThatThrownBy(() -> provider.completeText("gpt-5.4", List.of(AiMessage.user("oi")), false))
            .isInstanceOf(RestClientException.class);
    }

    // ---------- completeAudio ----------

    @Test
    @DisplayName("completeAudio monta content multimodal com input_audio (data + format) e parseia o content")
    void completeAudioHappyPath() throws Exception {
        AtomicReference<JsonNode> body = new AtomicReference<>();
        OpenAiProvider provider = provider(
            properties("sk-test", null),
            () -> chatResponse("conteudo-de-audio"), null, null, body, null);

        String result = provider.completeAudio("gpt-audio-1.5", "extraia campos", "QkFTRTY0", "wav");

        assertThat(result).isEqualTo("conteudo-de-audio");
        JsonNode message = body.get().path("messages").path(0);
        assertThat(message.path("role").asText()).isEqualTo("user");
        JsonNode content = message.path("content");
        assertThat(content.isArray()).isTrue();
        assertThat(content.path(0).path("type").asText()).isEqualTo("text");
        assertThat(content.path(0).path("text").asText()).isEqualTo("extraia campos");
        assertThat(content.path(1).path("type").asText()).isEqualTo("input_audio");
        assertThat(content.path(1).path("input_audio").path("data").asText()).isEqualTo("QkFTRTY0");
        assertThat(content.path(1).path("input_audio").path("format").asText()).isEqualTo("wav");
        assertThat(body.get().path("model").asText()).isEqualTo("gpt-audio-1.5");
    }

    @Test
    @DisplayName("completeAudio lança BusinessException quando a API key está ausente")
    void completeAudioMissingApiKey() {
        OpenAiProvider provider = provider(
            properties("", null),
            () -> chatResponse("nunca"), null, null, null, null);

        assertThatThrownBy(() -> provider.completeAudio("gpt-audio-1.5", "p", "ZGF0YQ==", "wav"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("OPENAI_API_KEY");
    }
}

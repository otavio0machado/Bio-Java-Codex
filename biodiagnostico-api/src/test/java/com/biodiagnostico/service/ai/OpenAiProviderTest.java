package com.biodiagnostico.service.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.biodiagnostico.config.AiProperties;
import com.biodiagnostico.exception.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.web.client.RequestCallback;
import org.springframework.web.client.ResponseExtractor;
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

    // ---------- completeTextStream ----------

    /**
     * {@link RestTemplate} falso para o caminho de streaming: sobrescreve
     * {@code execute(URI, HttpMethod, RequestCallback, ResponseExtractor)},
     * deixando o {@code RequestCallback} popular os headers/body (capturados) e
     * alimentando o {@code ResponseExtractor} com um corpo SSE canned via um
     * {@link ClientHttpResponse} de leitura. Nao se usa Mockito (nao instrumenta
     * RestTemplate no JDK atual), no mesmo espirito do fake de postForEntity.
     */
    private OpenAiProvider streamingProvider(
        AiProperties props,
        String sseBody,
        AtomicReference<String> capturedUrl,
        AtomicReference<HttpHeaders> capturedHeaders,
        AtomicReference<JsonNode> capturedBody
    ) {
        RestTemplate fake = new RestTemplate() {
            @Override
            public <T> T execute(
                URI url, HttpMethod method, RequestCallback requestCallback,
                ResponseExtractor<T> responseExtractor
            ) throws RestClientException {
                if (capturedUrl != null) {
                    capturedUrl.set(url.toString());
                }
                try {
                    RecordingRequest request = new RecordingRequest();
                    if (requestCallback != null) {
                        requestCallback.doWithRequest(request);
                    }
                    if (capturedHeaders != null) {
                        capturedHeaders.set(request.getHeaders());
                    }
                    if (capturedBody != null) {
                        String written = request.bodyAsString();
                        capturedBody.set(written.isEmpty() ? null : objectMapper.readTree(written));
                    }
                    return responseExtractor.extractData(new StringClientHttpResponse(sseBody));
                } catch (java.io.IOException ioException) {
                    throw new RestClientException("falha simulada de stream", ioException);
                }
            }
        };
        return new OpenAiProvider(fake, objectMapper, props);
    }

    private List<String> collectStream(OpenAiProvider provider, String model) throws Exception {
        List<String> deltas = new ArrayList<>();
        provider.completeTextStream(model, List.of(AiMessage.user("oi")), deltas::add);
        return deltas;
    }

    @Test
    @DisplayName("completeTextStream parseia linhas data: extraindo choices[0].delta.content em ordem")
    void completeTextStreamParsesDeltas() throws Exception {
        String sse = ""
            + "data: {\"choices\":[{\"delta\":{\"role\":\"assistant\"}}]}\n"
            + "data: {\"choices\":[{\"delta\":{\"content\":\"Olá\"}}]}\n"
            + "data: {\"choices\":[{\"delta\":{\"content\":\", \"}}]}\n"
            + "data: {\"choices\":[{\"delta\":{\"content\":\"mundo\"}}]}\n"
            + "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n"
            + "data: [DONE]\n";
        OpenAiProvider provider = streamingProvider(
            properties("sk-test", null), sse, null, null, null);

        List<String> deltas = collectStream(provider, "gpt-5.4");

        assertThat(deltas).containsExactly("Olá", ", ", "mundo");
        assertThat(String.join("", deltas)).isEqualTo("Olá, mundo");
    }

    @Test
    @DisplayName("completeTextStream ignora data: [DONE] e linhas em branco/keep-alive")
    void completeTextStreamIgnoresDoneAndBlankLines() throws Exception {
        String sse = ""
            + "\n"
            + ": keep-alive\n"
            + "data: {\"choices\":[{\"delta\":{\"content\":\"A\"}}]}\n"
            + "\n"
            + "data: {\"choices\":[{\"delta\":{\"content\":\"B\"}}]}\n"
            + "data: [DONE]\n"
            + "data: {\"choices\":[{\"delta\":{\"content\":\"NUNCA\"}}]}\n";
        OpenAiProvider provider = streamingProvider(
            properties("sk-test", null), sse, null, null, null);

        List<String> deltas = collectStream(provider, "gpt-5.4");

        assertThat(deltas).as("para no [DONE]; nada apos ele e emitido").containsExactly("A", "B");
    }

    @Test
    @DisplayName("completeTextStream tolera um evento JSON malformado isolado sem abortar o fluxo")
    void completeTextStreamToleratesMalformedEvent() throws Exception {
        String sse = ""
            + "data: {\"choices\":[{\"delta\":{\"content\":\"X\"}}]}\n"
            + "data: {isto nao e json valido}\n"
            + "data: {\"choices\":[{\"delta\":{\"content\":\"Y\"}}]}\n"
            + "data: [DONE]\n";
        OpenAiProvider provider = streamingProvider(
            properties("sk-test", null), sse, null, null, null);

        List<String> deltas = collectStream(provider, "gpt-5.4");

        assertThat(deltas).containsExactly("X", "Y");
    }

    @Test
    @DisplayName("completeTextStream monta URL, header Bearer e body com model+messages+stream=true")
    void completeTextStreamBuildsRequest() throws Exception {
        AtomicReference<String> url = new AtomicReference<>();
        AtomicReference<HttpHeaders> headers = new AtomicReference<>();
        AtomicReference<JsonNode> body = new AtomicReference<>();
        OpenAiProvider provider = streamingProvider(
            properties("sk-test", "https://api.openai.com/v1"),
            "data: [DONE]\n", url, headers, body);

        provider.completeTextStream(
            "gpt-5.4",
            List.of(AiMessage.system("voce e um assistente"), AiMessage.user("ola")),
            delta -> { });

        assertThat(url.get()).isEqualTo("https://api.openai.com/v1/chat/completions");
        assertThat(headers.get().getFirst(HttpHeaders.AUTHORIZATION)).isEqualTo("Bearer sk-test");
        assertThat(body.get().path("model").asText()).isEqualTo("gpt-5.4");
        assertThat(body.get().path("stream").asBoolean()).isTrue();
        JsonNode messages = body.get().path("messages");
        assertThat(messages).hasSize(2);
        assertThat(messages.path(0).path("role").asText()).isEqualTo("system");
        assertThat(messages.path(1).path("role").asText()).isEqualTo("user");
    }

    @Test
    @DisplayName("completeTextStream lança BusinessException quando a API key está ausente, sem chamar HTTP nem emitir")
    void completeTextStreamMissingApiKey() {
        AtomicReference<String> url = new AtomicReference<>();
        List<String> deltas = new ArrayList<>();
        OpenAiProvider provider = streamingProvider(
            properties("", null), "data: [DONE]\n", url, null, null);

        assertThatThrownBy(() -> provider.completeTextStream(
            "gpt-5.4", List.of(AiMessage.user("oi")), deltas::add))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("OPENAI_API_KEY");
        assertThat(url.get()).as("nenhuma chamada HTTP quando a key está ausente").isNull();
        assertThat(deltas).as("nenhum delta emitido antes da exceção").isEmpty();
    }

    /** {@link ClientHttpResponse} de leitura sobre um corpo de texto fixo (SSE). */
    private static final class StringClientHttpResponse implements ClientHttpResponse {

        private final InputStream body;

        StringClientHttpResponse(String text) {
            this.body = new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8));
        }

        @Override
        public InputStream getBody() {
            return body;
        }

        @Override
        public HttpHeaders getHeaders() {
            return new HttpHeaders();
        }

        @Override
        public HttpStatusCode getStatusCode() {
            return HttpStatus.OK;
        }

        @Override
        public String getStatusText() {
            return "OK";
        }

        @Override
        public void close() {
            // nada a fechar além do stream, que o leitor já fecha
        }
    }

    /**
     * {@link org.springframework.http.client.ClientHttpRequest} minimo para
     * capturar headers e corpo escritos pelo {@code RequestCallback} do caminho de
     * streaming. So precisa de {@code getHeaders()} e {@code getBody()}.
     */
    private static final class RecordingRequest
        implements org.springframework.http.client.ClientHttpRequest {

        private final HttpHeaders headers = new HttpHeaders();
        private final java.io.ByteArrayOutputStream body = new java.io.ByteArrayOutputStream();

        String bodyAsString() {
            return body.toString(StandardCharsets.UTF_8);
        }

        @Override
        public HttpHeaders getHeaders() {
            return headers;
        }

        @Override
        public java.io.OutputStream getBody() {
            return body;
        }

        @Override
        public ClientHttpResponse execute() {
            throw new UnsupportedOperationException("não usado no teste");
        }

        @Override
        public HttpMethod getMethod() {
            return HttpMethod.POST;
        }

        @Override
        public URI getURI() {
            return URI.create("https://api.openai.com/v1/chat/completions");
        }
    }
}

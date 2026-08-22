package com.biodiagnostico.service.ai;

import com.biodiagnostico.config.AiProperties;
import com.biodiagnostico.exception.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

/**
 * Provedor de IA baseado na API Chat Completions da OpenAI.
 *
 * <p>Reusa o {@link RestTemplate} compartilhado (timeouts ja configurados em
 * {@code HttpClientConfig}). Le credenciais/base-url de {@link AiProperties}.
 *
 * <p><strong>Texto:</strong> {@code POST {base-url}/chat/completions} com
 * {@code {model, messages}}; quando {@code jsonOutput}, adiciona
 * {@code response_format: {type: json_object}}.
 *
 * <p><strong>Audio (multimodal):</strong> mensagem {@code user} com content
 * array {@code [{type:text}, {type:input_audio, input_audio:{data, format}}]}.
 * A OpenAI Chat Completions aceita apenas {@code wav} e {@code mp3} no campo
 * {@code format} do {@code input_audio}.
 *
 * <p>Parsing: texto em {@code choices[0].message.content}.
 */
@Component
public class OpenAiProvider implements AiProvider {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final AiProperties properties;

    public OpenAiProvider(RestTemplate restTemplate, ObjectMapper objectMapper, AiProperties properties) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    @Override
    public String completeText(String model, List<AiMessage> messages, boolean jsonOutput) throws java.io.IOException {
        List<Map<String, Object>> payloadMessages = new ArrayList<>();
        for (AiMessage message : messages) {
            payloadMessages.add(Map.of(
                "role", message.role(),
                "content", message.content()
            ));
        }
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", payloadMessages);
        if (jsonOutput) {
            body.put("response_format", Map.of("type", "json_object"));
        }
        return extractContent(callChatCompletions(body));
    }

    /**
     * Streaming real via Chat Completions com {@code "stream": true}. Reusa o
     * MESMO corpo de {@link #completeText} (mais a flag de stream) e le a resposta
     * como um fluxo de linhas SSE {@code data: {json}}, extraindo
     * {@code choices[0].delta.content} de cada evento e repassando cada pedaco a
     * {@code onDelta}. Linhas {@code data: [DONE]} (sentinela de fim) e linhas em
     * branco/keep-alive sao ignoradas.
     *
     * <p>A checagem de API key acontece ANTES de abrir qualquer conexao, de modo
     * que {@link BusinessException} (key ausente) e lancada sem emitir nenhum
     * delta. A leitura usa {@link RestTemplate#execute} com um
     * {@code ResponseExtractor} sobre o {@code InputStream} cru (o
     * {@code SimpleClientHttpRequestFactory} default nao bufferiza a resposta),
     * permitindo emissao incremental.
     */
    @Override
    public void completeTextStream(String model, List<AiMessage> messages, Consumer<String> onDelta)
        throws java.io.IOException {
        String apiKey = requireApiKey();
        List<Map<String, Object>> payloadMessages = new ArrayList<>();
        for (AiMessage message : messages) {
            payloadMessages.add(Map.of(
                "role", message.role(),
                "content", message.content()
            ));
        }
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", payloadMessages);
        body.put("stream", true);

        String url = baseUrl() + "/chat/completions";
        String payload = objectMapper.writeValueAsString(body);

        restTemplate.execute(
            java.net.URI.create(url),
            HttpMethod.POST,
            request -> {
                request.getHeaders().setContentType(MediaType.APPLICATION_JSON);
                request.getHeaders().setBearerAuth(apiKey);
                request.getHeaders().setAccept(List.of(MediaType.TEXT_EVENT_STREAM, MediaType.APPLICATION_JSON));
                request.getBody().write(payload.getBytes(StandardCharsets.UTF_8));
            },
            response -> {
                consumeStream(response.getBody(), onDelta);
                return null;
            });
    }

    /**
     * Le o {@code InputStream} da resposta de streaming linha a linha, extraindo o
     * texto de cada evento {@code data:} e repassando-o a {@code onDelta}. Para no
     * sentinela {@code [DONE]}.
     */
    private void consumeStream(java.io.InputStream stream, Consumer<String> onDelta)
        throws java.io.IOException {
        try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || !trimmed.startsWith("data:")) {
                    continue;
                }
                String data = trimmed.substring("data:".length()).trim();
                if (data.isEmpty()) {
                    continue;
                }
                if ("[DONE]".equals(data)) {
                    break;
                }
                String delta = extractDelta(data);
                if (delta != null && !delta.isEmpty()) {
                    onDelta.accept(delta);
                }
            }
        }
    }

    /**
     * Extrai {@code choices[0].delta.content} de um evento JSON de streaming.
     * Eventos sem conteudo textual (ex.: chunk de role inicial ou
     * {@code finish_reason}) devolvem {@code null}. JSON malformado de um evento
     * isolado e ignorado (devolve {@code null}) para nao abortar o fluxo inteiro.
     */
    private String extractDelta(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode contentNode = root.path("choices").path(0).path("delta").path("content");
            return contentNode.isTextual() ? contentNode.asText() : null;
        } catch (com.fasterxml.jackson.core.JsonProcessingException invalidEvent) {
            return null;
        }
    }

    @Override
    public String completeAudio(String model, String prompt, String audioBase64, String audioFormat)
        throws java.io.IOException {
        List<Map<String, Object>> content = List.of(
            Map.of("type", "text", "text", prompt),
            Map.of(
                "type", "input_audio",
                "input_audio", Map.of(
                    "data", audioBase64,
                    "format", audioFormat
                )
            )
        );
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", List.of(Map.of("role", "user", "content", content)));
        return extractContent(callChatCompletions(body));
    }

    @Override
    public String completeVision(String model, String prompt, String imageBase64, String mimeType)
        throws java.io.IOException {
        String effectiveMime = (mimeType != null && !mimeType.isBlank()) ? mimeType : "image/jpeg";
        String dataUrl = "data:" + effectiveMime + ";base64," + imageBase64;
        List<Map<String, Object>> content = List.of(
            Map.of("type", "text", "text", prompt),
            Map.of("type", "image_url", "image_url", Map.of("url", dataUrl))
        );
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", List.of(Map.of("role", "user", "content", content)));
        body.put("response_format", Map.of("type", "json_object"));
        return extractContent(callChatCompletions(body));
    }

    private JsonNode callChatCompletions(Map<String, Object> body) throws java.io.IOException {
        String apiKey = requireApiKey();
        String url = baseUrl() + "/chat/completions";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        ResponseEntity<String> response = restTemplate.postForEntity(
            url, new HttpEntity<>(body, headers), String.class);
        return objectMapper.readTree(response.getBody());
    }

    private String extractContent(JsonNode root) {
        if (root == null) {
            throw new BusinessException("Resposta vazia da IA.");
        }
        JsonNode choices = root.path("choices");
        if (!choices.isArray() || choices.isEmpty()) {
            throw new BusinessException("Resposta vazia da IA.");
        }
        JsonNode contentNode = choices.path(0).path("message").path("content");
        if (contentNode.isMissingNode() || !contentNode.isTextual() || contentNode.asText().isBlank()) {
            throw new BusinessException("Resposta vazia da IA.");
        }
        return contentNode.asText();
    }

    /**
     * Devolve a API key configurada ou lanca {@link BusinessException} clara
     * quando ausente — comportamento identico ao antigo check inline de
     * {@code callChatCompletions}, agora compartilhado com o caminho de streaming.
     */
    private String requireApiKey() {
        String apiKey = properties.getOpenai().getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new BusinessException("OPENAI_API_KEY nao configurada");
        }
        return apiKey;
    }

    private String baseUrl() {
        String base = properties.getOpenai().getBaseUrl();
        if (base == null || base.isBlank()) {
            base = "https://api.openai.com/v1";
        }
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }
}

package com.biodiagnostico.service.ai;

import com.biodiagnostico.config.AiProperties;
import com.biodiagnostico.exception.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
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

    private JsonNode callChatCompletions(Map<String, Object> body) throws java.io.IOException {
        String apiKey = properties.getOpenai().getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new BusinessException("OPENAI_API_KEY nao configurada");
        }
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

    private String baseUrl() {
        String base = properties.getOpenai().getBaseUrl();
        if (base == null || base.isBlank()) {
            base = "https://api.openai.com/v1";
        }
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }
}

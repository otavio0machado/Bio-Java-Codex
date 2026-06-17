package com.biodiagnostico.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.biodiagnostico.config.AiProperties;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.service.ai.AiMessage;
import com.biodiagnostico.service.ai.AiProvider;
import com.biodiagnostico.service.ai.AiModelRouter;
import com.biodiagnostico.service.ai.AiTask;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

/**
 * Servico de IA assistiva do laboratorio. Orquestra prompts auditados pelo
 * dominio, rate-limit por usuario, metricas Micrometer e roteamento de modelos,
 * delegando o transporte ao {@link AiProvider} (hoje OpenAI).
 *
 * <p>Todos os metodos sao <strong>assistivos e read-only</strong>: produzem
 * texto/JSON para revisao humana e nunca decidem status de CQ — a fonte de
 * verdade do status e das violacoes e o {@code WestgardEngine} deterministico.
 */
@Slf4j
@Service
public class AiService {

    private static final String FRIENDLY_ERROR = "Não foi possível analisar no momento. Tente novamente.";
    private static final Map<String, String> VOICE_FORM_PROMPTS = Map.of(
        "registro",
        """
            Voce e um assistente de laboratorio de analises clinicas. O usuario esta ditando dados para registrar um controle de qualidade.

            Extraia os campos:
            - exam_name
            - value
            - target_value
            - equipment
            - analyst

            Regras:
            - exam_name em MAIUSCULAS
            - numeros devem ser float com ponto decimal
            - campos ausentes devem ser "" para texto e null para numeros
            - retorne APENAS um JSON valido

            Resposta:
            {"exam_name":"","value":null,"target_value":null,"equipment":"","analyst":""}
            """,
        "referencia",
        """
            Voce e um assistente de laboratorio de analises clinicas. O usuario esta ditando dados para cadastrar uma referencia de CQ.

            Extraia os campos:
            - name
            - exam_name
            - level
            - valid_from
            - valid_until
            - target_value
            - cv_max
            - lot_number
            - manufacturer
            - notes

            Regras:
            - exam_name em MAIUSCULAS
            - datas no formato YYYY-MM-DD
            - level deve ser "Normal", "N1", "N2" ou "N3"
            - retorne APENAS um JSON valido

            Resposta:
            {"name":"","exam_name":"","level":"Normal","valid_from":"","valid_until":"","target_value":null,"cv_max":null,"lot_number":"","manufacturer":"","notes":""}
            """,
        "reagente",
        """
            Voce e um assistente de laboratorio de analises clinicas. O usuario esta ditando dados para cadastrar um lote de reagente.

            Extraia os campos:
            - name
            - lot_number
            - expiry_date
            - initial_stock
            - daily_consumption
            - manufacturer

            Regras:
            - datas no formato YYYY-MM-DD
            - numeros devem ser float
            - retorne APENAS um JSON valido

            Resposta:
            {"name":"","lot_number":"","expiry_date":"","initial_stock":null,"daily_consumption":null,"manufacturer":""}
            """,
        "manutencao",
        """
            Voce e um assistente de laboratorio de analises clinicas. O usuario esta ditando dados para registrar uma manutencao de equipamento.

            Extraia os campos:
            - equipment
            - type
            - date
            - next_date
            - notes

            Regras:
            - type deve ser "Preventiva", "Corretiva" ou "Calibração"
            - datas no formato YYYY-MM-DD
            - retorne APENAS um JSON valido

            Resposta:
            {"equipment":"","type":"","date":"","next_date":"","notes":""}
            """
    );
    private static final String SYSTEM_PROMPT = """
        Você é um especialista em controle de qualidade laboratorial, com profundo conhecimento em:
        - Regras de Westgard (1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10x)
        - Gráficos de Levey-Jennings
        - Coeficiente de Variação (CV%)
        - Calibração de equipamentos
        - Gestão de reagentes e lotes

        Responda sempre em português do Brasil, de forma clara e prática.
        Quando analisar dados, aponte:
        1. Tendências observadas
        2. Problemas identificados
        3. Recomendações de ação
        """;

    private static final String EXPLAIN_VIOLATION_PROMPT = """
        Tarefa: explique o registro de CQ EM DESTAQUE (o primeiro da lista acima) para o analista.

        Estruture a resposta em português do Brasil cobrindo:
        1. O que o status/violação significa, em linguagem simples.
        2. A provável natureza do erro: aleatório (imprecisão pontual) vs sistemático (viés, deriva, calibração).
        3. De 3 a 5 ações recomendadas, objetivas e priorizadas.
        4. Se há algum padrão visível no histórico fornecido (deriva, repetição da mesma violação, alternância).

        IMPORTANTE: este conteúdo é uma RECOMENDAÇÃO para revisão humana. NÃO decida liberar ou
        reprovar o controle — a decisão é do analista responsável. Não invente números que não
        estejam no contexto.
        """;

    private static final String INTERPRET_TREND_PROMPT = """
        Tarefa: interprete a tendência da série de CQ acima (gráfico de Levey-Jennings).

        Em 2 a 4 frases, em português do Brasil, identifique se há sinais de:
        - deriva/tendência (drift): variação gradual e progressiva da média ao longo do tempo;
        - deslocamento abrupto da média (shift): mudança súbita de patamar que se mantém;
        - agrupamento (clustering): pontos concentrados de forma não aleatória;
        - outlier: ponto isolado distante dos demais.
        Relacione o padrão, quando aplicável, ao tipo de erro (deriva/shift geralmente indicam erro sistemático; outlier isolado, erro aleatório). Sugira, como RECOMENDAÇÃO (não decisão), se cabe alguma ação — por exemplo, considerar recalibração ou investigar o sistema analítico. A fonte de verdade do status e das violações é o motor determinístico de Westgard; não decida liberar nem reprovar. Não invente números nem estime SD, CV, média ou Z-score que não estejam no contexto.
        """;

    private static final String SUGGEST_OBSERVATION_PROMPT = """
        Você é um assistente de laboratório de análises clínicas. Redija UMA observação profissional, concisa (1 a 3 frases), padronizada e adequada ao tipo de registro indicado, pronta para o operador revisar e salvar. Use português do Brasil, tom técnico e impessoal. Responda APENAS com o texto da observação, sem rótulos, aspas ou marcadores. É uma sugestão para revisão humana.

        Restrições: descreva apenas o que estiver no contexto fornecido. NÃO invente, calcule nem estime valores numéricos (média, SD/desvio-padrão, CV, alvo, Z-score ou limites) — use somente números já presentes no contexto. Não afirme nem sugira liberação ou reprovação de resultado; a decisão de status é do motor determinístico de Westgard e do responsável.
        """;

    private static final Map<String, String> OBSERVATION_KIND_GUIDANCE = Map.of(
        "post-calibration",
        "pós-calibração de equipamento — descreva sucintamente o ajuste/calibração realizado e a conformidade do controle medido APÓS a calibração, como registro de ação corretiva. NÃO afirme que a pós-calibração altera, corrige ou invalida o status original do CQ que motivou a ação.",
        "maintenance",
        "manutenção de equipamento — descreva sucintamente a intervenção realizada e a condição do equipamento.",
        "reagent",
        "lote de reagente — descreva sucintamente a troca/uso do lote e qualquer aspecto relevante de rastreabilidade.",
        "qc",
        "controle de qualidade — descreva sucintamente a justificativa/observação do controle registrado."
    );

    private final AiProvider aiProvider;
    private final AiModelRouter modelRouter;
    private final ObjectMapper objectMapper;
    private final Map<String, Deque<Instant>> rateLimitByUser = new ConcurrentHashMap<>();
    private final int maxAudioBytes;
    private final MeterRegistry meterRegistry;

    public AiService(
        AiProvider aiProvider,
        AiModelRouter modelRouter,
        ObjectMapper objectMapper,
        AiProperties aiProperties,
        MeterRegistry meterRegistry
    ) {
        this.aiProvider = aiProvider;
        this.modelRouter = modelRouter;
        this.objectMapper = objectMapper;
        this.maxAudioBytes = aiProperties.getVoice().getMaxAudioBytes();
        this.meterRegistry = meterRegistry;
    }

    public String analyze(String userPrompt, String context) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            ensureRateLimit();
            List<AiMessage> messages = List.of(
                AiMessage.system(SYSTEM_PROMPT),
                AiMessage.user((context == null ? "" : context) + "\n\nPergunta: " + userPrompt)
            );
            String result = aiProvider.completeText(modelRouter.modelFor(AiTask.CHAT), messages, false);
            recordAiRequest("analyze", "success");
            sample.stop(aiLatencyTimer("analyze", "success"));
            return result;
        } catch (BusinessException exception) {
            recordAiRequest("analyze", "business_error");
            sample.stop(aiLatencyTimer("analyze", "business_error"));
            throw exception;
        } catch (java.io.IOException | RuntimeException exception) {
            recordAiRequest("analyze", "error");
            sample.stop(aiLatencyTimer("analyze", "error"));
            log.error("Erro na chamada de IA para analyze", exception);
            return FRIENDLY_ERROR;
        }
    }

    public Map<String, Object> processVoiceForm(String audioBase64, String formType, String mimeType) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            ensureRateLimit();
            String prompt = VOICE_FORM_PROMPTS.get(formType);
            if (prompt == null) {
                throw new BusinessException("Tipo de formulário de voz inválido");
            }

            byte[] audioBytes;
            try {
                audioBytes = Base64.getDecoder().decode(audioBase64);
            } catch (IllegalArgumentException exception) {
                throw new BusinessException("Áudio inválido ou corrompido.");
            }

            if (audioBytes.length < 100) {
                throw new BusinessException("Áudio muito curto. Grave novamente.");
            }
            if (audioBytes.length > maxAudioBytes) {
                double limitMb = maxAudioBytes / (1024D * 1024D);
                throw new BusinessException("Áudio excede o limite de %.1f MB.".formatted(limitMb));
            }

            String audioFormat = resolveAudioFormat(mimeType);
            Map<String, Object> result = completeVoiceFormWithEscalation(prompt, audioBase64, audioFormat);
            recordAiRequest("voice-to-form", "success");
            sample.stop(aiLatencyTimer("voice-to-form", "success"));
            return result;
        } catch (BusinessException exception) {
            recordAiRequest("voice-to-form", "business_error");
            sample.stop(aiLatencyTimer("voice-to-form", "business_error"));
            throw exception;
        } catch (java.io.IOException exception) {
            recordAiRequest("voice-to-form", "error");
            sample.stop(aiLatencyTimer("voice-to-form", "error"));
            log.error("Erro na chamada de IA para voice-to-form (IOException)", exception);
            throw new BusinessException("Não foi possível interpretar a resposta da IA.");
        } catch (RuntimeException exception) {
            recordAiRequest("voice-to-form", "error");
            sample.stop(aiLatencyTimer("voice-to-form", "error"));
            log.error("Erro na chamada de IA para voice-to-form", exception);
            throw new BusinessException(FRIENDLY_ERROR);
        }
    }

    /**
     * Chama o modelo de audio para extrair o JSON do formulario, com
     * escalonamento: se a saida limpa nao parsear para JSON valido, tenta uma
     * unica vez o modelo de escalonamento (tier acima); se nao houver tier acima
     * para audio, repete no mesmo modelo de audio. Apos a tentativa de
     * escalonamento ainda invalida, propaga {@link BusinessException} com a
     * mesma mensagem do comportamento legado.
     */
    private Map<String, Object> completeVoiceFormWithEscalation(
        String prompt, String audioBase64, String audioFormat
    ) throws java.io.IOException {
        String primaryModel = modelRouter.modelFor(AiTask.VOICE_FORM);
        Map<String, Object> parsed = tryParseVoiceForm(primaryModel, prompt, audioBase64, audioFormat);
        if (parsed != null) {
            return parsed;
        }

        String escalationModel = modelRouter.escalationModelFor(AiTask.VOICE_FORM);
        String retryModel = escalationModel != null ? escalationModel : primaryModel;
        parsed = tryParseVoiceForm(retryModel, prompt, audioBase64, audioFormat);
        if (parsed != null) {
            return parsed;
        }
        throw new BusinessException("Não foi possível interpretar a resposta da IA.");
    }

    /**
     * Executa uma tentativa de voice-form e retorna o mapa parseado, ou
     * {@code null} quando a saida limpa nao e JSON valido (sinaliza ao chamador
     * que cabe escalonar). Excecoes de transporte/IO propagam normalmente.
     */
    private Map<String, Object> tryParseVoiceForm(
        String model, String prompt, String audioBase64, String audioFormat
    ) throws java.io.IOException {
        String rawText = cleanJsonResponse(aiProvider.completeAudio(model, prompt, audioBase64, audioFormat));
        try {
            return objectMapper.readValue(rawText, new TypeReference<Map<String, Object>>() {
            });
        } catch (com.fasterxml.jackson.core.JsonProcessingException invalidJson) {
            return null;
        }
    }

    /**
     * A1 — Explica, em linguagem simples, o status/violacao de um registro de CQ.
     *
     * <p><strong>Assistivo e read-only:</strong> NAO altera o registro, status,
     * referencia nem violacoes. O texto e RECOMENDACAO para revisao humana; a
     * decisao de liberar/reprovar permanece com o {@code WestgardEngine}
     * deterministico e com o analista.
     *
     * @param record  registro de CQ a explicar (nunca {@code null})
     * @param history historico recente do MESMO exame+nivel+area (pode ser vazio)
     */
    public String explainViolation(QcRecord record, List<QcRecord> history) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            ensureRateLimit();
            List<QcRecord> contextRecords = new ArrayList<>();
            if (record != null) {
                contextRecords.add(record);
            }
            if (history != null) {
                history.stream()
                    .filter(item -> item != null && (record == null || item != record))
                    .forEach(contextRecords::add);
            }
            List<AiMessage> messages = List.of(
                AiMessage.system(SYSTEM_PROMPT),
                AiMessage.user(buildQcContext(contextRecords) + "\n\n" + EXPLAIN_VIOLATION_PROMPT)
            );
            String result = aiProvider.completeText(
                modelRouter.modelFor(AiTask.EXPLAIN_VIOLATION), messages, false);
            recordAiRequest("qc-explain", "success");
            sample.stop(aiLatencyTimer("qc-explain", "success"));
            return result;
        } catch (BusinessException exception) {
            recordAiRequest("qc-explain", "business_error");
            sample.stop(aiLatencyTimer("qc-explain", "business_error"));
            throw exception;
        } catch (java.io.IOException | RuntimeException exception) {
            recordAiRequest("qc-explain", "error");
            sample.stop(aiLatencyTimer("qc-explain", "error"));
            log.error("Erro na chamada de IA para qc-explain", exception);
            return FRIENDLY_ERROR;
        }
    }

    /**
     * A2 — Interpreta a tendencia de uma serie Levey-Jennings (drift, shift,
     * clustering, outlier).
     *
     * <p><strong>Assistivo e read-only:</strong> sugere se cabe acao (ex.:
     * considerar recalibracao) como RECOMENDACAO, nunca decisao automatica.
     * Se a serie vier vazia, devolve um texto fixo e NAO chama a IA.
     */
    public String interpretTrend(String examName, String level, String area, List<QcRecord> series) {
        if (series == null || series.isEmpty()) {
            return "Sem dados suficientes no período para interpretar tendência.";
        }
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            ensureRateLimit();
            String userContent = "Exame: " + safeText(examName)
                + " | Nível: " + safeText(level)
                + " | Área: " + safeText(area)
                + "\n\n" + buildQcContext(series)
                + "\n\n" + INTERPRET_TREND_PROMPT;
            List<AiMessage> messages = List.of(
                AiMessage.system(SYSTEM_PROMPT),
                AiMessage.user(userContent)
            );
            String result = aiProvider.completeText(
                modelRouter.modelFor(AiTask.INTERPRET_TREND), messages, false);
            recordAiRequest("qc-interpret-trend", "success");
            sample.stop(aiLatencyTimer("qc-interpret-trend", "success"));
            return result;
        } catch (BusinessException exception) {
            recordAiRequest("qc-interpret-trend", "business_error");
            sample.stop(aiLatencyTimer("qc-interpret-trend", "business_error"));
            throw exception;
        } catch (java.io.IOException | RuntimeException exception) {
            recordAiRequest("qc-interpret-trend", "error");
            sample.stop(aiLatencyTimer("qc-interpret-trend", "error"));
            log.error("Erro na chamada de IA para qc-interpret-trend", exception);
            return FRIENDLY_ERROR;
        }
    }

    /**
     * C8 — Sugere UMA observacao/justificativa profissional padronizada para o
     * operador revisar e salvar.
     *
     * <p><strong>Assistivo e read-only:</strong> apenas redige texto; nao
     * persiste nada. {@code kind} invalido propaga {@link BusinessException}
     * (mapeada para 400).
     */
    public String suggestObservation(String kind, String context) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            ensureRateLimit();
            String kindGuidance = OBSERVATION_KIND_GUIDANCE.get(kind);
            if (kindGuidance == null) {
                throw new BusinessException("Tipo de observação inválido");
            }
            String userContent = SUGGEST_OBSERVATION_PROMPT
                + "\n\nTipo de registro: " + kindGuidance
                + "\n\nContexto fornecido pelo operador:\n" + safeText(context);
            List<AiMessage> messages = List.of(
                AiMessage.user(userContent)
            );
            String result = aiProvider.completeText(
                modelRouter.modelFor(AiTask.SUGGEST_OBSERVATION), messages, false);
            recordAiRequest("suggest-observation", "success");
            sample.stop(aiLatencyTimer("suggest-observation", "success"));
            return result;
        } catch (BusinessException exception) {
            recordAiRequest("suggest-observation", "business_error");
            sample.stop(aiLatencyTimer("suggest-observation", "business_error"));
            throw exception;
        } catch (java.io.IOException | RuntimeException exception) {
            recordAiRequest("suggest-observation", "error");
            sample.stop(aiLatencyTimer("suggest-observation", "error"));
            log.error("Erro na chamada de IA para suggest-observation", exception);
            return FRIENDLY_ERROR;
        }
    }

    private String safeText(String value) {
        return value == null ? "" : value;
    }

    /**
     * Mapeia o {@code mimeType} recebido do frontend para o token de formato
     * aceito pelo provedor (ex.: {@code audio/wav} -&gt; {@code wav}). Quando
     * ausente/desconhecido, usa {@code webm} (formato historico do frontend).
     *
     * <p><strong>Atencao:</strong> a OpenAI Chat Completions aceita apenas
     * {@code wav}/{@code mp3} em {@code input_audio.format}; {@code webm}/
     * {@code mp4} NAO sao suportados. A normalizacao aqui NAO transcodifica —
     * apenas extrai o token; a compatibilidade do formato e responsabilidade da
     * origem (frontend/endpoint).
     */
    private String resolveAudioFormat(String mimeType) {
        if (mimeType == null || mimeType.isBlank()) {
            return "webm";
        }
        String normalized = mimeType.toLowerCase(Locale.ROOT).trim();
        int slash = normalized.indexOf('/');
        if (slash >= 0 && slash + 1 < normalized.length()) {
            normalized = normalized.substring(slash + 1);
        }
        int semicolon = normalized.indexOf(';');
        if (semicolon >= 0) {
            normalized = normalized.substring(0, semicolon);
        }
        normalized = normalized.trim();
        if (normalized.startsWith("x-")) {
            normalized = normalized.substring(2);
        }
        if (normalized.equals("mpeg") || normalized.equals("mpga")) {
            return "mp3";
        }
        return normalized.isBlank() ? "webm" : normalized;
    }

    public String buildQcContext(List<QcRecord> records) {
        StringBuilder context = new StringBuilder("Dados de Controle de Qualidade do Laboratório Biodiagnóstico:\n\n");
        for (QcRecord record : records) {
            context.append(String.format(
                "Data: %s | Exame: %s | Nível: %s | Valor: %.2f | Alvo: %.2f | SD: %.2f | CV: %.2f%% | Status: %s%n",
                record.getDate(),
                record.getExamName(),
                record.getLevel(),
                record.getValue(),
                record.getTargetValue(),
                record.getTargetSd(),
                record.getCv(),
                record.getStatus()
            ));
            if (record.getViolations() != null) {
                record.getViolations().forEach(violation -> context
                    .append("  -> Violação: ")
                    .append(violation.getRule())
                    .append(" - ")
                    .append(violation.getDescription())
                    .append('\n'));
            }
        }
        return context.toString();
    }

    private void ensureRateLimit() {
        String userKey = resolveCurrentUserKey();
        Deque<Instant> calls = rateLimitByUser.computeIfAbsent(userKey, ignored -> new ArrayDeque<>());
        Instant now = Instant.now();
        while (!calls.isEmpty() && Duration.between(calls.peekFirst(), now).toSeconds() >= 60) {
            calls.pollFirst();
        }
        if (calls.size() >= 10) {
            throw new BusinessException("Limite de 10 análises por minuto excedido");
        }
        calls.addLast(now);
    }

    private String resolveCurrentUserKey() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return "anonymous";
        }
        return authentication.getName();
    }

    private void recordAiRequest(String endpoint, String status) {
        Counter.builder("biodiagnostico.ai.requests")
            .description("Number of AI API requests")
            .tag("endpoint", endpoint)
            .tag("status", status)
            .register(meterRegistry)
            .increment();
    }

    private Timer aiLatencyTimer(String endpoint, String status) {
        return Timer.builder("biodiagnostico.ai.latency")
            .description("Latency of AI API calls")
            .tag("endpoint", endpoint)
            .tag("status", status)
            .register(meterRegistry);
    }

    private String cleanJsonResponse(String rawText) {
        String cleaned = rawText == null ? "" : rawText.trim();
        if (cleaned.startsWith("```")) {
            int firstNewLine = cleaned.indexOf('\n');
            cleaned = firstNewLine >= 0 ? cleaned.substring(firstNewLine + 1).trim() : cleaned;
            if (cleaned.endsWith("```")) {
                cleaned = cleaned.substring(0, cleaned.length() - 3).trim();
            }
        }
        if (!cleaned.startsWith("{")) {
            int start = cleaned.indexOf('{');
            int end = cleaned.lastIndexOf('}');
            if (start >= 0 && end > start) {
                cleaned = cleaned.substring(start, end + 1);
            }
        }
        return cleaned;
    }
}

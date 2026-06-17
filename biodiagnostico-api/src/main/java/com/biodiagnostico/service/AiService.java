package com.biodiagnostico.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.biodiagnostico.config.AiProperties;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.service.ai.AiMessage;
import com.biodiagnostico.service.ai.AiProvider;
import com.biodiagnostico.service.ai.AiModelRouter;
import com.biodiagnostico.service.ai.AiTask;
import com.fasterxml.jackson.databind.JsonNode;
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

    private static final String BATCH_VALIDATION_PROMPT = """
        Tarefa: você recebe (1) a LISTA DE EXAMES VÁLIDOS já cadastrados nesta área do laboratório e
        (2) algumas LINHAS de uma planilha de importação de controle de qualidade cujo nome de exame NÃO
        casou exatamente com a lista. Para cada linha, decida se o examName digitado é apenas um ERRO DE
        DIGITAÇÃO de um exame da lista (ex.: "glicos" -> "GLICOSE", "uréia" -> "UREIA") ou se é um exame
        DESCONHECIDO que não corresponde a nenhum da lista.

        Travas obrigatórias (não negociáveis):
        - NÃO invente nem estime valores numéricos (média, SD, CV, alvo, Z-score ou limites). Você NÃO recebe
          autorização para propor número algum.
        - Sugira APENAS nomes de exame que estejam LITERALMENTE na lista fornecida. Nunca crie um nome novo.
        - Isto é uma SUGESTÃO para revisão humana, NÃO uma decisão de importação. Você não aprova, não reprova
          e não importa nada.

        Para cada linha de entrada, devolva um objeto com:
          - "row": o índice (inteiro) exatamente como veio na linha de entrada;
          - "issue": "TYPO" se for erro de digitação de um exame da lista, ou "UNKNOWN_EXAM" caso contrário;
          - "suggestedExamName": quando issue="TYPO", o nome EXATO da lista que corresponde; quando
            issue="UNKNOWN_EXAM", use "" (string vazia);
          - "confidence": número entre 0 e 1 indicando sua confiança.

        Responda APENAS com JSON válido, sem texto fora do JSON, no formato:
        {"items":[{"row":0,"issue":"TYPO","suggestedExamName":"GLICOSE","confidence":0.9}]}
        """;

    private static final String EXECUTIVE_SUMMARY_PROMPT = """
        Tarefa: redija um RESUMO EXECUTIVO em português do Brasil do estado do controle de qualidade do
        laboratório no período informado, a partir EXCLUSIVAMENTE dos indicadores e listas acima.

        Estruture em parágrafos curtos (ou tópicos) cobrindo:
        1. Visão geral (taxa de aprovação e volume do período);
        2. Destaques positivos;
        3. Pontos de atenção (reagentes vencendo/vencidos, manutenções pendentes, violações de Westgard);
        4. Recomendações objetivas e priorizadas para a gestão.

        Travas obrigatórias (não negociáveis):
        - NÃO invente nem estime valores numéricos (taxas, contagens, média, SD, CV, alvo, Z-score ou limites).
          Use somente os números já presentes no contexto; se um dado não estiver no contexto, não o cite.
        - Respeite o rótulo temporal de cada número: a taxa de aprovação fornecida é do MÊS; não a apresente
          como se fosse da janela de dias informada. Não combine nem recalcule indicadores de janelas diferentes.
        - Isto é um INSUMO para revisão humana (gestão/responsável técnico), NÃO uma decisão. Não declare
          liberação ou reprovação de controles — a fonte de verdade do status e das violações é o motor
          determinístico de Westgard.
        """;

    private static final String AUDIT_SUMMARY_PROMPT = """
        Tarefa: resuma, em português do Brasil, os REGISTROS DE AUDITORIA (audit log) listados acima, que
        descrevem ações de usuários no sistema (ex.: criação, atualização, exclusão de registros).

        Estruture cobrindo:
        1. Resumo por categoria de ação/entidade (quantas e de que tipo);
        2. Destaque de anomalias ou padrões dignos de atenção (ex.: muitas exclusões em curto período,
           concentração de ações em um único usuário, picos fora do horário habitual).

        Travas obrigatórias (não negociáveis):
        - Descreva APENAS o que está nos registros fornecidos. NÃO invente eventos, usuários, datas nem
          números que não estejam no contexto.
        - Isto é um resumo descritivo para revisão humana (administração/auditoria), NÃO uma acusação nem
          uma decisão disciplinar. Aponte o que MERECE verificação, sem concluir intenção ou culpa.
        """;

    private static final String ROOT_CAUSE_PROMPT = """
        Tarefa: faça uma ANÁLISE DE CAUSA-RAIZ correlacionada para o registro de CQ EM DESTAQUE (o primeiro
        da lista de dados de CQ acima), usando o histórico do mesmo exame+nível+área e as informações de
        contexto (lotes de reagente ativos na área na data e manutenção/calibração mais recente do
        equipamento) fornecidas abaixo.

        Estruture a resposta em português do Brasil cobrindo:
        1. Hipóteses de causa provável, classificando entre erro ALEATÓRIO (imprecisão pontual) e
           SISTEMÁTICO (viés, deriva, deslocamento, calibração);
        2. Correlação plausível com reagente (troca/validade de lote), calibração e manutenção — apenas
           quando o contexto sustentar a correlação; se não houver evidência, diga que não há correlação clara;
        3. Próximos passos investigativos, objetivos e priorizados.

        Travas obrigatórias (não negociáveis):
        - NÃO invente nem estime valores numéricos (média, SD, CV, alvo, Z-score ou limites) — use somente os
          números presentes no contexto.
        - Correlação NÃO é causalidade: apresente como HIPÓTESE a verificar, nunca como conclusão definitiva.
        - O vínculo dos dados de contexto é FRACO por construção: os lotes de reagente listados são apenas os
          vigentes na área na data, sem comprovação de que algum foi usado neste registro; a manutenção é
          casada por NOME do equipamento, sem identificador formal. Trate qualquer relação como possível
          coincidência temporal/nominal a confirmar, não como uso ou causa estabelecida.
        - Isto é uma RECOMENDAÇÃO para revisão humana; NÃO decida liberar nem reprovar o controle. A fonte de
          verdade do status e das violações é o motor determinístico de Westgard.
        """;

    private static final String PRIORITIES_PROMPT = """
        Tarefa: a partir EXCLUSIVAMENTE da LISTA DE ITENS já priorizados de forma determinística pelo sistema
        (cada um com categoria, urgência e detalhe) acima, redija uma RECOMENDAÇÃO curta em português do
        Brasil indicando, em ordem, o que a equipe deve tratar primeiro e por quê.

        Travas obrigatórias (não negociáveis):
        - Use SOMENTE os itens da lista fornecida. NÃO invente itens, prazos, números nem urgências novas; a
          classificação de urgência já foi feita pelo sistema.
        - NÃO recalcule nem estime valores (média, SD, CV, Z-score, dias). Apenas organize e explique a fila.
        - Isto é uma SUGESTÃO de priorização para revisão humana, NÃO uma decisão. Para itens de CQ, a fonte
          de verdade do status e das violações é o motor determinístico de Westgard.

        Responda apenas com o texto da recomendação (sem rótulos nem JSON), em 2 a 5 frases.
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
    private final com.biodiagnostico.repository.QcExamRepository qcExamRepository;

    public AiService(
        AiProvider aiProvider,
        AiModelRouter modelRouter,
        ObjectMapper objectMapper,
        AiProperties aiProperties,
        MeterRegistry meterRegistry,
        com.biodiagnostico.repository.QcExamRepository qcExamRepository
    ) {
        this.aiProvider = aiProvider;
        this.modelRouter = modelRouter;
        this.objectMapper = objectMapper;
        this.maxAudioBytes = aiProperties.getVoice().getMaxAudioBytes();
        this.meterRegistry = meterRegistry;
        this.qcExamRepository = qcExamRepository;
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

    /**
     * C9 — Resumo executivo do dashboard (assistivo, read-only).
     *
     * <p>NAO grava nem decide; produz narrativa para gestao revisar. O
     * {@code context} ja vem montado pelo controlador (KPIs, alertas e registros
     * recentes); este metodo apenas orquestra prompt+modelo+rate-limit+metricas.
     * Em qualquer falha de IA, devolve {@link #FRIENDLY_ERROR}.
     *
     * @param area    area de CQ ({@code null}/vazio = todas) — apenas rotulo no prompt
     * @param days    janela em dias considerada — apenas rotulo no prompt
     * @param context contexto factual ja montado (numeros vem somente daqui)
     */
    public String executiveSummary(String area, int days, String context) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            ensureRateLimit();
            String areaLabel = (area == null || area.isBlank()) ? "todas as áreas" : area;
            String userContent = "Área: " + areaLabel
                + " | Janela: últimos " + days + " dia(s)\n\n"
                + safeText(context)
                + "\n\n" + EXECUTIVE_SUMMARY_PROMPT;
            List<AiMessage> messages = List.of(
                AiMessage.system(SYSTEM_PROMPT),
                AiMessage.user(userContent)
            );
            String result = aiProvider.completeText(
                modelRouter.modelFor(AiTask.EXECUTIVE_SUMMARY), messages, false);
            recordAiRequest("dashboard-summary", "success");
            sample.stop(aiLatencyTimer("dashboard-summary", "success"));
            return result;
        } catch (BusinessException exception) {
            recordAiRequest("dashboard-summary", "business_error");
            sample.stop(aiLatencyTimer("dashboard-summary", "business_error"));
            throw exception;
        } catch (java.io.IOException | RuntimeException exception) {
            recordAiRequest("dashboard-summary", "error");
            sample.stop(aiLatencyTimer("dashboard-summary", "error"));
            log.error("Erro na chamada de IA para dashboard-summary", exception);
            return FRIENDLY_ERROR;
        }
    }

    /**
     * C10 — Sumarizacao de audit logs (assistiva, read-only; uso restrito a
     * ADMIN pela camada de seguranca do controlador).
     *
     * <p>A IA apenas DESCREVE o que esta no log e aponta anomalias para
     * verificacao humana; NAO grava, NAO acusa e NAO decide. O {@code context}
     * (logs do periodo) ja vem montado pelo controlador. Em qualquer falha de
     * IA, devolve {@link #FRIENDLY_ERROR}.
     *
     * @param context texto dos registros de auditoria do periodo
     */
    public String summarizeAuditLogs(String context) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            ensureRateLimit();
            String userContent = safeText(context) + "\n\n" + AUDIT_SUMMARY_PROMPT;
            List<AiMessage> messages = List.of(
                AiMessage.system(SYSTEM_PROMPT),
                AiMessage.user(userContent)
            );
            String result = aiProvider.completeText(
                modelRouter.modelFor(AiTask.AUDIT_SUMMARY), messages, false);
            recordAiRequest("audit-summary", "success");
            sample.stop(aiLatencyTimer("audit-summary", "success"));
            return result;
        } catch (BusinessException exception) {
            recordAiRequest("audit-summary", "business_error");
            sample.stop(aiLatencyTimer("audit-summary", "business_error"));
            throw exception;
        } catch (java.io.IOException | RuntimeException exception) {
            recordAiRequest("audit-summary", "error");
            sample.stop(aiLatencyTimer("audit-summary", "error"));
            log.error("Erro na chamada de IA para audit-summary", exception);
            return FRIENDLY_ERROR;
        }
    }

    /**
     * A3 — Analise de causa-raiz correlacionada de um registro de CQ (assistiva,
     * read-only). Tier ADVANCED.
     *
     * <p>NAO altera registro, status, referencia nem violacoes. Apresenta
     * HIPOTESES (aleatorio vs sistematico) e correlacoes plausiveis com
     * reagente/calibracao/manutencao como RECOMENDACAO; a decisao permanece com o
     * {@code WestgardEngine} deterministico e o analista. Reusa
     * {@link #buildQcContext(List)} para o registro+historico e anexa os
     * contextos de reagente e manutencao ja montados pelo controlador.
     *
     * @param record             registro de CQ em foco (nunca {@code null})
     * @param history            historico recente do MESMO exame+nivel+area (pode ser vazio)
     * @param reagentContext     texto dos lotes de reagente ativos na area na data (pode ser vazio)
     * @param maintenanceContext texto da manutencao/calibracao mais recente do equipamento (pode ser vazio)
     */
    public String analyzeRootCause(
        QcRecord record, List<QcRecord> history, String reagentContext, String maintenanceContext
    ) {
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
            String userContent = buildQcContext(contextRecords)
                + "\nCorrelações de reagente (lotes ativos na área na data do registro):\n"
                + (reagentContext == null || reagentContext.isBlank()
                    ? "(sem lotes de reagente correlacionáveis no contexto)\n" : reagentContext)
                + "\nManutenção/calibração mais recente do equipamento do registro:\n"
                + (maintenanceContext == null || maintenanceContext.isBlank()
                    ? "(sem manutenção/calibração registrada para o equipamento)\n" : maintenanceContext)
                + "\n" + ROOT_CAUSE_PROMPT;
            List<AiMessage> messages = List.of(
                AiMessage.system(SYSTEM_PROMPT),
                AiMessage.user(userContent)
            );
            String result = aiProvider.completeText(
                modelRouter.modelFor(AiTask.ROOT_CAUSE), messages, false);
            recordAiRequest("qc-root-cause", "success");
            sample.stop(aiLatencyTimer("qc-root-cause", "success"));
            return result;
        } catch (BusinessException exception) {
            recordAiRequest("qc-root-cause", "business_error");
            sample.stop(aiLatencyTimer("qc-root-cause", "business_error"));
            throw exception;
        } catch (java.io.IOException | RuntimeException exception) {
            recordAiRequest("qc-root-cause", "error");
            sample.stop(aiLatencyTimer("qc-root-cause", "error"));
            log.error("Erro na chamada de IA para qc-root-cause", exception);
            return FRIENDLY_ERROR;
        }
    }

    /**
     * D12 — Recomendacao textual de priorizacao (assistiva, read-only).
     *
     * <p>NAO inventa itens: recebe a lista de itens JA priorizada de forma
     * DETERMINISTICA pelo controlador e apenas redige a narrativa que organiza a
     * fila. <strong>Degradacao graciosa:</strong> se a lista vier vazia ou a IA
     * falhar, devolve {@code ""} (string vazia) — o controlador ainda entrega os
     * itens deterministicos. Diferente de outros metodos, NAO devolve
     * {@link #FRIENDLY_ERROR} para nao poluir a narrativa.
     *
     * @param area      area de CQ ({@code null}/vazio = todas) — apenas rotulo no prompt
     * @param itemLines linhas textuais dos itens ja priorizados (categoria/urgencia/detalhe)
     * @return narrativa da IA, ou {@code ""} quando nao ha itens ou a IA falha
     */
    public String prioritize(String area, List<String> itemLines) {
        if (itemLines == null || itemLines.isEmpty()) {
            return "";
        }
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            ensureRateLimit();
            String areaLabel = (area == null || area.isBlank()) ? "todas as áreas" : area;
            StringBuilder builder = new StringBuilder();
            builder.append("Área: ").append(areaLabel).append('\n');
            builder.append("LISTA DE ITENS já priorizados pelo sistema (não invente outros):\n");
            for (String line : itemLines) {
                builder.append("- ").append(safeText(line)).append('\n');
            }
            builder.append('\n').append(PRIORITIES_PROMPT);
            List<AiMessage> messages = List.of(
                AiMessage.system(SYSTEM_PROMPT),
                AiMessage.user(builder.toString())
            );
            String result = aiProvider.completeText(
                modelRouter.modelFor(AiTask.PRIORITIES), messages, false);
            recordAiRequest("priorities", "success");
            sample.stop(aiLatencyTimer("priorities", "success"));
            return result == null ? "" : result;
        } catch (BusinessException exception) {
            recordAiRequest("priorities", "business_error");
            sample.stop(aiLatencyTimer("priorities", "business_error"));
            log.warn("Falha de negócio na IA para priorities; degradando para recomendação vazia", exception);
            return "";
        } catch (java.io.IOException | RuntimeException exception) {
            recordAiRequest("priorities", "error");
            sample.stop(aiLatencyTimer("priorities", "error"));
            log.error("Erro na chamada de IA para priorities; degradando para recomendação vazia", exception);
            return "";
        }
    }

    /**
     * B5 — Valida (de forma ASSISTIVA e READ-ONLY) as linhas de um lote de
     * importacao de CQ ANTES de importar, devolvendo SUGESTOES para revisao
     * humana.
     *
     * <p><strong>Nao importa, nao grava, nao decide aprovar/reprovar.</strong>
     * Nao recalcula CV/Z-score nem reimplementa Westgard; a deteccao de valor
     * suspeito aqui e apenas triagem grosseira (ausencia, negativo, fora de uma
     * banda larguissima) para apontar provavel erro de digitacao/unidade — nunca
     * um julgamento de regra de CQ.
     *
     * <p>Estrategia hibrida: primeiro uma validacao ESTRUTURAL deterministica
     * (sem IA); depois, apenas para as linhas cujo {@code examName} nao casa com
     * nenhum exame ativo da area, consulta a IA ({@link AiTask#BATCH_VALIDATION})
     * para sugerir o nome mais proximo da lista (TYPO) ou confirmar desconhecido.
     * A IA jamais propoe numero novo. Se a IA falhar, retorna ao menos as
     * sugestoes estruturais deterministicas (degradacao graciosa) — tratando o
     * nome nao-reconhecido como {@code UNKNOWN_EXAM}.
     *
     * @param area area de CQ das linhas (resolve a lista de exames ativos)
     * @param rows linhas a validar (nunca {@code null}; pode ser vazia)
     * @return sugestoes + {@code readinessScore} (fracao de linhas sem problema)
     */
    public BatchValidationResult validateBatch(
        String area, List<com.biodiagnostico.dto.request.BatchValidationRequest.BatchRowDto> rows
    ) {
        List<com.biodiagnostico.dto.request.BatchValidationRequest.BatchRowDto> safeRows =
            rows == null ? List.of() : rows;
        List<BatchSuggestionResult> suggestions = new ArrayList<>();

        // Exames ativos da area (fonte de verdade para nomes); case-insensitive.
        List<String> validExamNames = qcExamRepository == null ? List.of()
            : qcExamRepository.findByAreaAndIsActiveTrue(safeText(area)).stream()
                .map(com.biodiagnostico.entity.QcExam::getName)
                .filter(name -> name != null && !name.isBlank())
                .toList();
        java.util.Set<String> validNormalized = new java.util.HashSet<>();
        for (String name : validExamNames) {
            validNormalized.add(normalizeExam(name));
        }

        // Linhas cujo examName nao casa exatamente: candidatas a TYPO/UNKNOWN_EXAM.
        List<Integer> examMismatchRows = new ArrayList<>();

        for (int index = 0; index < safeRows.size(); index++) {
            var row = safeRows.get(index);
            String examName = row == null ? null : row.examName();

            if (examName == null || examName.isBlank()) {
                suggestions.add(new BatchSuggestionResult(
                    index, "examName", "MISSING",
                    "Nome do exame ausente. Informe o exame da área.", 1.0));
            } else if (!validNormalized.contains(normalizeExam(examName))) {
                examMismatchRows.add(index);
            }

            if (row != null) {
                appendNumericStructuralSuggestions(index, row, suggestions);
            }
        }

        // IA apenas para as linhas com nome de exame nao reconhecido.
        if (!examMismatchRows.isEmpty()) {
            suggestions.addAll(resolveExamMismatches(area, safeRows, examMismatchRows, validExamNames));
        }

        double readinessScore = computeReadinessScore(safeRows.size(), suggestions);
        return new BatchValidationResult(suggestions, readinessScore);
    }

    /**
     * Acrescenta sugestoes ESTRUTURAIS deterministicas dos campos numericos de
     * uma linha (ausencia, valores negativos/invalidos e valor grosseiramente
     * fora de banda). Nao decide status de CQ.
     */
    private void appendNumericStructuralSuggestions(
        int index,
        com.biodiagnostico.dto.request.BatchValidationRequest.BatchRowDto row,
        List<BatchSuggestionResult> suggestions
    ) {
        Double value = row.value();
        if (value == null) {
            suggestions.add(new BatchSuggestionResult(
                index, "value", "MISSING", "Valor medido ausente.", 1.0));
        } else if (value < 0) {
            suggestions.add(new BatchSuggestionResult(
                index, "value", "SUSPECT_VALUE",
                "Valor medido negativo — provável erro de digitação ou unidade.", 0.9));
        }

        Double targetValue = row.targetValue();
        if (targetValue != null && targetValue < 0) {
            suggestions.add(new BatchSuggestionResult(
                index, "targetValue", "OUT_OF_RANGE", "Valor-alvo negativo.", 0.9));
        }

        Double targetSd = row.targetSd();
        if (targetSd != null && targetSd <= 0) {
            suggestions.add(new BatchSuggestionResult(
                index, "targetSd", "OUT_OF_RANGE",
                "Desvio-padrão deve ser maior que zero.", 0.9));
        }

        Double cvLimit = row.cvLimit();
        if (cvLimit != null && cvLimit < 0) {
            suggestions.add(new BatchSuggestionResult(
                index, "cvLimit", "OUT_OF_RANGE", "Limite de CV não pode ser negativo.", 0.9));
        }

        // Triagem grosseira de valor fora de banda larguissima (|z| > 10): NAO e
        // regra de Westgard, apenas deteccao de erro grave de digitacao/unidade.
        if (value != null && value >= 0
            && targetValue != null && targetValue >= 0
            && targetSd != null && targetSd > 0) {
            double distance = Math.abs(value - targetValue) / targetSd;
            if (distance > 10.0) {
                suggestions.add(new BatchSuggestionResult(
                    index, "value", "SUSPECT_VALUE",
                    "Valor muito distante do alvo (mais de 10 desvios) — verifique digitação/unidade.",
                    0.7));
            }
        }
    }

    /**
     * Resolve as linhas com {@code examName} nao reconhecido usando a IA: para
     * cada uma, TYPO (com nome sugerido da lista) ou UNKNOWN_EXAM. Em qualquer
     * falha da IA, degrada graciosamente marcando todas como UNKNOWN_EXAM.
     */
    private List<BatchSuggestionResult> resolveExamMismatches(
        String area,
        List<com.biodiagnostico.dto.request.BatchValidationRequest.BatchRowDto> rows,
        List<Integer> mismatchRows,
        List<String> validExamNames
    ) {
        try {
            ensureRateLimit();
            String userContent = buildBatchValidationContext(area, rows, mismatchRows, validExamNames);
            List<AiMessage> messages = List.of(
                AiMessage.system(SYSTEM_PROMPT),
                AiMessage.user(userContent)
            );
            String raw = aiProvider.completeText(
                modelRouter.modelFor(AiTask.BATCH_VALIDATION), messages, true);
            List<BatchSuggestionResult> parsed =
                parseExamMismatchResponse(raw, mismatchRows, validExamNames);
            recordAiRequest("validate-batch", "success");
            return parsed;
        } catch (BusinessException exception) {
            recordAiRequest("validate-batch", "business_error");
            log.warn("Falha de negócio na IA para validate-batch; degradando para UNKNOWN_EXAM", exception);
            return degradeMismatches(mismatchRows);
        } catch (java.io.IOException | RuntimeException exception) {
            recordAiRequest("validate-batch", "error");
            log.error("Erro na chamada de IA para validate-batch; degradando para UNKNOWN_EXAM", exception);
            return degradeMismatches(mismatchRows);
        }
    }

    /** Degradacao graciosa: sem IA, todo nome nao reconhecido vira UNKNOWN_EXAM. */
    private List<BatchSuggestionResult> degradeMismatches(List<Integer> mismatchRows) {
        List<BatchSuggestionResult> fallback = new ArrayList<>(mismatchRows.size());
        for (int rowIndex : mismatchRows) {
            fallback.add(new BatchSuggestionResult(
                rowIndex, "examName", "UNKNOWN_EXAM",
                "Exame não reconhecido na área. Verifique o cadastro ou o nome digitado.", 0.5));
        }
        return fallback;
    }

    private String buildBatchValidationContext(
        String area,
        List<com.biodiagnostico.dto.request.BatchValidationRequest.BatchRowDto> rows,
        List<Integer> mismatchRows,
        List<String> validExamNames
    ) {
        StringBuilder builder = new StringBuilder();
        builder.append("Área: ").append(safeText(area)).append('\n');
        builder.append("EXAMES VÁLIDOS desta área (use somente estes nomes nas sugestões):\n");
        if (validExamNames.isEmpty()) {
            builder.append("(nenhum exame cadastrado para a área)\n");
        } else {
            for (String name : validExamNames) {
                builder.append("- ").append(name).append('\n');
            }
        }
        builder.append("\nLINHAS com examName que não casou (cada uma com seu índice 'row'):\n");
        for (int rowIndex : mismatchRows) {
            var row = rows.get(rowIndex);
            builder.append("row=").append(rowIndex)
                .append(" | examName=\"").append(row == null ? "" : safeText(row.examName()))
                .append("\"\n");
        }
        builder.append('\n').append(BATCH_VALIDATION_PROMPT);
        return builder.toString();
    }

    /**
     * Parseia a resposta da IA e a reconcilia com a fonte de verdade: o nome
     * sugerido SO e aceito se existir na lista de exames validos (case-insensitive);
     * caso contrario rebaixa para UNKNOWN_EXAM. Linhas nao cobertas pela IA viram
     * UNKNOWN_EXAM. A {@code confidence} e saturada para [0,1].
     */
    private List<BatchSuggestionResult> parseExamMismatchResponse(
        String raw, List<Integer> mismatchRows, List<String> validExamNames
    ) throws java.io.IOException {
        java.util.Map<String, String> canonicalByNormalized = new java.util.HashMap<>();
        for (String name : validExamNames) {
            canonicalByNormalized.put(normalizeExam(name), name);
        }

        java.util.Map<Integer, BatchSuggestionResult> byRow = new java.util.LinkedHashMap<>();
        String cleaned = cleanJsonResponse(raw);
        JsonNode root = objectMapper.readTree(cleaned);
        JsonNode items = root.path("items");
        if (items.isArray()) {
            for (JsonNode item : items) {
                if (!item.path("row").isInt() && !item.path("row").isLong()) {
                    continue;
                }
                int rowIndex = item.path("row").asInt();
                if (!mismatchRows.contains(rowIndex) || byRow.containsKey(rowIndex)) {
                    continue;
                }
                String issue = item.path("issue").asText("");
                double confidence = clampConfidence(item.path("confidence").asDouble(0.5));
                String suggestedRaw = item.path("suggestedExamName").asText("");
                String canonical = suggestedRaw.isBlank()
                    ? null : canonicalByNormalized.get(normalizeExam(suggestedRaw));

                if ("TYPO".equalsIgnoreCase(issue) && canonical != null) {
                    byRow.put(rowIndex, new BatchSuggestionResult(
                        rowIndex, "examName", "TYPO",
                        "Possível erro de digitação. Exame sugerido: " + canonical, confidence));
                } else {
                    byRow.put(rowIndex, new BatchSuggestionResult(
                        rowIndex, "examName", "UNKNOWN_EXAM",
                        "Exame não reconhecido na área. Verifique o cadastro ou o nome digitado.",
                        confidence));
                }
            }
        }

        List<BatchSuggestionResult> result = new ArrayList<>(mismatchRows.size());
        for (int rowIndex : mismatchRows) {
            BatchSuggestionResult resolved = byRow.get(rowIndex);
            result.add(resolved != null ? resolved : new BatchSuggestionResult(
                rowIndex, "examName", "UNKNOWN_EXAM",
                "Exame não reconhecido na área. Verifique o cadastro ou o nome digitado.", 0.5));
        }
        return result;
    }

    /**
     * {@code readinessScore} = fracao de linhas SEM nenhuma sugestao, em [0,1].
     * Lote vazio devolve {@code 1.0} (nada pendente).
     */
    private double computeReadinessScore(int totalRows, List<BatchSuggestionResult> suggestions) {
        if (totalRows <= 0) {
            return 1.0;
        }
        java.util.Set<Integer> rowsWithIssue = new java.util.HashSet<>();
        for (BatchSuggestionResult suggestion : suggestions) {
            rowsWithIssue.add(suggestion.row());
        }
        int clean = totalRows - rowsWithIssue.size();
        return (double) clean / (double) totalRows;
    }

    private double clampConfidence(double value) {
        if (Double.isNaN(value)) {
            return 0.5;
        }
        return Math.max(0.0, Math.min(1.0, value));
    }

    /** Normaliza nome de exame para comparacao: trim + minusculas (Locale ROOT). */
    private String normalizeExam(String name) {
        return name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * Resultado interno de {@link #validateBatch}, desacoplado dos DTOs de HTTP.
     * O controlador mapeia para {@code BatchValidationResponse}.
     */
    public record BatchValidationResult(
        List<BatchSuggestionResult> suggestions,
        double readinessScore
    ) {
    }

    /** Uma sugestao assistiva para uma linha do lote (indice 0-based). */
    public record BatchSuggestionResult(
        int row,
        String field,
        String issue,
        String suggestion,
        double confidence
    ) {
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

package com.biodiagnostico.service.ai;

import java.util.List;

/**
 * Abstracao de provedor de IA. Isola {@code AiService} (regra de negocio,
 * rate-limit, prompts auditados, metricas) do provedor concreto (hoje
 * {@link OpenAiProvider}).
 *
 * <p>Implementacoes devem lancar {@link com.biodiagnostico.exception.BusinessException}
 * para falhas determinnsticas e claras ao usuario (ex.: API key ausente,
 * resposta vazia) e propagar {@link java.io.IOException}/{@link RuntimeException}
 * de transporte para a camada superior decidir o tratamento.
 */
public interface AiProvider {

    /**
     * Completa um chat de texto.
     *
     * @param model      id do modelo a usar (resolvido pelo {@link AiModelRouter})
     * @param messages   mensagens da conversa (system/user)
     * @param jsonOutput quando {@code true}, solicita ao provedor que a resposta
     *                   seja um objeto JSON valido (response_format json_object)
     * @return o texto da resposta (nunca vazio; vazio resulta em excecao)
     * @throws java.io.IOException em falha de parsing/transporte
     */
    String completeText(String model, List<AiMessage> messages, boolean jsonOutput) throws java.io.IOException;

    /**
     * Completa uma requisicao multimodal de audio (audio + instrucao textual),
     * tipicamente retornando JSON com os campos extraidos.
     *
     * @param model       id do modelo de audio a usar
     * @param prompt      instrucao textual que acompanha o audio
     * @param audioBase64 audio codificado em base64
     * @param audioFormat formato do audio (ex.: {@code "wav"}, {@code "mp3"})
     * @return o texto da resposta (tipicamente JSON; nunca vazio)
     * @throws java.io.IOException em falha de parsing/transporte
     */
    String completeAudio(String model, String prompt, String audioBase64, String audioFormat)
        throws java.io.IOException;
}

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
     * Completa um chat de texto em modo <strong>streaming</strong>, repassando
     * cada pedaco (delta) de texto ao {@code onDelta} a medida que chega.
     *
     * <p>Implementacao default (aditiva): nao streama de verdade — chama
     * {@link #completeText(String, List, boolean)} e emite a resposta inteira
     * como um unico delta. Provedores que suportam streaming (ex.:
     * {@link OpenAiProvider}) sobrescrevem este metodo para emitir os deltas
     * incrementalmente. Esse default permite que mocks/stubs de teste e provedores
     * sem streaming continuem funcionando sem reimplementar nada.
     *
     * <p><strong>Semantica de {@code onDelta}:</strong> a concatenacao, na ordem,
     * de todos os pedacos recebidos forma o texto completo da resposta. Erros
     * deterministicos (ex.: API key ausente) devem ser lancados ANTES de qualquer
     * emissao; falhas de transporte propagam como {@link java.io.IOException}/
     * {@link RuntimeException}.
     *
     * @param model    id do modelo a usar (resolvido pelo {@link AiModelRouter})
     * @param messages mensagens da conversa (system/user/assistant)
     * @param onDelta  consumidor chamado para cada pedaco de texto recebido
     * @throws java.io.IOException em falha de parsing/transporte
     */
    default void completeTextStream(String model, List<AiMessage> messages,
        java.util.function.Consumer<String> onDelta) throws java.io.IOException {
        onDelta.accept(completeText(model, messages, false));
    }

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

    /**
     * Completa uma requisicao multimodal de visao (imagem + instrucao textual),
     * tipicamente retornando JSON com os dados do visor/termometro extraidos.
     *
     * @param model       id do modelo de visao a usar
     * @param prompt      instrucao textual que acompanha a imagem
     * @param imageBase64 imagem codificada em base64
     * @param mimeType    tipo MIME da imagem (ex.: {@code "image/jpeg"}, {@code "image/png"})
     * @return o texto da resposta (tipicamente JSON; nunca vazio)
     * @throws java.io.IOException em falha de parsing/transporte
     */
    default String completeVision(String model, String prompt, String imageBase64, String mimeType)
        throws java.io.IOException {
        throw new UnsupportedOperationException("Visao computacional nao suportada neste provedor.");
    }
}

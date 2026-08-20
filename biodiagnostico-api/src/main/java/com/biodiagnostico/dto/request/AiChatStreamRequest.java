package com.biodiagnostico.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Onda 4 / Fase A (parte 2) — Requisicao do chat assistivo por STREAMING
 * (endpoint {@code POST /api/ai/analyze/stream}).
 *
 * <p>Diferente do {@code AiAnalysisRequest} bloqueante (um unico prompt), este
 * carrega a conversa MULTI-TURNO ({@code messages}) com papeis {@code user}/
 * {@code assistant}. A mensagem {@code system} e SEMPRE montada pelo backend
 * (no {@code AiService}); o cliente NAO pode envia-la — {@code role="system"}
 * e rejeitado com 400.
 *
 * <p>O contexto factual ({@code area}/{@code examName}/{@code days}) e usado pelo
 * controlador para montar, de forma deterministica e read-only, o contexto da
 * area via {@code AiContextAssembler.assembleAnalysisContext(...)}; numeros
 * sempre vem do backend, nunca do cliente.
 *
 * <p><strong>Validacoes (todas retornam 400 ANTES de abrir o SseEmitter):</strong>
 * <ul>
 *   <li>{@code messages}: 1 a 21 itens;</li>
 *   <li>cada {@code role} ∈ {{@code user}, {@code assistant}} ({@code system} proibido);</li>
 *   <li>cada {@code content} nao-branco e ≤ 4000 caracteres;</li>
 *   <li>a ULTIMA mensagem deve ter {@code role="user"};</li>
 *   <li>soma dos {@code content} ≤ 24000 caracteres.</li>
 * </ul>
 *
 * @param messages conversa multi-turno (historico + pergunta atual), na ordem
 * @param area     area de CQ opcional; quando presente, o controlador monta o
 *     contexto factual da area
 * @param examName exame opcional (refina o contexto da area)
 * @param days     janela em dias opcional para o contexto da area
 */
public record AiChatStreamRequest(
    @NotEmpty(message = "A conversa deve conter ao menos uma mensagem")
    @Size(max = 21, message = "A conversa não pode exceder 21 mensagens")
    @Valid
    List<ChatMessageDto> messages,
    String area,
    String examName,
    Integer days
) {

    /** Soma maxima de caracteres de todos os {@code content} da conversa. */
    private static final int MAX_TOTAL_CONTENT = 24_000;

    /**
     * A ultima mensagem da conversa deve ser do usuario (a pergunta atual). Sem
     * isso a IA estaria "respondendo a si mesma". Pula a checagem quando a lista
     * e vazia/nula (ja sinalizada por {@link NotEmpty}) para nao duplicar erro.
     */
    @AssertTrue(message = "A última mensagem da conversa deve ter role=user")
    public boolean isLastMessageFromUser() {
        if (messages == null || messages.isEmpty()) {
            return true;
        }
        ChatMessageDto last = messages.get(messages.size() - 1);
        return last != null && ChatMessageDto.ROLE_USER.equals(last.role());
    }

    /**
     * Limita o tamanho TOTAL da conversa (soma dos {@code content}) para conter
     * custo/latencia do provedor, independente do limite por mensagem.
     */
    @AssertTrue(message = "A soma do conteúdo das mensagens não pode exceder 24000 caracteres")
    public boolean isTotalContentWithinLimit() {
        if (messages == null) {
            return true;
        }
        long total = 0;
        for (ChatMessageDto message : messages) {
            if (message != null && message.content() != null) {
                total += message.content().length();
            }
        }
        return total <= MAX_TOTAL_CONTENT;
    }

    /**
     * Uma mensagem da conversa de chat. {@code role} restrito a {@code user}/
     * {@code assistant} (o backend injeta o {@code system}); {@code content}
     * nao-branco e ≤ 4000 caracteres.
     *
     * @param role    papel: {@code "user"} ou {@code "assistant"}
     * @param content texto da mensagem
     */
    public record ChatMessageDto(
        @jakarta.validation.constraints.Pattern(
            regexp = "user|assistant",
            message = "role deve ser 'user' ou 'assistant'")
        @NotBlank(message = "role é obrigatório")
        String role,
        @NotBlank(message = "content não pode ser vazio")
        @Size(max = 4000, message = "content não pode exceder 4000 caracteres")
        String content
    ) {

        /** Papel de usuario — usado na checagem da ultima mensagem. */
        public static final String ROLE_USER = "user";

        /** Papel de assistente (turnos anteriores do modelo no historico). */
        public static final String ROLE_ASSISTANT = "assistant";
    }
}

package com.biodiagnostico.service.ai;

/**
 * Mensagem de uma conversa de IA no formato chat (estilo OpenAI Chat
 * Completions).
 *
 * @param role    papel da mensagem: {@code "system"}, {@code "user"} ou
 *                {@code "assistant"}
 * @param content conteudo textual da mensagem
 */
public record AiMessage(String role, String content) {

    public static AiMessage system(String content) {
        return new AiMessage("system", content);
    }

    public static AiMessage user(String content) {
        return new AiMessage("user", content);
    }

    /**
     * Mensagem do papel {@code assistant} — usada para reconstituir o historico
     * de uma conversa (turnos anteriores do modelo) em chamadas de streaming.
     */
    public static AiMessage assistant(String content) {
        return new AiMessage("assistant", content);
    }
}

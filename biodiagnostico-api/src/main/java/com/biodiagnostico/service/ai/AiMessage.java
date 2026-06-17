package com.biodiagnostico.service.ai;

/**
 * Mensagem de uma conversa de IA no formato chat (estilo OpenAI Chat
 * Completions).
 *
 * @param role    papel da mensagem: {@code "system"} ou {@code "user"}
 * @param content conteudo textual da mensagem
 */
public record AiMessage(String role, String content) {

    public static AiMessage system(String content) {
        return new AiMessage("system", content);
    }

    public static AiMessage user(String content) {
        return new AiMessage("user", content);
    }
}

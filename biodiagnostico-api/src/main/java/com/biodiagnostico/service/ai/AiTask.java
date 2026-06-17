package com.biodiagnostico.service.ai;

/**
 * Tarefas de IA suportadas pelo sistema. Cada tarefa e roteada para um tier de
 * modelo via {@link AiModelRouter}, desacoplando a logica de negocio (em
 * {@code AiService}) do modelo concreto configurado.
 *
 * <p>{@code REPORT_COMMENTARY} (comentario textual de relatorios V2) reutiliza
 * {@link #CHAT}; nao ha tarefa dedicada porque o commentator chama
 * {@code AiService.analyze}, que ja resolve via {@code CHAT}.
 */
public enum AiTask {
    EXPLAIN_VIOLATION,
    INTERPRET_TREND,
    SUGGEST_OBSERVATION,
    BATCH_VALIDATION,
    CHAT,
    VOICE_FORM,
    EXECUTIVE_SUMMARY,
    AUDIT_SUMMARY,
    ROOT_CAUSE,
    PRIORITIES
}

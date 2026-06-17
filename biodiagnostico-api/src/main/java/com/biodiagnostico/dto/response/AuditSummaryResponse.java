package com.biodiagnostico.dto.response;

/**
 * C10 — Sumarizacao de audit logs (assistivo, read-only; restrito a ADMIN).
 *
 * @param summary resumo em PT-BR por categoria + destaque de anomalias gerado
 *     pela IA a partir dos logs do periodo; descreve o que esta no log, nao
 *     inventa eventos
 */
public record AuditSummaryResponse(String summary) {
}

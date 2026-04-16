package com.biodiagnostico.entity;

import java.util.Set;

/**
 * Motivo canonico de uma movimentacao de estoque.
 *
 * Obrigatorio para {@code AJUSTE} — garante auditoria sobre por que o estoque
 * foi alterado manualmente — e recomendado para {@code SAIDA} que zere o
 * estoque. Campo novo em Fase 2 da rastreabilidade de Reagentes.
 */
public final class MovementReason {

    public static final String CONTAGEM_FISICA = "CONTAGEM_FISICA";
    public static final String QUEBRA = "QUEBRA";
    public static final String CONTAMINACAO = "CONTAMINACAO";
    public static final String CORRECAO = "CORRECAO";
    public static final String VENCIMENTO = "VENCIMENTO";
    public static final String OUTRO = "OUTRO";

    public static final Set<String> ALL = Set.of(
        CONTAGEM_FISICA, QUEBRA, CONTAMINACAO, CORRECAO, VENCIMENTO, OUTRO);

    private MovementReason() {
        // utilitaria
    }

    public static boolean isValid(String value) {
        return value != null && ALL.contains(value);
    }

    public static String normalize(String value) {
        return value == null ? null : value.trim().toUpperCase();
    }

    public static String humanList() {
        return String.join(", ", CONTAGEM_FISICA, QUEBRA, CONTAMINACAO, CORRECAO, VENCIMENTO, OUTRO);
    }
}

package com.biodiagnostico.entity;

import java.util.Set;

/**
 * Tipos suportados de {@link StockMovement}.
 *
 * Armazenados em maiusculas no banco para bater com o switch ja existente no
 * servico e com os eventos emitidos pelo frontend.
 */
public final class MovementType {

    public static final String ENTRADA = "ENTRADA";
    public static final String SAIDA = "SAIDA";
    public static final String AJUSTE = "AJUSTE";

    public static final Set<String> ALL = Set.of(ENTRADA, SAIDA, AJUSTE);

    private MovementType() {
        // utilitaria
    }

    public static boolean isValid(String value) {
        return value != null && ALL.contains(value);
    }

    public static String normalize(String value) {
        return value == null ? null : value.trim().toUpperCase();
    }

    public static String humanList() {
        return String.join(", ", ENTRADA, SAIDA, AJUSTE);
    }
}

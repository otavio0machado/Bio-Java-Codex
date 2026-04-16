package com.biodiagnostico.entity;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Status permitidos para um {@link ReagentLot}.
 *
 * O banco ja guarda os valores em minusculas ({@code "ativo"}, {@code "em_uso"}, etc) e muda-los
 * quebraria consumidores existentes. Por isso o contrato publico continua usando String,
 * mas esta classe concentra a lista canonica e o metodo {@link #isValid(String)} para validacao
 * no servico.
 */
public final class ReagentStatus {

    public static final String ATIVO = "ativo";
    public static final String EM_USO = "em_uso";
    public static final String INATIVO = "inativo";
    public static final String VENCIDO = "vencido";
    public static final String QUARENTENA = "quarentena";

    public static final Set<String> ALL = Set.of(ATIVO, EM_USO, INATIVO, VENCIDO, QUARENTENA);

    private ReagentStatus() {
        // utilitaria
    }

    public static boolean isValid(String value) {
        return value != null && ALL.contains(value);
    }

    public static String normalize(String value) {
        return value == null ? null : value.trim().toLowerCase();
    }

    public static String humanList() {
        return Arrays.stream(new String[] {ATIVO, EM_USO, INATIVO, VENCIDO, QUARENTENA})
            .collect(Collectors.joining(", "));
    }
}

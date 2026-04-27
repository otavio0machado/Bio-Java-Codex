package com.biodiagnostico.entity;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Status canonicos para um {@link ReagentLot} apos o refator v2.
 *
 * Conjunto vigente: {@code em_estoque}, {@code em_uso}, {@code fora_de_estoque}, {@code vencido}.
 *
 * <p>O conjunto antigo {@code ativo}, {@code em_uso}, {@code inativo}, {@code vencido},
 * {@code quarentena} foi descontinuado pela migracao V13 (refator-reagentes-v2). Os
 * status legados nao sao mais aceitos pelo dominio: V13 reclassifica todas as linhas e
 * uma CHECK constraint impede insercoes futuras.</p>
 *
 * <p>O contrato externo continua usando String porque audit_log historico cita
 * literais como {@code "ativo"} e {@code "inativo"} (preservados). Esta classe concentra
 * a lista canonica e as utilidades de validacao usadas pelo servico, scheduler e generators.</p>
 */
public final class ReagentStatus {

    public static final String EM_ESTOQUE = "em_estoque";
    public static final String EM_USO = "em_uso";
    public static final String FORA_DE_ESTOQUE = "fora_de_estoque";
    public static final String VENCIDO = "vencido";

    public static final Set<String> ALL = Set.of(EM_ESTOQUE, EM_USO, FORA_DE_ESTOQUE, VENCIDO);

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
        return Arrays.stream(new String[] {EM_ESTOQUE, EM_USO, FORA_DE_ESTOQUE, VENCIDO})
            .collect(Collectors.joining(", "));
    }
}

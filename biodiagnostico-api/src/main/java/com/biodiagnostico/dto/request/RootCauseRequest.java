package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * A3 — Requisicao de analise de causa-raiz correlacionada de um registro de CQ.
 *
 * @param recordId UUID (chave primaria de {@code QcRecord}); UUID malformado
 *     resulta em 400, registro inexistente em 404
 */
public record RootCauseRequest(
    @NotNull UUID recordId
) {
}

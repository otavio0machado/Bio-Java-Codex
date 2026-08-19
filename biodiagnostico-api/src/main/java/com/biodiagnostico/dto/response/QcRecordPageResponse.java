package com.biodiagnostico.dto.response;

import java.util.List;

/**
 * Pagina keyset de registros de CQ. O cursor e opaco para que o cliente nao
 * dependa dos campos usados na ordenacao.
 */
public record QcRecordPageResponse(
    List<QcRecordResponse> items,
    String nextCursor,
    boolean hasNext,
    int size
) {
}

package com.biodiagnostico.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * B5 — Requisicao de validacao inteligente (assistiva) de um lote de importacao
 * de CQ, ANTES de importar.
 *
 * <p><strong>Read-only:</strong> apenas analisa as linhas e devolve sugestoes
 * para revisao humana. NAO importa, NAO grava, NAO decide aprovar/reprovar.
 *
 * @param area area de CQ das linhas (ex.: {@code "bioquimica"}); usada para
 *             resolver a lista de exames cadastrados/ativos contra a qual os
 *             nomes das linhas sao conferidos
 * @param rows linhas do lote a validar; cada {@link BatchRowDto} espelha os
 *             campos de uma linha de importacao de CQ
 */
public record BatchValidationRequest(
    @NotBlank String area,
    @NotEmpty @Valid List<BatchRowDto> rows
) {

    /**
     * Linha de um lote de importacao de CQ, no formato que o frontend ja envia
     * para {@code /api/qc-records/batch} (espelha {@link QcRecordRequest}).
     *
     * <p>Todos os campos podem ser {@code null}: a validacao estrutural justamente
     * sinaliza ausencias/implausibilidades. Nenhuma anotacao de obrigatoriedade
     * e aplicada aqui — o objetivo do endpoint e diagnosticar, nao rejeitar.
     *
     * @param examName    nome do exame (conferido, case-insensitive, contra os
     *                    exames ativos da area)
     * @param level       nivel do controle (ex.: {@code "Normal"}, {@code "N1"})
     * @param value       valor medido do controle
     * @param targetValue valor-alvo (media) da referencia
     * @param targetSd    desvio-padrao alvo da referencia
     * @param cvLimit     limite de CV% configurado (mesmo nome usado em
     *                    {@link QcRecordRequest#cvLimit()})
     */
    public record BatchRowDto(
        String examName,
        String level,
        Double value,
        Double targetValue,
        Double targetSd,
        Double cvLimit
    ) {
    }
}

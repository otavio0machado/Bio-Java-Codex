package com.biodiagnostico.dto.reports.v2;

import java.time.Instant;

/**
 * Resposta publica do endpoint {@code GET /api/reports/v2/verify/{hash}}.
 * Contrato tras os dois hashes (original e pos-assinatura) para que o
 * cliente consiga confrontar com o PDF que tem em maos. Quando o hash nao
 * bate com nenhum registro, o endpoint retorna 200 com {@code valid=false}
 * e os demais campos nulos — isso e intencional, para clientes publicos
 * nao precisarem interpretar 404 para descobrir "esse PDF e meu?".
 *
 * @param reportNumber   numero legivel (ex.: BIO-202604-000001); null quando invalido
 * @param reportCode     codigo canonico do relatorio V2 (ex.: CQ_OPERATIONAL_V2)
 * @param periodLabel    rotulo humano do periodo (ex.: "Abril/2026")
 * @param generatedAt    timestamp de geracao original
 * @param generatedByName nome do usuario que gerou o laudo (pode ser username tecnico)
 * @param sha256         hash do PDF original (pre-assinatura)
 * @param signatureHash  hash da versao assinada; null se ainda nao foi assinado
 * @param signedAt       timestamp da assinatura; null se nao assinado
 * @param signedByName   responsavel tecnico que assinou (vem do signature log)
 * @param signed         atalho: true se existe signature_hash + signed_at
 * @param status         estado enumerado da verificacao:
 *                       {@code VALID_SIGNED} | {@code VALID_UNSIGNED} |
 *                       {@code SUPERSEDED} | {@code NOT_FOUND}. SUPERSEDED indica
 *                       que o hash informado e o sha256 original de um run que ja
 *                       foi assinado (logo o PDF em maos e a versao pre-assinatura,
 *                       superada pela versao assinada)
 * @param valid          derivado: {@code true} apenas quando status e
 *                       VALID_SIGNED ou VALID_UNSIGNED
 */
public record VerifyReportResponse(
    String reportNumber,
    String reportCode,
    String periodLabel,
    Instant generatedAt,
    String generatedByName,
    String sha256,
    String signatureHash,
    Instant signedAt,
    String signedByName,
    boolean signed,
    String status,
    boolean valid
) {}

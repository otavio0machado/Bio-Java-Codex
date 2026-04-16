package com.biodiagnostico.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

/**
 * Uma execucao do gerador de relatorios ({@code /api/reports/*}).
 *
 * Fica fora do fluxo quente: o controller grava em sucesso ou falha com o
 * minimo de info para auditoria, historico e comprovacao de quem/quando gerou
 * o PDF com qual hash.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "report_runs")
public class ReportRun {

    @Id
    private UUID id;

    @Column(nullable = false, length = 32)
    private String type;

    @Column(length = 64)
    private String area;

    @Column(name = "period_type", length = 16)
    private String periodType;

    @Column(name = "month")
    private Integer month;

    @Column(name = "year")
    private Integer year;

    @Column(name = "report_number", length = 64)
    private String reportNumber;

    @Column(length = 128)
    private String sha256;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(nullable = false, length = 16)
    private String status;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "user_id")
    private UUID userId;

    @Column(length = 128)
    private String username;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

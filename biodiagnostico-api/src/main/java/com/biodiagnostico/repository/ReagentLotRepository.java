package com.biodiagnostico.repository;

import com.biodiagnostico.entity.ReagentLot;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReagentLotRepository extends JpaRepository<ReagentLot, UUID> {

    /**
     * Projection do agregado por etiqueta. A coluna do banco continua sendo {@code name}
     * (vide refator-reagentes-v2 §1.1). O getter {@link #getLabel()} expoe o valor sob
     * a semantica nova; {@link #getName()} permanece como alias para compatibilidade
     * temporaria com o endpoint {@code /api/reagents/tags} (removido em PR-4).
     */
    interface ReagentLabelSummaryProjection {
        String getLabel();
        /** Alias legado — mesmo valor de {@link #getLabel()}. */
        String getName();
        long getTotal();
        long getEmEstoque();
        long getEmUso();
        long getForaDeEstoque();
        long getVencidos();
    }

    List<ReagentLot> findAllByOrderByCreatedAtDesc();

    List<ReagentLot> findByCategory(String category);

    List<ReagentLot> findByStatus(String status);

    @Query("SELECT r FROM ReagentLot r WHERE (:category IS NULL OR r.category = :category) AND (:status IS NULL OR r.status = :status) ORDER BY r.createdAt DESC")
    List<ReagentLot> findByFilters(@Param("category") String category, @Param("status") String status);

    List<ReagentLot> findByLotNumberIgnoreCase(String lotNumber);

    /**
     * Usado em updateLot para garantir que a mudanca de (lotNumber, manufacturer)
     * nao colida com outro lote ja existente.
     */
    @Query("""
        SELECT r FROM ReagentLot r
        WHERE LOWER(r.lotNumber) = LOWER(:lotNumber)
          AND LOWER(COALESCE(r.manufacturer, '')) = LOWER(COALESCE(:manufacturer, ''))
        """)
    List<ReagentLot> findByLotNumberAndManufacturer(
        @Param("lotNumber") String lotNumber,
        @Param("manufacturer") String manufacturer);

    /**
     * Retorna lotes cuja validade ja passou e cujo status ainda nao foi reclassificado
     * pela regra ternaria. Apos o refator-v2, o unico estado terminal de validade e
     * {@code vencido} — todos os demais sao candidatos a reclassificacao no scheduler
     * diario. Status {@code fora_de_estoque} continua sendo candidato (lote vencido
     * mesmo sem estoque deve ficar como {@code vencido}, semantica nova canonica).
     */
    @Query("SELECT r FROM ReagentLot r WHERE r.expiryDate < :today AND r.status <> 'vencido'")
    List<ReagentLot> findExpiredNeedingReclassification(@Param("today") LocalDate today);

    @Query("""
        SELECT r FROM ReagentLot r
        WHERE r.expiryDate BETWEEN :startDate AND :endDate
          AND r.status NOT IN ('vencido', 'fora_de_estoque')
        ORDER BY r.expiryDate ASC
        """)
    List<ReagentLot> findExpiringLots(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    /**
     * Janela ampla para reports V2 (inclui vencidos/fora_de_estoque para tabelas de
     * auditoria). Ordena por data de expiry para tabelas no PDF.
     */
    @Query("""
        SELECT r FROM ReagentLot r
        WHERE r.expiryDate BETWEEN :s AND :e
        ORDER BY r.expiryDate ASC
        """)
    List<ReagentLot> findExpiringInWindow(@Param("s") LocalDate s, @Param("e") LocalDate e);

    /**
     * Lotes ja vencidos que ainda possuem estoque. Alerta regulatorio critico para
     * reports de rastreabilidade e consolidado multi-area.
     */
    @Query("""
        SELECT r FROM ReagentLot r
        WHERE r.status = 'vencido'
          AND r.currentStock IS NOT NULL
          AND r.currentStock > 0
        ORDER BY r.expiryDate ASC
        """)
    List<ReagentLot> findExpiredWithStock();

    /**
     * Contagem rapida de lotes vencidos com estoque. Usada em headers/cards do
     * consolidado multi-area sem carregar entidades.
     */
    @Query("""
        SELECT COUNT(r) FROM ReagentLot r
        WHERE r.expiryDate IS NOT NULL
          AND r.expiryDate < :today
          AND r.currentStock IS NOT NULL
          AND r.currentStock > 0
        """)
    long countExpiredWithStock(@Param("today") LocalDate today);

    @Query("""
        SELECT COUNT(r) FROM ReagentLot r
        WHERE r.expiryDate BETWEEN :startDate AND :endDate
          AND r.status NOT IN ('vencido', 'fora_de_estoque')
        """)
    long countExpiringLots(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    /**
     * Agrega lotes por etiqueta ({@code name}) com contagens por status novo. A coluna
     * {@code name} permanece no banco como agrupador de etiqueta (decisao 1.1 do contrato).
     */
    @Query("""
        SELECT
          r.name AS label,
          r.name AS name,
          COUNT(r) AS total,
          SUM(CASE WHEN r.status = 'em_estoque' THEN 1 ELSE 0 END) AS emEstoque,
          SUM(CASE WHEN r.status = 'em_uso' THEN 1 ELSE 0 END) AS emUso,
          SUM(CASE WHEN r.status = 'fora_de_estoque' THEN 1 ELSE 0 END) AS foraDeEstoque,
          SUM(CASE WHEN r.status = 'vencido' THEN 1 ELSE 0 END) AS vencidos
        FROM ReagentLot r
        GROUP BY r.name
        ORDER BY r.name
        """)
    List<ReagentLabelSummaryProjection> findLabelSummaries();

    /**
     * Alias compat para o endpoint deprecated {@code /api/reagents/tags}. Delega na
     * mesma projection — o controller mapeia para o shape antigo {@code ReagentTagSummary}.
     */
    default List<ReagentLabelSummaryProjection> findTagSummaries() {
        return findLabelSummaries();
    }
}

package com.biodiagnostico.repository;

import com.biodiagnostico.entity.ReagentLot;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReagentLotRepository extends JpaRepository<ReagentLot, UUID> {

    interface ReagentTagSummaryProjection {
        String getName();
        long getTotal();
        long getAtivos();
        long getEmUso();
        long getInativos();
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
     * Retorna lotes ja vencidos cujo status pode precisar de reclassificacao pelo
     * scheduler. Exclui:
     *  - {@code inativo}: estado terminal (acabou e passou da validade) — ja estavel.
     *  - {@code quarentena}: estado manual de excecao — preserva regra laboratorial.
     *
     * O scheduler passa cada resultado por {@code deriveStatus} para decidir o novo
     * valor (vencido quando tem estoque, inativo quando zerou).
     */
    @Query("SELECT r FROM ReagentLot r WHERE r.expiryDate < :today AND r.status NOT IN ('inativo', 'quarentena')")
    List<ReagentLot> findExpiredNeedingReclassification(@Param("today") LocalDate today);

    @Query("""
        SELECT r FROM ReagentLot r
        WHERE r.expiryDate BETWEEN :startDate AND :endDate
          AND r.status NOT IN ('vencido', 'inativo')
        ORDER BY r.expiryDate ASC
        """)
    List<ReagentLot> findExpiringLots(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    /**
     * T5 — janela ampla para reports V2 (inclui inativos/vencidos para
     * tabelas de auditoria). Ordena por data de expiry para tabelas no PDF.
     */
    @Query("""
        SELECT r FROM ReagentLot r
        WHERE r.expiryDate BETWEEN :s AND :e
        ORDER BY r.expiryDate ASC
        """)
    List<ReagentLot> findExpiringInWindow(@Param("s") LocalDate s, @Param("e") LocalDate e);

    /**
     * T5 — lotes ja vencidos que ainda possuem estoque. Alerta regulatorio
     * critico para reports de rastreabilidade e consolidado multi-area.
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
     * T5 — contagem rapida de lotes vencidos com estoque. Usada em
     * headers/cards do consolidado multi-area sem carregar entidades.
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
          AND r.status NOT IN ('vencido', 'inativo')
        """)
    long countExpiringLots(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("""
        SELECT
          r.name AS name,
          COUNT(r) AS total,
          SUM(CASE WHEN r.status = 'ativo' THEN 1 ELSE 0 END) AS ativos,
          SUM(CASE WHEN r.status = 'em_uso' THEN 1 ELSE 0 END) AS emUso,
          SUM(CASE WHEN r.status = 'inativo' THEN 1 ELSE 0 END) AS inativos,
          SUM(CASE WHEN r.status = 'vencido' THEN 1 ELSE 0 END) AS vencidos
        FROM ReagentLot r
        GROUP BY r.name
        ORDER BY r.name
        """)
    List<ReagentTagSummaryProjection> findTagSummaries();
}

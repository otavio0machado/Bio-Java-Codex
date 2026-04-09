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

    @Query("SELECT r FROM ReagentLot r WHERE r.expiryDate < :today AND r.status <> 'vencido'")
    List<ReagentLot> findExpiredNotMarked(@Param("today") LocalDate today);

    @Query("""
        SELECT r FROM ReagentLot r
        WHERE r.expiryDate BETWEEN :startDate AND :endDate
          AND r.status <> 'vencido'
        ORDER BY r.expiryDate ASC
        """)
    List<ReagentLot> findExpiringLots(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

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

package com.biodiagnostico.repository;

import com.biodiagnostico.entity.WestgardViolation;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WestgardViolationRepository extends JpaRepository<WestgardViolation, UUID> {

    List<WestgardViolation> findByQcRecordId(UUID qcRecordId);

    @Query("""
        SELECT w FROM WestgardViolation w
        JOIN FETCH w.qcRecord qr
        WHERE w.severity = 'REJECTION'
          AND w.createdAt >= :start
        ORDER BY w.createdAt DESC
        """)
    List<WestgardViolation> findRecentRejections(@Param("start") Instant start);

    @Query("""
        SELECT COUNT(DISTINCT w.qcRecord.id) FROM WestgardViolation w
        WHERE w.severity = 'REJECTION'
          AND w.createdAt >= :start
        """)
    long countDistinctRejectedRecords(@Param("start") Instant start);
}

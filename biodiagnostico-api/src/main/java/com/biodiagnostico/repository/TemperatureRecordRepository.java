package com.biodiagnostico.repository;

import com.biodiagnostico.entity.TemperatureRecord;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TemperatureRecordRepository extends JpaRepository<TemperatureRecord, UUID> {

    List<TemperatureRecord> findByLocationIdOrderByDateDescTimeDesc(UUID locationId);

    List<TemperatureRecord> findByLocationIdAndDate(UUID locationId, LocalDate date);

    Optional<TemperatureRecord> findByLocationIdAndDateAndPeriod(UUID locationId, LocalDate date, String period);

    @Query("""
        SELECT r FROM TemperatureRecord r
        JOIN FETCH r.location loc
        WHERE r.date BETWEEN :startDate AND :endDate
          AND (:locationId IS NULL OR loc.id = :locationId)
          AND (:status IS NULL OR r.status = :status)
        ORDER BY r.date DESC, r.time DESC
        """)
    List<TemperatureRecord> findRecordsInPeriod(
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate,
        @Param("locationId") UUID locationId,
        @Param("status") String status
    );

    @Query("""
        SELECT r FROM TemperatureRecord r
        JOIN FETCH r.location loc
        WHERE r.date = :date
        ORDER BY loc.name ASC, r.time ASC
        """)
    List<TemperatureRecord> findByDateWithLocation(@Param("date") LocalDate date);

    @Query("""
        SELECT r FROM TemperatureRecord r
        JOIN FETCH r.location loc
        WHERE loc.id = :locationId
          AND r.date BETWEEN :startDate AND :endDate
        ORDER BY r.date ASC, r.time ASC
        """)
    List<TemperatureRecord> findByLocationAndDateRange(
        @Param("locationId") UUID locationId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    @Query("""
        SELECT COUNT(r) FROM TemperatureRecord r
        WHERE r.date = :date
        """)
    long countRecordsOnDate(@Param("date") LocalDate date);

    @Query("""
        SELECT COUNT(r) FROM TemperatureRecord r
        WHERE r.date = :date AND r.status = 'NAO_CONFORME'
        """)
    long countNonCompliantOnDate(@Param("date") LocalDate date);

    @Query("""
        SELECT COUNT(r) FROM TemperatureRecord r
        WHERE r.date BETWEEN :startDate AND :endDate AND r.status = 'NAO_CONFORME'
        """)
    long countNonCompliantBetween(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
}

package com.biodiagnostico.repository;

import com.biodiagnostico.entity.TemperatureLocation;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TemperatureLocationRepository extends JpaRepository<TemperatureLocation, UUID> {

    List<TemperatureLocation> findByActiveTrueOrderByNameAsc();

    List<TemperatureLocation> findByActiveOrderByNameAsc(boolean active);

    List<TemperatureLocation> findAllByOrderByNameAsc();

    Optional<TemperatureLocation> findByCode(String code);

    List<TemperatureLocation> findByCategoryAndActiveTrue(String category);

    List<TemperatureLocation> findByAreaIgnoreCaseAndActiveOrderByNameAsc(String area, boolean active);

    List<TemperatureLocation> findByAreaIgnoreCaseOrderByNameAsc(String area);

    @Query("""
        SELECT loc FROM TemperatureLocation loc
        WHERE loc.calibrationDueDate IS NOT NULL
          AND loc.calibrationDueDate <= :limitDate
          AND loc.active = TRUE
        ORDER BY loc.calibrationDueDate ASC
        """)
    List<TemperatureLocation> findExpiringCalibrations(@Param("limitDate") LocalDate limitDate);
}

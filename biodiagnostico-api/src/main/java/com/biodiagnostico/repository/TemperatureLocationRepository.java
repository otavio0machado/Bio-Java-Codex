package com.biodiagnostico.repository;

import com.biodiagnostico.entity.TemperatureLocation;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TemperatureLocationRepository extends JpaRepository<TemperatureLocation, UUID> {

    List<TemperatureLocation> findByActiveTrueOrderByNameAsc();

    List<TemperatureLocation> findAllByOrderByNameAsc();

    Optional<TemperatureLocation> findByCode(String code);

    List<TemperatureLocation> findByCategoryAndActiveTrue(String category);

    List<TemperatureLocation> findByAreaAndActiveTrue(String area);

    @Query("""
        SELECT loc FROM TemperatureLocation loc
        WHERE (:area IS NULL OR LOWER(loc.area) = LOWER(:area))
          AND (:active IS NULL OR loc.active = :active)
        ORDER BY loc.name ASC
        """)
    List<TemperatureLocation> findWithFilters(
        @Param("area") String area,
        @Param("active") Boolean active
    );

    @Query("""
        SELECT loc FROM TemperatureLocation loc
        WHERE loc.calibrationDueDate IS NOT NULL
          AND loc.calibrationDueDate <= :limitDate
          AND loc.active = TRUE
        ORDER BY loc.calibrationDueDate ASC
        """)
    List<TemperatureLocation> findExpiringCalibrations(@Param("limitDate") java.time.LocalDate limitDate);
}

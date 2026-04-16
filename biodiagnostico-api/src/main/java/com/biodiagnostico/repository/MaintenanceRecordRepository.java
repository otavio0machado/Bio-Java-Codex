package com.biodiagnostico.repository;

import com.biodiagnostico.entity.MaintenanceRecord;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface MaintenanceRecordRepository extends JpaRepository<MaintenanceRecord, UUID> {

    List<MaintenanceRecord> findAllByOrderByDateDesc();

    List<MaintenanceRecord> findByEquipment(String equipment);

    @Query("""
        SELECT m FROM MaintenanceRecord m
        WHERE m.nextDate IS NOT NULL
          AND m.nextDate <= CURRENT_DATE
        ORDER BY m.nextDate ASC
        """)
    List<MaintenanceRecord> findPendingMaintenances();

    @Query("""
        SELECT COUNT(m) FROM MaintenanceRecord m
        WHERE m.nextDate IS NOT NULL
          AND m.nextDate <= CURRENT_DATE
        """)
    long countPendingMaintenances();
}

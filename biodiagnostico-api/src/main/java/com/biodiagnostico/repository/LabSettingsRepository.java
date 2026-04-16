package com.biodiagnostico.repository;

import com.biodiagnostico.entity.LabSettings;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LabSettingsRepository extends JpaRepository<LabSettings, UUID> {
    default Optional<LabSettings> findSingleton() {
        return findAll().stream().findFirst();
    }
}

package com.biodiagnostico.repository;

import com.biodiagnostico.entity.LabReportEmail;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LabReportEmailRepository extends JpaRepository<LabReportEmail, UUID> {
    List<LabReportEmail> findByIsActiveTrueOrderByEmailAsc();
}

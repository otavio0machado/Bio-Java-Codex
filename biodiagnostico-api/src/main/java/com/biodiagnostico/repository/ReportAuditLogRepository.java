package com.biodiagnostico.repository;

import com.biodiagnostico.entity.ReportAuditLog;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportAuditLogRepository extends JpaRepository<ReportAuditLog, UUID> {
}

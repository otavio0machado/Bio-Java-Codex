package com.biodiagnostico.repository;

import com.biodiagnostico.entity.ReportRun;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportRunRepository extends JpaRepository<ReportRun, UUID> {

    List<ReportRun> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<ReportRun> findByTypeOrderByCreatedAtDesc(String type, Pageable pageable);
}

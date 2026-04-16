package com.biodiagnostico.repository;

import com.biodiagnostico.entity.ImportRun;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImportRunRepository extends JpaRepository<ImportRun, UUID> {

    List<ImportRun> findAllByOrderByCreatedAtDesc(Pageable pageable);
}

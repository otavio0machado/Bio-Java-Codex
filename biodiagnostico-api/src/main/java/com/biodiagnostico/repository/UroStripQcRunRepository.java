package com.biodiagnostico.repository;

import com.biodiagnostico.entity.UroStripQcRun;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UroStripQcRunRepository extends JpaRepository<UroStripQcRun, UUID> {

    List<UroStripQcRun> findAllByOrderByDataMedicaoDescCreatedAtDesc();

    List<UroStripQcRun> findByDataMedicaoBetweenOrderByDataMedicaoDescCreatedAtDesc(
        LocalDate startDate,
        LocalDate endDate
    );

    List<UroStripQcRun> findByControlSetIdOrderByDataMedicaoDescCreatedAtDesc(UUID controlSetId);
}

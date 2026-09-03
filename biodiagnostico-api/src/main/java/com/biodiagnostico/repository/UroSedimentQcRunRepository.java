package com.biodiagnostico.repository;

import com.biodiagnostico.entity.UroSedimentQcRun;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UroSedimentQcRunRepository extends JpaRepository<UroSedimentQcRun, UUID> {

    List<UroSedimentQcRun> findAllByOrderByDataMedicaoDescCreatedAtDesc();

    List<UroSedimentQcRun> findByDataMedicaoBetweenOrderByDataMedicaoDescCreatedAtDesc(
        LocalDate startDate,
        LocalDate endDate
    );

    List<UroSedimentQcRun> findByPatientCodeIgnoreCaseOrderByDataMedicaoDescCreatedAtDesc(String patientCode);
}

package com.biodiagnostico.repository;

import com.biodiagnostico.entity.ImmunologyQcRun;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImmunologyQcRunRepository extends JpaRepository<ImmunologyQcRun, UUID> {

    List<ImmunologyQcRun> findAllByOrderByDataMedicaoDescCreatedAtDesc();

    List<ImmunologyQcRun> findByControlSetIdOrderByDataMedicaoDescCreatedAtDesc(UUID controlSetId);

    List<ImmunologyQcRun> findByDataMedicaoBetweenOrderByDataMedicaoDescCreatedAtDesc(LocalDate start, LocalDate end);
}

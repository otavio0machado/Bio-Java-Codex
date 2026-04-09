package com.biodiagnostico.repository;

import com.biodiagnostico.entity.HematologyBioRecord;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HematologyBioRecordRepository extends JpaRepository<HematologyBioRecord, UUID> {

    List<HematologyBioRecord> findAllByOrderByDataBioDesc();

    List<HematologyBioRecord> findByDataBioBetweenOrderByDataBioDesc(LocalDate start, LocalDate end);
}

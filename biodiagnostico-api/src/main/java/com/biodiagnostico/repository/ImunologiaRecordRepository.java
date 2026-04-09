package com.biodiagnostico.repository;

import com.biodiagnostico.entity.ImunologiaRecord;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImunologiaRecordRepository extends JpaRepository<ImunologiaRecord, UUID> {

    List<ImunologiaRecord> findAllByOrderByDataDesc();
}

package com.biodiagnostico.repository;

import com.biodiagnostico.entity.QcExam;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QcExamRepository extends JpaRepository<QcExam, UUID> {

    List<QcExam> findByAreaAndIsActiveTrue(String area);

    List<QcExam> findByIsActiveTrue();

    boolean existsByAreaIgnoreCaseAndNameIgnoreCase(String area, String name);

    boolean existsByAreaIgnoreCaseAndNameIgnoreCaseAndIdNot(String area, String name, UUID id);
}

package com.biodiagnostico.repository;

import com.biodiagnostico.entity.QcReferenceValue;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QcReferenceValueRepository extends JpaRepository<QcReferenceValue, UUID> {

    List<QcReferenceValue> findByExamIdAndIsActiveTrue(UUID examId);

    List<QcReferenceValue> findByIsActiveTrue();

    Optional<QcReferenceValue> findByExam_NameAndLevelAndIsActiveTrue(String examName, String level);

    List<QcReferenceValue> findByExam_NameIgnoreCaseAndExam_AreaIgnoreCaseAndLevelIgnoreCaseAndIsActiveTrue(
        String examName,
        String area,
        String level
    );
}

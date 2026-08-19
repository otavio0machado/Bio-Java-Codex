package com.biodiagnostico.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.biodiagnostico.entity.QcExam;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.QcReferenceValue;
import com.biodiagnostico.entity.WestgardViolation;
import com.biodiagnostico.service.QcService;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.hibernate.Hibernate;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.PageRequest;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("local")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class QcRecordRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private QcRecordRepository qcRecordRepository;

    @Autowired
    private WestgardViolationRepository westgardViolationRepository;

    @Autowired
    private PostCalibrationRecordRepository postCalibrationRecordRepository;

    @Test
    @DisplayName("deve buscar histórico Westgard apenas da mesma referência até a data informada")
    void shouldReturnOnlyHistoryFromSameReferenceUpToMeasurementDate() {
        QcExam exam = persistExam("Glicose", "bioquimica");
        QcReferenceValue primaryReference = persistReference(exam, "Ref atual", "L1");
        QcReferenceValue otherReference = persistReference(exam, "Outra referência", "L2");

        QcRecord oldestSameReference = persistRecord(primaryReference, "Glicose", "bioquimica", "Normal", "L1", LocalDate.of(2026, 4, 1));
        QcRecord newestSameReference = persistRecord(primaryReference, "Glicose", "bioquimica", "Normal", "L1", LocalDate.of(2026, 4, 4));
        persistRecord(primaryReference, "Glicose", "bioquimica", "Normal", "L1", LocalDate.of(2026, 4, 6));
        persistRecord(otherReference, "Glicose", "bioquimica", "Normal", "L2", LocalDate.of(2026, 4, 3));

        entityManager.flush();
        entityManager.clear();

        List<QcRecord> history = qcRecordRepository.findWestgardHistory(
            primaryReference.getId(),
            "Glicose",
            "Normal",
            "bioquimica",
            LocalDate.of(2026, 4, 4),
            null,
            PageRequest.of(0, 10)
        );

        assertThat(history)
            .extracting(QcRecord::getId)
            .containsExactly(newestSameReference.getId(), oldestSameReference.getId());
    }

    @Test
    @DisplayName("deve excluir o registro informado ao buscar histórico Westgard")
    void shouldExcludeRequestedRecordFromWestgardHistory() {
        QcExam exam = persistExam("Glicose", "bioquimica");
        QcReferenceValue reference = persistReference(exam, "Ref atual", "L1");

        QcRecord firstRecord = persistRecord(reference, "Glicose", "bioquimica", "Normal", "L1", LocalDate.of(2026, 4, 1));
        QcRecord recordToExclude = persistRecord(reference, "Glicose", "bioquimica", "Normal", "L1", LocalDate.of(2026, 4, 2));

        entityManager.flush();
        entityManager.clear();

        List<QcRecord> history = qcRecordRepository.findWestgardHistory(
            reference.getId(),
            "Glicose",
            "Normal",
            "bioquimica",
            LocalDate.of(2026, 4, 2),
            recordToExclude.getId(),
            PageRequest.of(0, 10)
        );

        assertThat(history)
            .extracting(QcRecord::getId)
            .containsExactly(firstRecord.getId());
    }

    @Test
    @DisplayName("deve paginar registros por keyset com filtros e referência materializada")
    void shouldReturnFilteredKeysetPagesWithReferenceFetched() {
        QcExam exam = persistExam("Glicose", "bioquimica");
        QcReferenceValue reference = persistReference(exam, "Ref atual", "L1");
        QcRecord oldest = persistRecord(
            reference, "Glicose", "bioquimica", "Normal", "L1", LocalDate.of(2026, 8, 17));
        QcRecord middle = persistRecord(
            reference, "Glicose", "bioquimica", "Normal", "L1", LocalDate.of(2026, 8, 18));
        QcRecord newest = persistRecord(
            reference, "Glicose", "bioquimica", "Normal", "L1", LocalDate.of(2026, 8, 19));
        persistRecord(reference, "Ureia", "bioquimica", "Normal", "L1", LocalDate.of(2026, 8, 20));

        entityManager.flush();
        entityManager.clear();

        List<QcRecord> firstPage = qcRecordRepository.findPageByFilters(
            "bioquimica", "lic", null, null, "APROVADO", "normal", PageRequest.of(0, 2));

        assertThat(firstPage).extracting(QcRecord::getId)
            .containsExactly(newest.getId(), middle.getId());
        assertThat(Hibernate.isInitialized(firstPage.getFirst().getReference())).isTrue();

        QcRecord cursor = firstPage.getLast();
        List<QcRecord> secondPage = qcRecordRepository.findPageAfterCursor(
            "bioquimica",
            "lic",
            null,
            null,
            "APROVADO",
            "normal",
            cursor.getDate(),
            cursor.getCreatedAt(),
            cursor.getId(),
            PageRequest.of(0, 2)
        );

        assertThat(secondPage).extracting(QcRecord::getId).containsExactly(oldest.getId());
    }

    @Test
    @DisplayName("deve ordenar violações em lote por createdAt e desempatar por id decrescente")
    void shouldLoadViolationsForRecordBatchWithDeterministicOrder() {
        QcExam exam = persistExam("Glicose", "bioquimica");
        QcReferenceValue reference = persistReference(exam, "Ref atual", "L1");
        QcRecord first = persistRecord(
            reference, "Glicose", "bioquimica", "Normal", "L1", LocalDate.of(2026, 8, 18));
        QcRecord second = persistRecord(
            reference, "Glicose", "bioquimica", "Normal", "L1", LocalDate.of(2026, 8, 19));
        Instant sharedCreatedAt = Instant.parse("2026-08-19T12:00:00Z");
        WestgardViolation firstViolation = entityManager.persist(WestgardViolation.builder()
            .qcRecord(first)
            .rule("1-2s")
            .description("Alerta")
            .severity("WARNING")
            .createdAt(sharedCreatedAt)
            .build());
        WestgardViolation secondViolation = entityManager.persist(WestgardViolation.builder()
            .qcRecord(second)
            .rule("1-3s")
            .description("Rejeição")
            .severity("REJECTION")
            .createdAt(sharedCreatedAt)
            .build());

        entityManager.flush();
        forceCreatedAt(firstViolation.getId(), sharedCreatedAt);
        forceCreatedAt(secondViolation.getId(), sharedCreatedAt);
        entityManager.clear();

        List<WestgardViolation> violations = westgardViolationRepository
            .findByQcRecordIdInOrderByCreatedAtDescIdDesc(List.of(first.getId(), second.getId()));
        List<UUID> expectedIds = List.of(firstViolation.getId(), secondViolation.getId()).stream()
            .sorted(Comparator.comparing(UUID::toString).reversed())
            .toList();

        assertThat(violations).extracting(WestgardViolation::getCreatedAt)
            .containsOnly(sharedCreatedAt);
        assertThat(violations).extracting(WestgardViolation::getId)
            .containsExactlyElementsOf(expectedIds);
    }

    @Test
    @DisplayName("deve manter três SELECTs por página independentemente do tamanho")
    void shouldKeepConstantSelectCountForDifferentPageSizes() {
        QcExam exam = persistExam("Glicose", "bioquimica");
        QcReferenceValue reference = persistReference(exam, "Ref atual", "L1");
        for (int day = 1; day <= 6; day++) {
            persistRecord(
                reference,
                "Glicose",
                "bioquimica",
                "Normal",
                "L1",
                LocalDate.of(2026, 8, day)
            );
        }
        entityManager.flush();
        entityManager.clear();

        QcService service = new QcService(
            qcRecordRepository,
            null,
            null,
            null,
            null,
            new SimpleMeterRegistry(),
            postCalibrationRecordRepository,
            westgardViolationRepository
        );
        var statistics = entityManager.getEntityManager()
            .getEntityManagerFactory()
            .unwrap(SessionFactory.class)
            .getStatistics();
        boolean originallyEnabled = statistics.isStatisticsEnabled();
        statistics.setStatisticsEnabled(true);
        try {
            statistics.clear();
            service.getRecordsPage(null, null, null, null, null, null, null, 1);
            long smallPageSelects = statistics.getPrepareStatementCount();

            statistics.clear();
            service.getRecordsPage(null, null, null, null, null, null, null, 5);
            long largerPageSelects = statistics.getPrepareStatementCount();

            assertThat(smallPageSelects).isEqualTo(3L);
            assertThat(largerPageSelects).isEqualTo(3L);
        } finally {
            statistics.clear();
            statistics.setStatisticsEnabled(originallyEnabled);
        }
    }

    private void forceCreatedAt(UUID violationId, Instant createdAt) {
        entityManager.getEntityManager()
            .createNativeQuery("UPDATE westgard_violations SET created_at = :createdAt WHERE id = :id")
            .setParameter("createdAt", createdAt)
            .setParameter("id", violationId)
            .executeUpdate();
    }

    private QcExam persistExam(String name, String area) {
        return entityManager.persistAndFlush(QcExam.builder()
            .name(name)
            .area(area)
            .isActive(Boolean.TRUE)
            .build());
    }

    private QcReferenceValue persistReference(QcExam exam, String name, String lotNumber) {
        return entityManager.persistAndFlush(QcReferenceValue.builder()
            .exam(exam)
            .name(name)
            .level("Normal")
            .lotNumber(lotNumber)
            .targetValue(100D)
            .targetSd(5D)
            .cvMaxThreshold(10D)
            .isActive(Boolean.TRUE)
            .build());
    }

    private QcRecord persistRecord(
        QcReferenceValue reference,
        String examName,
        String area,
        String level,
        String lotNumber,
        LocalDate date
    ) {
        return entityManager.persist(QcRecord.builder()
            .reference(reference)
            .examName(examName)
            .area(area)
            .date(date)
            .level(level)
            .lotNumber(lotNumber)
            .value(100D)
            .targetValue(100D)
            .targetSd(5D)
            .cv(0D)
            .cvLimit(10D)
            .zScore(0D)
            .status("APROVADO")
            .needsCalibration(Boolean.FALSE)
            .build());
    }
}

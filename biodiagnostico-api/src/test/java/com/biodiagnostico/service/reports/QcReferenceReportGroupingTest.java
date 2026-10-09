package com.biodiagnostico.service.reports;

import static org.assertj.core.api.Assertions.assertThat;

import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.QcReferenceValue;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class QcReferenceReportGroupingTest {

    private static final UUID REF_A = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID REF_B = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final LocalDate DAY = LocalDate.of(2026, 10, 4);
    private static final Instant CREATED = Instant.parse("2026-10-04T10:00:00Z");

    @Test
    void persistedIdentitySeparatesHomonymsAndIgnoresSnapshotChanges() {
        QcRecord a = record(1, reference(REF_A, "Controle"), DAY, CREATED);
        QcRecord changedSnapshot = record(2, a.getReference(), DAY, CREATED);
        changedSnapshot.setExamName("Nome antigo");
        changedSnapshot.setLevel("N2");
        changedSnapshot.setLotNumber("L-antigo");
        QcRecord b = record(3, reference(REF_B, "Controle"), DAY, CREATED);

        var groups = QcReferenceReportGrouping.groups(List.of(b, changedSnapshot, a));

        assertThat(groups).hasSize(2);
        assertThat(groups.getFirst().items()).containsExactly(a, changedSnapshot);
        assertThat(groups.getFirst().record()).isSameAs(changedSnapshot);
        assertThat(groups.getLast().items()).containsExactly(b);
        assertThat(QcReferenceReportGrouping.key(a)).isEqualTo(QcReferenceReportGrouping.key(changedSnapshot));
        assertThat(QcReferenceReportGrouping.referenceLabel(a)).isEqualTo("Controle (cadastro atual)");
        assertThat(QcReferenceReportGrouping.referenceLabel(a, List.of(b, changedSnapshot, a)))
            .isEqualTo("Controle (cadastro atual) | ID: " + REF_A);
        assertThat(QcReferenceReportGrouping.referenceContext(changedSnapshot))
            .startsWith("Contexto do registro usado no cabeçalho: ").contains("Nome antigo", "N2", "L-antigo");
        assertThat(QcReferenceReportGrouping.referenceContext(a))
            .startsWith("Contexto do registro usado no cabeçalho: ").contains("Glicose", "N1", "L1");
    }

    @Test
    void legacyTuplesDoNotCollideOnSeparatorsNullsOrLiteralPlaceholder() {
        QcRecord first = record(1, null, DAY, CREATED);
        first.setExamName("A|B"); first.setLevel("C"); first.setLotNumber("D");
        QcRecord second = record(2, null, DAY, CREATED);
        second.setExamName("A"); second.setLevel("B|C"); second.setLotNumber("D");
        QcRecord missing = record(3, null, DAY, CREATED);
        missing.setLevel(null);
        QcRecord literalDash = record(4, null, DAY, CREATED);
        literalDash.setLevel("-");
        QcRecord blank = record(5, null, DAY, CREATED);
        blank.setLevel("");

        assertThat(QcReferenceReportGrouping.groups(List.of(first, second, missing, literalDash, blank))).hasSize(5);
        assertThat(QcReferenceReportGrouping.referenceLabel(first)).isEqualTo("Sem referência vinculada");
        assertThat(QcReferenceReportGrouping.referenceContext(first)).contains("A|B", "C", "D");
        assertThat(QcReferenceReportGrouping.referenceContext(first)).startsWith("Exame:");
    }

    @Test
    void sortsNamesThenUuidWithLegacyLastAndDateCreationIdNullsLast() {
        QcReferenceValue a = reference(REF_A, "Mesmo nome");
        QcRecord dayOld = record(1, a, DAY.minusDays(1), CREATED);
        QcRecord idLater = record(3, a, DAY, CREATED);
        QcRecord idEarlier = record(2, a, DAY, CREATED);
        QcRecord creationEarlier = record(4, a, DAY, CREATED.minusSeconds(1));
        QcRecord missingCreation = record(5, a, DAY, null);
        QcRecord missingId = record(6, a, DAY, CREATED);
        missingId.setId(null);
        QcRecord missingDate = record(7, a, null, CREATED.minusSeconds(5));
        QcRecord b = record(8, reference(REF_B, "Mesmo nome"), DAY.plusDays(1), CREATED);
        QcRecord firstName = record(9, reference(UUID.randomUUID(), "A primeiro"), DAY, CREATED);
        QcRecord legacy = record(10, null, DAY.plusDays(10), CREATED);

        var groups = QcReferenceReportGrouping.groups(List.of(legacy, b, missingDate, dayOld, missingCreation,
            missingId, idLater, idEarlier, creationEarlier, firstName));

        assertThat(groups).hasSize(4);
        assertThat(groups.get(0).record()).isSameAs(firstName);
        assertThat(groups.get(1).items()).containsExactly(creationEarlier, idEarlier, idLater,
            missingId, missingCreation, dayOld, missingDate);
        assertThat(groups.get(2).record()).isSameAs(b);
        assertThat(groups.get(3).record()).isSameAs(legacy);
    }

    @Test
    void eventOrderingUsesEventDatesAndDoesNotRequireCurrentActiveReference() {
        QcReferenceValue reference = reference(REF_A, "Nome atual");
        reference.setIsActive(false);
        reference.setValidUntil(DAY.minusYears(1));
        reference.setTargetValue(999D);
        QcRecord measurement = record(1, reference, DAY, CREATED);
        measurement.setTargetValue(100D);
        record Event(QcRecord measurement, LocalDate date, Instant createdAt, UUID id) {}
        Event older = new Event(measurement, DAY.plusDays(1), CREATED, REF_B);
        Event newer = new Event(measurement, DAY.plusDays(2), CREATED, REF_A);
        Event unlinked = new Event(null, DAY.plusDays(3), CREATED, REF_B);

        var groups = QcReferenceReportGrouping.groups(List.of(older, unlinked, newer),
            Event::measurement, Event::date, Event::createdAt, Event::id);

        assertThat(groups).hasSize(2);
        assertThat(groups.getFirst().items()).containsExactly(newer, older);
        assertThat(groups.getLast().items()).containsExactly(unlinked);
        assertThat(QcReferenceReportGrouping.referenceLabel(measurement)).isEqualTo("Nome atual (cadastro atual)");
        assertThat(measurement.getTargetValue()).isEqualTo(100D);
        assertThat(reference.getTargetValue()).isEqualTo(999D);
    }

    @Test
    void distinctNamesAndRepeatedMeasurementsOfOneIdentityNeedNoUuid() {
        QcRecord a = record(1, reference(REF_A, "Controle A"), DAY, CREATED);
        QcRecord same = record(2, a.getReference(), DAY.minusDays(1), CREATED);
        QcRecord b = record(3, reference(REF_B, "Controle B"), DAY, CREATED);

        assertThat(QcReferenceReportGrouping.referenceLabel(a, List.of(a, same, b)))
            .isEqualTo("Controle A (cadastro atual)");
        assertThat(QcReferenceReportGrouping.referenceLabel(b, List.of(a, same, b)))
            .isEqualTo("Controle B (cadastro atual)");
    }

    @Test
    void blankNamesAndLiteralPlaceholderAreDisambiguatedByDisplayedName() {
        QcRecord blank = record(1, reference(REF_A, " "), DAY, CREATED);
        QcRecord missing = record(2, reference(REF_B, null), DAY.minusDays(1), CREATED);
        QcRecord dash = record(3, reference(new UUID(0, 3), "-"), DAY, CREATED);
        QcRecord legacy = record(4, null, DAY, CREATED);
        List<QcRecord> scope = List.of(blank, missing, dash, legacy);

        assertThat(QcReferenceReportGrouping.referenceLabel(blank, scope)).isEqualTo("- (cadastro atual) | ID: " + REF_A);
        assertThat(QcReferenceReportGrouping.referenceLabel(missing, scope)).isEqualTo("- (cadastro atual) | ID: " + REF_B);
        assertThat(QcReferenceReportGrouping.referenceLabel(dash, scope))
            .isEqualTo("- (cadastro atual) | ID: " + new UUID(0, 3));
        assertThat(QcReferenceReportGrouping.referenceLabel(legacy, scope)).isEqualTo("Sem referência vinculada");
        assertThat(QcReferenceReportGrouping.referenceLabel(null)).isEqualTo("Sem referência vinculada");
        assertThat(QcReferenceReportGrouping.referenceLabel(blank, List.of(blank, legacy))).isEqualTo("- (cadastro atual)");
    }

    private QcRecord record(int id, QcReferenceValue reference, LocalDate date, Instant createdAt) {
        return QcRecord.builder().id(new UUID(0, id)).reference(reference).examName("Glicose")
            .level("N1").lotNumber("L1").date(date).createdAt(createdAt).value(100D).build();
    }

    private QcReferenceValue reference(UUID id, String name) {
        return QcReferenceValue.builder().id(id).name(name).level("N1").lotNumber("L1").build();
    }
}

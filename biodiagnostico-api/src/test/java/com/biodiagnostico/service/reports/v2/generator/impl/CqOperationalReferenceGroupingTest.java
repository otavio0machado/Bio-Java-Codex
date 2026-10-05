package com.biodiagnostico.service.reports.v2.generator.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.biodiagnostico.entity.PostCalibrationRecord;
import com.biodiagnostico.entity.QcExam;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.QcReferenceValue;
import com.biodiagnostico.entity.WestgardViolation;
import com.biodiagnostico.repository.AreaQcMeasurementRepository;
import com.biodiagnostico.repository.HematologyBioRecordRepository;
import com.biodiagnostico.repository.HematologyQcMeasurementRepository;
import com.biodiagnostico.repository.PostCalibrationRecordRepository;
import com.biodiagnostico.repository.QcRecordRepository;
import com.biodiagnostico.repository.WestgardViolationRepository;
import com.biodiagnostico.service.reports.QcReferenceReportGrouping;
import com.biodiagnostico.service.reports.v2.generator.ReportFilters;
import com.biodiagnostico.service.reports.v2.generator.chart.ChartRenderer;
import com.biodiagnostico.service.reports.v2.generator.comparison.DefaultPeriodComparator;
import com.biodiagnostico.service.reports.v2.generator.pdf.LabHeaderRenderer;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CqOperationalReferenceGroupingTest {

    private static final UUID REF_A = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID REF_B = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID EXAM_A = UUID.fromString("00000000-0000-0000-0000-000000000101");
    private static final UUID EXAM_B = UUID.fromString("00000000-0000-0000-0000-000000000102");
    private static final LocalDate DAY = LocalDate.of(2026, 10, 4);
    private static final Instant CREATED = Instant.parse("2026-10-04T10:00:00Z");

    @Mock QcRecordRepository records;
    @Mock PostCalibrationRecordRepository post;
    @Mock AreaQcMeasurementRepository areas;
    @Mock HematologyQcMeasurementRepository hematology;
    @Mock HematologyBioRecordRepository bio;
    @Mock WestgardViolationRepository violations;
    @Mock ChartRenderer charts;
    private CqOperationalV2Generator generator;

    @BeforeEach
    void setUp() {
        generator = new CqOperationalV2Generator(records, post, areas, hematology, bio, violations,
            GeneratorTestSupport.stubNumbering(), charts, new LabHeaderRenderer(),
            GeneratorTestSupport.stubLabSettings(), new DefaultPeriodComparator(),
            GeneratorTestSupport.stubAi("Comentario"), new com.biodiagnostico.config.ReportsV2Properties());
        lenient().when(records.findByAreaAndDateRange(eq("bioquimica"), any(), any())).thenReturn(List.of());
        // A valid one-pixel PNG keeps the tests focused on PDF text and the chart contract.
        lenient().when(charts.renderLeveyJennings(anyList(), anyDouble(), anyDouble(), anyString()))
            .thenReturn(Base64.getDecoder().decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="));
    }

    @Test
    void historySeparatesHomonymsAndOrdersReferenceDateCreationIdWithSnapshots() {
        QcReferenceValue a = reference(REF_A, EXAM_A, "Controle comum atual");
        a.setIsActive(false);
        a.setValidUntil(DAY.minusYears(1));
        a.setTargetValue(9999D);
        a.setLotNumber("LOTE-CADASTRO-EDITADO");
        QcReferenceValue b = reference(REF_B, EXAM_A, "Controle comum atual");
        QcRecord older = record(5, a, DAY.minusDays(1), CREATED, "HIST-A-ANTIGO");
        QcRecord lateId = record(4, a, DAY, CREATED, "HIST-A-ID4");
        QcRecord earlyId = record(3, a, DAY, CREATED, "HIST-A-ID3");
        QcRecord earlierCreation = record(2, a, DAY, CREATED.minusSeconds(1), "HIST-A-CRIACAO");
        QcRecord secondReference = record(6, b, DAY.plusDays(1), CREATED, "HIST-B");
        QcRecord legacy = record(7, null, DAY.plusDays(2), null, "HIST-LEGADO");
        when(records.findByAreaAndDateRange(eq("bioquimica"), any(), any()))
            .thenReturn(List.of(secondReference, older, lateId, earlyId, earlierCreation, legacy));

        String text = text(Map.of());
        String history = text.substring(text.indexOf("Historico diario"));
        String tables = history.substring(history.indexOf("Referencia:"));

        assertThat(text).contains(QcReferenceReportGrouping.REFERENCE_METADATA_NOTE, "Estatistica por referencia");
        assertThat(history).contains("Controle comum atual", REF_A.toString(), REF_B.toString(), "Sem referência vinculada");
        assertOrder(tables, REF_A.toString(), "HIST-A-CRIACAO", "HIST-A-ID3", "HIST-A-ID4", "HIST-A-ANTIGO",
            REF_B.toString(), "HIST-B", "Sem referência vinculada", "HIST-LEGADO");
        String aHistory = tables.substring(0, tables.indexOf(REF_B.toString()));
        assertOrder(aHistory, "04/10/2026", "03/10/2026");
        assertThat(history).contains("LOTE-SNAPSHOT", "90,89", "2,31", "1,11");
        assertThat(history.replace(" ", "")).contains("REPROVADO");
        assertThat(text).doesNotContain("9999,00", "LOTE-CADASTRO-EDITADO");
        assertThat(a.getIsActive()).isFalse();
        assertThat(older.getTargetValue()).isEqualTo(90.89D);
        assertThat(older.getStatus()).isEqualTo("REPROVADO");
    }

    @Test
    void examFilterAndIncludeDailyHistoryRemainEffective() {
        QcRecord included = record(1, reference(REF_A, EXAM_A, "INCLUIDA"), DAY, CREATED, "INCLUIDO");
        QcRecord excluded = record(2, reference(REF_B, EXAM_B, "EXCLUIDA"), DAY, CREATED, "EXCLUIDO");
        QcRecord legacy = record(3, null, DAY, CREATED, "LEGADO");
        when(records.findByAreaAndDateRange(eq("bioquimica"), any(), any()))
            .thenReturn(List.of(excluded, legacy, included));

        String text = text(Map.of("examIds", List.of(EXAM_A), "includeDailyHistory", false));

        assertThat(text).contains("INCLUIDA", REF_A.toString());
        assertThat(text).doesNotContain("EXCLUIDA", REF_B.toString(), "Sem referência vinculada", "Historico diario");
        verify(records, org.mockito.Mockito.atLeastOnce()).findByAreaAndDateRange("bioquimica", DAY.minusDays(10), DAY.plusDays(10));
    }

    @Test
    void otherQcRecordAreaKeepsDayHistoryAndQueriesRequestedArea() {
        QcRecord coagulation = record(1, reference(REF_A, EXAM_A, "COAG-REF"), DAY, CREATED, "COAG-HISTORICO");
        coagulation.setArea("coagulacao");
        QcRecord chemistry = record(2, reference(REF_B, EXAM_B, "BIO-REF"), DAY, CREATED, "BIO-HISTORICO");
        when(records.findByAreaAndDateRange("coagulacao", DAY.minusDays(10), DAY.plusDays(10)))
            .thenReturn(List.of(coagulation));
        when(records.findByAreaAndDateRange("bioquimica", DAY.minusDays(10), DAY.plusDays(10)))
            .thenReturn(List.of(chemistry));

        String text = text(Map.of("area", "coagulacao"));
        String history = text.substring(text.indexOf("Historico diario"));

        assertThat(history).contains("COAG-HISTORICO", "04/10/2026");
        assertThat(history).doesNotContain("BIO-HISTORICO", "COAG-REF", "BIO-REF", REF_A.toString(), REF_B.toString());
        assertThat(text).contains("Estatistica por exame").doesNotContain(
            QcReferenceReportGrouping.REFERENCE_METADATA_NOTE, "Referencia:", "COAG-REF", "BIO-REF",
            REF_A.toString(), REF_B.toString());
        verify(records, org.mockito.Mockito.atLeast(2)).findByAreaAndDateRange("coagulacao", DAY.minusDays(10), DAY.plusDays(10));
    }

    @Test
    void chartIdentifiesReferenceUuidAndKeepsOriginalSnapshotTargetAndSd() {
        QcReferenceValue reference = reference(REF_A, EXAM_A, "Controle grafico");
        reference.setTargetValue(9999D);
        reference.setTargetSd(888D);
        List<QcRecord> values = new ArrayList<>();
        QcRecord originalRepresentative = record(1, reference, DAY.minusDays(2), CREATED, "FIRST");
        originalRepresentative.setTargetValue(123.45D);
        originalRepresentative.setTargetSd(6.78D);
        values.add(originalRepresentative);
        for (int n = 2; n <= 5; n++) values.add(record(n, reference, DAY, CREATED, "R" + n));
        when(records.findByAreaAndDateRange(eq("bioquimica"), any(), any())).thenReturn(values);

        String text = text(Map.of("includeDailyHistory", false));

        verify(charts).renderLeveyJennings(anyList(), eq(123.45D), eq(6.78D),
            eq("Glicose N1\nControle grafico | ID: " + REF_A));
        assertThat(text).contains("Graficos Levey-Jennings", "Controle grafico", REF_A.toString(), "123,45");
        assertThat(text).doesNotContain("9999,00", "888,00");
    }

    @Test
    void violationsKeepFirstFiftySelectionThenOrganizeReferencesAndMeasurementDates() {
        QcRecord first = record(1, reference(REF_B, EXAM_A, "Z selecionada"), DAY, CREATED, "Z");
        QcRecord next = record(2, reference(REF_A, EXAM_A, "B selecionada"), DAY.minusDays(1), CREATED, "B");
        QcRecord omitted = record(3, reference(new UUID(0, 3), EXAM_A, "A excluida"), DAY.plusDays(1), CREATED, "A");
        List<WestgardViolation> rows = new ArrayList<>();
        rows.add(violation(1, first, "SELECIONADA-Z"));
        for (int n = 2; n <= 50; n++) rows.add(violation(n, next, "SELECIONADA-B-" + n));
        rows.add(violation(51, omitted, "OMITIDA-51"));
        when(violations.findByAreaAndPeriod("bioquimica", DAY.minusDays(10), DAY.plusDays(10))).thenReturn(rows);

        String text = text(Map.of("includeDailyHistory", false));

        assertThat(text).contains("SELECIONADA-Z", "SELECIONADA-B-50", "1 violacoes adicionais omitidas.");
        assertThat(text).doesNotContain("OMITIDA-51", "A excluida");
        assertOrder(text, REF_A.toString(), "03/10/2026", REF_B.toString(), "04/10/2026");
    }

    @Test
    void postCalibrationOrdersEventDateAndKeepsOriginalAndPostMeasurementsDistinct() {
        QcRecord a = record(1, reference(REF_A, EXAM_A, "A pós"), DAY.minusDays(5), CREATED, "ORIGINAL-A");
        QcRecord b = record(2, reference(REF_B, EXAM_A, "B pós"), DAY.plusDays(4), CREATED, "ORIGINAL-B");
        PostCalibrationRecord older = post(1, a, DAY, "EVENTO-A-ANTIGO");
        PostCalibrationRecord newer = post(2, a, DAY.plusDays(1), "EVENTO-A-NOVO");
        PostCalibrationRecord second = post(3, b, DAY.plusDays(2), "EVENTO-B");
        when(post.findByQcRecordAreaAndDateRange("bioquimica", DAY.minusDays(10), DAY.plusDays(10)))
            .thenReturn(List.of(second, older, newer));

        String text = text(Map.of("includeDailyHistory", false));

        assertOrder(text, REF_A.toString(), "EVENTO-A-NOVO", "05/10/2026", "EVENTO-A-ANTIGO", "04/10/2026",
            REF_B.toString(), "EVENTO-B", "06/10/2026");
        assertThat(text).contains("5,00", "3,00", "-2,00", "EFICAZ");
        assertThat(text).doesNotContain("29/09/2026", "08/10/2026");
        assertThat(a.getStatus()).isEqualTo("REPROVADO");
        assertThat(a.getCv()).isEqualTo(2.31D);
    }

    @Test
    void multipageHistoryRepeatsReferenceIdAndDateAlongsideMeasurementRows() throws Exception {
        QcReferenceValue reference = reference(REF_A, EXAM_A, "Controle multipagina");
        List<QcRecord> values = new ArrayList<>();
        for (int n = 1; n <= 110; n++) values.add(record(n, reference, DAY, CREATED, "PAGINA" + n));
        when(records.findByAreaAndDateRange(eq("bioquimica"), any(), any())).thenReturn(values);
        byte[] bytes = generator.generate(filters(Map.of()), GeneratorTestSupport.ctx()).bytes();

        PdfReader reader = new PdfReader(bytes);
        try {
            PdfTextExtractor extractor = new PdfTextExtractor(reader);
            int historyPages = 0;
            for (int n = 1; n <= reader.getNumberOfPages(); n++) {
                String page = normalize(extractor.getTextFromPage(n));
                if (page.contains("PAGINA")) {
                    historyPages++;
                    assertThat(page).contains(REF_A.toString(), "Controle multipagina", "04/10/2026");
                }
            }
            assertThat(historyPages).isGreaterThan(1);
        } finally {
            reader.close();
        }
    }

    private String text(Map<String, Object> extra) {
        return normalize(GeneratorTestSupport.extractPdfText(
            generator.generate(filters(extra), GeneratorTestSupport.ctx()).bytes()));
    }

    private ReportFilters filters(Map<String, Object> extra) {
        Map<String, Object> values = new java.util.HashMap<>(Map.of("area", "bioquimica", "periodType", "date-range",
            "dateFrom", DAY.minusDays(10).toString(), "dateTo", DAY.plusDays(10).toString()));
        values.putAll(extra);
        return new ReportFilters(values);
    }

    private void assertOrder(String text, String... markers) {
        int previous = -1;
        for (String marker : markers) {
            int next = text.indexOf(marker, previous + 1);
            assertThat(next).as("%s after position %s in %s", marker, previous, text).isGreaterThan(previous);
            previous = next;
        }
    }

    private String normalize(String text) {
        return text.replaceAll("\\s+", " ").replaceAll("(?<=-)\\s+(?=\\S)", "");
    }

    private QcReferenceValue reference(UUID id, UUID examId, String name) {
        return QcReferenceValue.builder().id(id).name(name).exam(QcExam.builder().id(examId).name("Glicose").build())
            .level("N1").lotNumber("LOTE-SNAPSHOT").build();
    }

    private QcRecord record(int id, QcReferenceValue reference, LocalDate date, Instant createdAt, String equipment) {
        return QcRecord.builder().id(new UUID(0, id)).reference(reference).area("bioquimica").examName("Glicose")
            .date(date).createdAt(createdAt).level("N1").lotNumber("LOTE-SNAPSHOT").value(111.21D)
            .targetValue(90.89D).targetSd(4.56D).cv(2.31D).zScore(1.11D).equipment(equipment)
            .status("REPROVADO").needsCalibration(true).build();
    }

    private WestgardViolation violation(int id, QcRecord record, String description) {
        return WestgardViolation.builder().id(new UUID(0, id)).qcRecord(record).rule("1_3s")
            .severity("REJECTION").description(description).createdAt(CREATED).build();
    }

    private PostCalibrationRecord post(int id, QcRecord record, LocalDate date, String exam) {
        return PostCalibrationRecord.builder().id(new UUID(0, id)).qcRecord(record).examName(exam).date(date)
            .createdAt(CREATED).originalValue(111.21D).postCalibrationValue(101D).originalCv(5D)
            .postCalibrationCv(3D).build();
    }
}

package com.biodiagnostico.service.reports.v2.generator.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.biodiagnostico.entity.PostCalibrationRecord;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.QcReferenceValue;
import com.biodiagnostico.repository.PostCalibrationRecordRepository;
import com.biodiagnostico.service.reports.v2.catalog.ReportCode;
import com.biodiagnostico.service.reports.v2.generator.ReportArtifact;
import com.biodiagnostico.service.reports.v2.generator.ReportFilters;
import com.biodiagnostico.service.reports.v2.generator.chart.JFreeChartRenderer;
import com.biodiagnostico.service.reports.v2.generator.pdf.LabHeaderRenderer;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CalibracaoPrePostGeneratorTest {

    @Mock PostCalibrationRecordRepository repository;

    private CalibracaoPrePostGenerator generator() {
        return new CalibracaoPrePostGenerator(
            repository,
            GeneratorTestSupport.stubNumbering(),
            new JFreeChartRenderer(),
            new LabHeaderRenderer(),
            GeneratorTestSupport.stubLabSettings(),
            GeneratorTestSupport.stubAi("Analise IA Calibracao fixture"),
            new com.biodiagnostico.config.ReportsV2Properties()
        );
    }

    private PostCalibrationRecord rec(String exam, Double origCv, Double postCv, LocalDate date) {
        QcRecord qc = QcRecord.builder()
            .id(UUID.randomUUID())
            .examName(exam)
            .area("bioquimica")
            .date(date)
            .lotNumber("L-1")
            .build();
        return PostCalibrationRecord.builder()
            .id(UUID.randomUUID())
            .qcRecord(qc)
            .examName(exam)
            .originalCv(origCv)
            .postCalibrationCv(postCv)
            .date(date)
            .build();
    }

    @Test
    void referencesUseOriginalIdentityAndPostEventDate() {
        UUID a = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID b = UUID.fromString("00000000-0000-0000-0000-000000000002");
        QcReferenceValue refA = QcReferenceValue.builder().id(a).name("Controle").isActive(false).build();
        QcReferenceValue refB = QcReferenceValue.builder().id(b).name("Controle").build();
        LocalDate day = LocalDate.of(2026, 1, 1);
        PostCalibrationRecord older = rec("Glicose", 5D, 3D, day);
        PostCalibrationRecord recent = rec("Glicose", 5D, null, day.plusDays(2));
        PostCalibrationRecord other = rec("Glicose", 3D, 5D, day.plusDays(1));
        PostCalibrationRecord legacy = rec("Glicose", 4D, 4D, day.plusDays(1));
        older.getQcRecord().setReference(refA);
        recent.getQcRecord().setReference(refA);
        recent.getQcRecord().setDate(day.minusDays(20));
        other.getQcRecord().setReference(refB);
        when(repository.findByQcRecordAreaAndDateRange(eq("bioquimica"), any(), any()))
            .thenReturn(List.of(other, older, legacy, recent));
        String text = GeneratorTestSupport.extractPdfText(generator().generate(new ReportFilters(Map.of(
            "area", "bioquimica", "periodType", "year", "year", 2026,
            "detailEachExam", true)), GeneratorTestSupport.ctx()).bytes()).replaceAll("\\s+", " ");
        String detail = text.substring(text.indexOf("Detalhe antes/depois"), text.indexOf("Detalhamento por exame"));
        assertThat(detail).contains(a.toString(), b.toString(), "Sem referência vinculada", "SEM MEDICAO", "EFICAZ", "PIOROU");
        String firstGroup = detail.substring(detail.indexOf(a.toString()), detail.indexOf(b.toString()));
        assertThat(firstGroup.indexOf("03/01/2026")).isLessThan(firstGroup.indexOf("01/01/2026"));
        assertThat(firstGroup).doesNotContain("12/12/2025");
        assertThat(text.substring(text.indexOf("Detalhamento por exame")))
            .contains(a.toString(), b.toString(), "Sem referência vinculada");
        assertThat(recent.getPostCalibrationCv()).isNull();
    }

    @Test
    void nonBiochemistryRetainsExistingPresentation() {
        PostCalibrationRecord event = rec("Analito", 5D, 3D, LocalDate.now());
        event.getQcRecord().setReference(QcReferenceValue.builder().id(UUID.randomUUID()).name("Nao exibir").build());
        when(repository.findByQcRecordAreaAndDateRange(eq("hematologia"), any(), any())).thenReturn(List.of(event));
        String text = GeneratorTestSupport.extractPdfText(generator().generate(new ReportFilters(Map.of(
            "area", "hematologia", "periodType", "current-month")), GeneratorTestSupport.ctx()).bytes());
        assertThat(text).contains("Analito").doesNotContain("Nao exibir", "cadastro atual");
    }

    @Test
    void distinctReferenceNamesUseSimpleCaptionsAndKeepCalibrationValues() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        PostCalibrationRecord first = rec("Glicose", 5D, 3D, LocalDate.now());
        PostCalibrationRecord second = rec("Glicose", 5D, null, LocalDate.now());
        first.getQcRecord().setReference(QcReferenceValue.builder().id(a).name("Controle normal").build());
        second.getQcRecord().setReference(QcReferenceValue.builder().id(b).name("Controle patologico").build());
        first.setNotes("EVENTO-SIMPLES-A");
        second.setNotes("EVENTO-SIMPLES-B");
        when(repository.findByQcRecordAreaAndDateRange(eq("bioquimica"), any(), any()))
            .thenReturn(List.of(first, second));

        String text = GeneratorTestSupport.extractPdfText(generator().generate(new ReportFilters(Map.of(
            "area", "bioquimica", "periodType", "current-month", "detailEachExam", true)),
            GeneratorTestSupport.ctx()).bytes()).replaceAll("\\s+", " ").replaceAll("(?<=-)\\s+(?=\\S)", "");
        assertThat(text).contains("Referência: Controle normal (cadastro atual)",
            "Referência: Controle patologico (cadastro atual)", "EVENTO-SIMPLES-A", "EVENTO-SIMPLES-B",
            "EFICAZ", "SEM MEDICAO", "5,00", "3,00")
            .doesNotContain(a.toString(), b.toString(), "ID:", "Contexto do registro",
                "Nome da referência conforme cadastro atual");
        String detail = text.substring(text.indexOf("Eventos de calibracao"));
        assertThat(detail.indexOf("Referência: Controle normal")).isLessThan(detail.indexOf("EVENTO-SIMPLES-A"));
        assertThat(detail.indexOf("Referência: Controle patologico")).isLessThan(detail.indexOf("EVENTO-SIMPLES-B"));
        assertThat(second.getPostCalibrationCv()).isNull();
    }

    @Test
    @DisplayName("definition expoe CALIBRACAO_PREPOST")
    void definitionMetadata() {
        assertThat(generator().definition().code()).isEqualTo(ReportCode.CALIBRACAO_PREPOST);
    }

    @Test
    @DisplayName("generate produz PDF com eficazes, sem efeito e pioraram")
    void generateProducesPdf() {
        LocalDate today = LocalDate.now();
        List<PostCalibrationRecord> fixtures = List.of(
            rec("Glicose", 5.0, 3.0, today),       // EFICAZ
            rec("Ureia",   4.0, 4.0, today),       // SEM EFEITO
            rec("Colesterol", 3.0, 5.0, today)     // PIOROU
        );
        when(repository.findByQcRecordAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(fixtures);

        ReportArtifact artifact = generator().generate(
            new ReportFilters(Map.of("periodType", "current-month")),
            GeneratorTestSupport.ctx()
        );

        GeneratorTestSupport.assertPdfMagicHeader(artifact.bytes());
        assertThat(artifact.sha256()).hasSize(64);
        assertThat(artifact.reportNumber()).matches("BIO-\\d{6}-\\d{6}");

        String text = GeneratorTestSupport.extractPdfText(artifact.bytes());
        assertThat(text).containsIgnoringCase("Resumo");
    }

    @Test
    @DisplayName("classifyCalibrations separa 4 baldes mutuamente exclusivos e fecha o total")
    void classifyCalibrationsBuckets() {
        LocalDate today = LocalDate.now();
        List<PostCalibrationRecord> records = List.of(
            rec("Glicose",    5.0,  3.0,  today),   // EFICAZ (delta -2.0)
            rec("Colesterol", 3.0,  5.0,  today),   // PIOROU (delta +2.0)
            rec("Ureia",      4.0,  4.0,  today),   // SEM EFEITO (delta 0)
            rec("Sodio",      null, 4.0,  today),   // SEM MEDICAO (originalCv null)
            rec("Potassio",   4.0,  null, today)    // SEM MEDICAO (postCalibrationCv null)
        );

        CalibracaoPrePostGenerator.CalibrationBuckets buckets =
            generator().classifyCalibrations(records);

        assertThat(buckets.eficazes()).isEqualTo(1);
        assertThat(buckets.semEfeito()).isEqualTo(1);
        assertThat(buckets.pioraram()).isEqualTo(1);
        assertThat(buckets.semMedicao()).isEqualTo(2);
        // INVARIANTE: a soma dos baldes fecha o total de registros.
        assertThat(buckets.total()).isEqualTo(records.size());
    }

    @Test
    @DisplayName("classifyCalibrations com lista vazia retorna baldes zerados")
    void classifyCalibrationsEmpty() {
        CalibracaoPrePostGenerator.CalibrationBuckets buckets =
            generator().classifyCalibrations(List.of());
        assertThat(buckets.eficazes()).isZero();
        assertThat(buckets.semEfeito()).isZero();
        assertThat(buckets.pioraram()).isZero();
        assertThat(buckets.semMedicao()).isZero();
        assertThat(buckets.total()).isZero();
    }

    @Test
    @DisplayName("generate com includeAiCommentary injeta IA")
    void generateWithAiCommentary() {
        when(repository.findByQcRecordAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of());
        ReportArtifact artifact = generator().generate(
            new ReportFilters(Map.of("periodType", "current-month", "includeAiCommentary", true)),
            GeneratorTestSupport.ctx()
        );
        String text = GeneratorTestSupport.extractPdfText(artifact.bytes());
        assertThat(text).contains("Analise IA Calibracao fixture");
    }
}

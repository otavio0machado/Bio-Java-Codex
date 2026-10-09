package com.biodiagnostico.service.reports.v2.generator.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.QcReferenceValue;
import com.biodiagnostico.entity.WestgardViolation;
import com.biodiagnostico.repository.WestgardViolationRepository;
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
class WestgardDeepdiveGeneratorTest {

    @Mock WestgardViolationRepository violationRepository;

    private WestgardDeepdiveGenerator generator() {
        return new WestgardDeepdiveGenerator(
            violationRepository,
            GeneratorTestSupport.stubNumbering(),
            new JFreeChartRenderer(),
            new LabHeaderRenderer(),
            GeneratorTestSupport.stubLabSettings(),
            GeneratorTestSupport.stubAi("Analise IA Westgard fixture")
        );
    }

    private WestgardViolation fixture(String rule, String severity, String exam, LocalDate date) {
        QcRecord qc = QcRecord.builder()
            .id(UUID.randomUUID())
            .examName(exam)
            .area("bioquimica")
            .date(date)
            .level("N1")
            .lotNumber("L-123")
            .value(100.0)
            .targetValue(100.0)
            .status("REPROVADO")
            .build();
        return WestgardViolation.builder()
            .id(UUID.randomUUID())
            .qcRecord(qc)
            .rule(rule)
            .description("Descricao " + rule)
            .severity(severity)
            .build();
    }

    @Test
    void referenceGroupsPreserveRecentThirtySelectionAndFullDetail() {
        UUID a = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID b = UUID.fromString("00000000-0000-0000-0000-000000000002");
        QcReferenceValue refA = QcReferenceValue.builder().id(a).name("Controle").isActive(false).build();
        QcReferenceValue refB = QcReferenceValue.builder().id(b).name("Controle").build();
        LocalDate start = LocalDate.of(2026, 1, 1);
        List<WestgardViolation> records = new java.util.ArrayList<>();
        for (int i = 0; i < 31; i++) {
            WestgardViolation v = fixture("1-3s", "REJEICAO", "Glicose", start.plusDays(i));
            v.getQcRecord().setReference(i % 2 == 0 ? refA : refB);
            v.setDescription(i == 0 ? "EXCLUIDO-MAIS-ANTIGO" : "VIOLACAO-" + i + "-FIM");
            records.add(v);
        }
        java.util.Collections.reverse(records);
        when(violationRepository.findByAreaAndPeriod(eq("bioquimica"), any(), any())).thenReturn(records);
        String text = GeneratorTestSupport.extractPdfText(generator().generate(new ReportFilters(Map.of(
            "area", "bioquimica", "periodType", "year", "year", 2026,
            "detailEachExam", false)), GeneratorTestSupport.ctx()).bytes()).replaceAll("\\s+", " ");
        String detail = text.substring(text.indexOf("Ultimas violacoes"));
        assertThat(text).contains("cadastro atual");
        assertThat(detail).contains(a.toString(), b.toString(), "VIOLACAO-30-FIM")
            .doesNotContain("EXCLUIDO-MAIS-ANTIGO");
        assertThat(detail.indexOf("VIOLACAO-30-FIM")).isLessThan(detail.indexOf("VIOLACAO-28-FIM"));
        assertThat(detail.indexOf(a.toString())).isLessThan(detail.indexOf(b.toString()));
        String full = GeneratorTestSupport.extractPdfText(generator().generate(new ReportFilters(Map.of(
            "area", "bioquimica", "periodType", "year", "year", 2026,
            "detailEachExam", true)), GeneratorTestSupport.ctx()).bytes()).replaceAll("\\s+", " ");
        assertThat(full.substring(full.indexOf("Detalhamento por exame")))
            .contains(a.toString(), b.toString(), "EXCLUIDO-MAIS-ANTIGO");
    }

    @Test
    void nonBiochemistryRetainsExistingPresentation() {
        WestgardViolation v = fixture("1-3s", "REJEICAO", "Analito", LocalDate.now());
        v.getQcRecord().setArea("hematologia");
        v.getQcRecord().setReference(QcReferenceValue.builder().id(UUID.randomUUID()).name("Nao exibir").build());
        when(violationRepository.findByAreaAndPeriod(eq("hematologia"), any(), any())).thenReturn(List.of(v));
        String text = GeneratorTestSupport.extractPdfText(generator().generate(new ReportFilters(Map.of(
            "area", "hematologia", "periodType", "current-month")), GeneratorTestSupport.ctx()).bytes());
        assertThat(text).contains("Analito").doesNotContain("Nao exibir", "cadastro atual");
    }

    @Test
    void distinctReferenceNamesUseSimpleCaptionsBeforeViolationTables() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        WestgardViolation first = fixture("1-3s", "REJEICAO", "Glicose", LocalDate.now());
        WestgardViolation second = fixture("2-2s", "ADVERTENCIA", "Glicose", LocalDate.now());
        first.getQcRecord().setReference(QcReferenceValue.builder().id(a).name("Controle normal").build());
        second.getQcRecord().setReference(QcReferenceValue.builder().id(b).name("Controle patologico").build());
        first.setDescription("VIOLACAO-SIMPLES-A");
        second.setDescription("VIOLACAO-SIMPLES-B");
        when(violationRepository.findByAreaAndPeriod(eq("bioquimica"), any(), any()))
            .thenReturn(List.of(first, second));

        String text = GeneratorTestSupport.extractPdfText(generator().generate(new ReportFilters(Map.of(
            "area", "bioquimica", "periodType", "current-month", "detailEachExam", true)),
            GeneratorTestSupport.ctx()).bytes()).replaceAll("\\s+", " ");
        assertThat(text).contains("Referência: Controle normal (cadastro atual)",
            "Referência: Controle patologico (cadastro atual)", "VIOLACAO-SIMPLES-A", "VIOLACAO-SIMPLES-B")
            .doesNotContain(a.toString(), b.toString(), "ID:", "Contexto do registro",
                "Nome da referência conforme cadastro atual");
        String detail = text.substring(text.indexOf("Historico de violacoes"));
        assertThat(detail.indexOf("Referência: Controle normal")).isLessThan(detail.indexOf("VIOLACAO-SIMPLES-A"));
        assertThat(detail.indexOf("Referência: Controle patologico")).isLessThan(detail.indexOf("VIOLACAO-SIMPLES-B"));
    }

    @Test
    @DisplayName("definition expoe WESTGARD_DEEPDIVE")
    void definitionMetadata() {
        assertThat(generator().definition().code()).isEqualTo(ReportCode.WESTGARD_DEEPDIVE);
    }

    @Test
    @DisplayName("generate produz PDF valido com 3 fixtures variadas")
    void generateProducesPdf() {
        LocalDate today = LocalDate.now();
        List<WestgardViolation> fixtures = List.of(
            fixture("1-3s", "REJEICAO", "Glicose", today),
            fixture("2-2s", "ADVERTENCIA", "Colesterol", today.minusDays(3)),
            fixture("R-4s", "REJEICAO", "Ureia", today.minusDays(7))
        );
        when(violationRepository.findByAreaAndPeriod(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(fixtures);

        ReportArtifact artifact = generator().generate(
            new ReportFilters(Map.of("area", "bioquimica", "periodType", "current-month")),
            GeneratorTestSupport.ctx()
        );

        GeneratorTestSupport.assertPdfMagicHeader(artifact.bytes());
        assertThat(artifact.sha256()).hasSize(64);
        assertThat(artifact.sizeBytes()).isGreaterThan(0);
        assertThat(artifact.reportNumber()).matches("BIO-\\d{6}-\\d{6}");

        String text = GeneratorTestSupport.extractPdfText(artifact.bytes());
        assertThat(text).containsIgnoringCase("Resumo");
        assertThat(text).contains("1-3s");
    }

    @Test
    @DisplayName("generate com includeAiCommentary injeta string da IA no PDF")
    void generateWithAiCommentary() {
        when(violationRepository.findByAreaAndPeriod(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of(fixture("1-3s", "REJEICAO", "Glicose", LocalDate.now())));

        ReportArtifact artifact = generator().generate(
            new ReportFilters(Map.of(
                "area", "bioquimica",
                "periodType", "current-month",
                "includeAiCommentary", true
            )),
            GeneratorTestSupport.ctx()
        );
        String text = GeneratorTestSupport.extractPdfText(artifact.bytes());
        assertThat(text).contains("Analise IA Westgard fixture");
    }

    @Test
    @DisplayName("generate com zero violacoes ainda emite PDF valido")
    void generateWithEmptyFixtures() {
        when(violationRepository.findByAreaAndPeriod(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of());
        ReportArtifact artifact = generator().generate(
            new ReportFilters(Map.of("area", "bioquimica", "periodType", "current-month")),
            GeneratorTestSupport.ctx()
        );
        GeneratorTestSupport.assertPdfMagicHeader(artifact.bytes());
        assertThat(artifact.sha256()).hasSize(64);
    }
}

package com.biodiagnostico.service.reports.v2.generator.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.repository.ReagentLotRepository;
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
class ReagentesRastreabilidadeGeneratorTest {

    @Mock ReagentLotRepository lotRepository;

    private ReagentesRastreabilidadeGenerator generator() {
        return new ReagentesRastreabilidadeGenerator(
            lotRepository,
            GeneratorTestSupport.stubNumbering(),
            new JFreeChartRenderer(),
            new LabHeaderRenderer(),
            GeneratorTestSupport.stubLabSettings(),
            GeneratorTestSupport.stubAi("Analise IA Reagentes fixture")
        );
    }

    private ReagentLot lot(String name, String status, LocalDate expiry, Double stock, String category) {
        ReagentLot l = new ReagentLot();
        l.setId(UUID.randomUUID());
        l.setName(name);
        l.setLotNumber("L-" + name);
        l.setCategory(category);
        l.setStatus(status);
        l.setExpiryDate(expiry);
        l.setCurrentStock(stock);
        l.setEstimatedConsumption(10.0);
        return l;
    }

    @Test
    @DisplayName("definition expoe REAGENTES_RASTREABILIDADE")
    void definitionMetadata() {
        assertThat(generator().definition().code()).isEqualTo(ReportCode.REAGENTES_RASTREABILIDADE);
    }

    @Test
    @DisplayName("generate produz PDF valido com lotes ativos/vencidos/proximos ao vencimento")
    void generateProducesPdf() {
        LocalDate today = LocalDate.now();
        List<ReagentLot> fixtures = List.of(
            lot("Reagente Glicose", "ativo", today.plusDays(30), 50D, "Bioquimica"),
            lot("Reagente Ureia", "vencido", today.minusDays(5), 10D, "Bioquimica"),
            lot("Reagente Hemoglobina", "ativo", today.plusDays(180), 100D, "Hematologia")
        );
        when(lotRepository.findAll()).thenReturn(fixtures);

        ReportArtifact artifact = generator().generate(
            new ReportFilters(Map.of()),
            GeneratorTestSupport.ctx()
        );

        GeneratorTestSupport.assertPdfMagicHeader(artifact.bytes());
        assertThat(artifact.sha256()).hasSize(64);
        assertThat(artifact.reportNumber()).matches("BIO-\\d{6}-\\d{6}");
        assertThat(artifact.sizeBytes()).isGreaterThan(0);

        String text = GeneratorTestSupport.extractPdfText(artifact.bytes());
        assertThat(text).containsIgnoringCase("Resumo");
    }

    @Test
    @DisplayName("generate com includeAiCommentary injeta string da IA no PDF")
    void generateWithAiCommentary() {
        LocalDate today = LocalDate.now();
        when(lotRepository.findAll()).thenReturn(List.of(
            lot("Reagente A", "ativo", today.plusDays(30), 50D, "Bioquimica")
        ));
        ReportArtifact artifact = generator().generate(
            new ReportFilters(Map.of("includeAiCommentary", true)),
            GeneratorTestSupport.ctx()
        );
        String text = GeneratorTestSupport.extractPdfText(artifact.bytes());
        assertThat(text).contains("Analise IA Reagentes fixture");
    }
}

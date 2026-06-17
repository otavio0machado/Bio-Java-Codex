package com.biodiagnostico.service.reports.v2.generator.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.biodiagnostico.entity.PostCalibrationRecord;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.repository.AreaQcMeasurementRepository;
import com.biodiagnostico.repository.HematologyBioRecordRepository;
import com.biodiagnostico.repository.HematologyQcMeasurementRepository;
import com.biodiagnostico.repository.PostCalibrationRecordRepository;
import com.biodiagnostico.repository.QcRecordRepository;
import com.biodiagnostico.repository.WestgardViolationRepository;
import com.biodiagnostico.service.reports.v2.generator.ReportArtifact;
import com.biodiagnostico.service.reports.v2.generator.ReportFilters;
import com.biodiagnostico.service.reports.v2.generator.chart.JFreeChartRenderer;
import com.biodiagnostico.service.reports.v2.generator.comparison.DefaultPeriodComparator;
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

/**
 * Cobre a coerencia de dominio da secao "Pos-calibracao" do relatorio
 * operacional V2: registros com CV original ou CV pos-calibracao nulos NAO
 * sao decisao de eficacia de calibracao (nao houve medicao). Devem aparecer
 * como Status "SEM MEDICAO" e Delta "N/D", espelhando o CalibracaoPrePostGenerator
 * dedicado — eliminando classificacao espuria por coercao a 0.
 */
@ExtendWith(MockitoExtension.class)
class CqOperationalPostCalibrationNullCvTest {

    @Mock QcRecordRepository qcRecordRepository;
    @Mock PostCalibrationRecordRepository postCalibrationRecordRepository;
    @Mock AreaQcMeasurementRepository areaQcMeasurementRepository;
    @Mock HematologyQcMeasurementRepository hematologyQcMeasurementRepository;
    @Mock HematologyBioRecordRepository hematologyBioRecordRepository;
    @Mock WestgardViolationRepository westgardViolationRepository;

    private CqOperationalV2Generator generator() {
        return new CqOperationalV2Generator(
            qcRecordRepository,
            postCalibrationRecordRepository,
            areaQcMeasurementRepository,
            hematologyQcMeasurementRepository,
            hematologyBioRecordRepository,
            westgardViolationRepository,
            GeneratorTestSupport.stubNumbering(),
            new JFreeChartRenderer(),
            new LabHeaderRenderer(),
            GeneratorTestSupport.stubLabSettings(),
            new DefaultPeriodComparator(),
            GeneratorTestSupport.stubAi("Comentario IA fixture"),
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
    @DisplayName("Pos-calibracao com CV null e SEM MEDICAO, nao classificada como eficacia")
    void postCalibrationNullCvIsSemMedicao() {
        LocalDate today = LocalDate.now();
        // Unico registro da secao: CV pos-calibracao null. Antes da correcao seria
        // coagido a 0 -> delta -5.0 -> "EFICAZ" espurio. Agora deve ser SEM MEDICAO.
        List<PostCalibrationRecord> post = List.of(
            rec("Glicose", 5.0, null, today)
        );
        lenient().when(qcRecordRepository.findByAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of());
        when(postCalibrationRecordRepository.findByQcRecordAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(post);

        ReportArtifact artifact = generator().generate(
            new ReportFilters(Map.of("area", "bioquimica", "periodType", "current-month")),
            GeneratorTestSupport.ctx()
        );

        GeneratorTestSupport.assertPdfMagicHeader(artifact.bytes());
        // Normaliza quebras de linha: celulas estreitas podem quebrar
        // "SEM MEDICAO" em duas linhas no extrator de texto do PDF.
        String text = GeneratorTestSupport.extractPdfText(artifact.bytes())
            .replaceAll("\\s+", " ");

        // Status correto e delta neutro (sem coercao a 0).
        assertThat(text).contains("SEM MEDICAO");
        assertThat(text).contains("N/D");
        // Nao houve decisao de eficacia espuria para este registro sem medicao.
        assertThat(text).doesNotContain("EFICAZ");
        assertThat(text).doesNotContain("PIOROU");
    }

    @Test
    @DisplayName("Pos-calibracao com CV medido mantem classificacao EFICAZ")
    void postCalibrationMeasuredStillClassified() {
        LocalDate today = LocalDate.now();
        // Reducao real de CV (5.0 -> 3.0, delta -2.0) deve continuar EFICAZ.
        List<PostCalibrationRecord> post = List.of(
            rec("Ureia", 5.0, 3.0, today)
        );
        lenient().when(qcRecordRepository.findByAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of());
        when(postCalibrationRecordRepository.findByQcRecordAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(post);

        ReportArtifact artifact = generator().generate(
            new ReportFilters(Map.of("area", "bioquimica", "periodType", "current-month")),
            GeneratorTestSupport.ctx()
        );

        String text = GeneratorTestSupport.extractPdfText(artifact.bytes())
            .replaceAll("\\s+", " ");
        assertThat(text).contains("EFICAZ");
        assertThat(text).doesNotContain("SEM MEDICAO");
    }
}

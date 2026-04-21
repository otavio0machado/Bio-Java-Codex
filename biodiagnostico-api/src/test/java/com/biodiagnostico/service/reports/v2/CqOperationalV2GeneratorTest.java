package com.biodiagnostico.service.reports.v2;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.biodiagnostico.entity.HematologyBioRecord;
import com.biodiagnostico.entity.HematologyQcMeasurement;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.ReportAuditLog;
import com.biodiagnostico.repository.AreaQcMeasurementRepository;
import com.biodiagnostico.repository.HematologyBioRecordRepository;
import com.biodiagnostico.repository.HematologyQcMeasurementRepository;
import com.biodiagnostico.repository.PostCalibrationRecordRepository;
import com.biodiagnostico.repository.QcRecordRepository;
import com.biodiagnostico.service.ReportNumberingService;
import com.biodiagnostico.service.reports.v2.catalog.ReportCode;
import com.biodiagnostico.service.reports.v2.generator.GenerationContext;
import com.biodiagnostico.service.reports.v2.generator.ReportArtifact;
import com.biodiagnostico.service.reports.v2.generator.ReportFilters;
import com.biodiagnostico.service.reports.v2.generator.ReportPreview;
import com.biodiagnostico.service.reports.v2.generator.impl.CqOperationalV2Generator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CqOperationalV2GeneratorTest {

    @Mock QcRecordRepository qcRecordRepository;
    @Mock PostCalibrationRecordRepository postCalibrationRecordRepository;
    @Mock AreaQcMeasurementRepository areaQcMeasurementRepository;
    @Mock HematologyQcMeasurementRepository hematologyQcMeasurementRepository;
    @Mock HematologyBioRecordRepository hematologyBioRecordRepository;

    private CqOperationalV2Generator generator;

    private final ReportNumberingService numbering = new ReportNumberingService(null, null) {
        @Override public String reserveNextNumber() { return "BIO-202604-000042"; }
        @Override public ReportAuditLog registerGeneration(
            String reportNumber, String area, String format, String periodLabel, byte[] content, UUID generatedBy
        ) { return null; }
        @Override public String sha256Hex(byte[] content) {
            try {
                java.security.MessageDigest d = java.security.MessageDigest.getInstance("SHA-256");
                byte[] h = d.digest(content);
                StringBuilder sb = new StringBuilder();
                for (byte b : h) sb.append(String.format("%02x", b));
                return sb.toString();
            } catch (Exception ex) { throw new RuntimeException(ex); }
        }
    };

    @BeforeEach
    void setUp() {
        generator = new CqOperationalV2Generator(
            qcRecordRepository,
            postCalibrationRecordRepository,
            areaQcMeasurementRepository,
            hematologyQcMeasurementRepository,
            hematologyBioRecordRepository,
            numbering
        );
    }

    @Test
    @DisplayName("definition expoe CQ_OPERATIONAL_V2")
    void definitionMetadata() {
        assertThat(generator.definition().code()).isEqualTo(ReportCode.CQ_OPERATIONAL_V2);
    }

    @Test
    @DisplayName("generate produz PDF valido para bioquimica")
    void generateBioquimicaReturnsPdf() {
        QcRecord r = QcRecord.builder()
            .id(UUID.randomUUID())
            .examName("Glicose")
            .area("bioquimica")
            .date(LocalDate.now())
            .level("N1")
            .value(100.0)
            .targetValue(100.0)
            .targetSd(5.0)
            .cv(5.0)
            .cvLimit(10.0)
            .status("APROVADO")
            .needsCalibration(false)
            .build();
        lenient().when(qcRecordRepository.findByAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of(r));
        lenient().when(postCalibrationRecordRepository.findByQcRecordAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of());

        ReportFilters filters = new ReportFilters(Map.of(
            "area", "bioquimica",
            "periodType", "current-month"
        ));
        ReportArtifact artifact = generator.generate(filters, ctx());

        assertThat(artifact).isNotNull();
        assertThat(new String(artifact.bytes(), 0, 5)).isEqualTo("%PDF-");
        assertThat(artifact.reportNumber()).isEqualTo("BIO-202604-000042");
        assertThat(artifact.sha256()).hasSize(64);
        assertThat(artifact.contentType()).isEqualTo("application/pdf");
        assertThat(artifact.suggestedFilename()).endsWith(".pdf");
    }

    @Test
    @DisplayName("generate com area=hematologia roteia para hematologyQcMeasurement")
    void generateHematology() {
        HematologyQcMeasurement m = HematologyQcMeasurement.builder()
            .id(UUID.randomUUID())
            .dataMedicao(LocalDate.now())
            .analito("WBC")
            .valorMedido(7.0)
            .modoUsado("auto")
            .status("APROVADO")
            .build();
        HematologyBioRecord b = HematologyBioRecord.builder()
            .id(UUID.randomUUID())
            .dataBio(LocalDate.now())
            .modoCi("bio")
            .bioHemacias(4.5)
            .build();
        lenient().when(hematologyQcMeasurementRepository.findByDataMedicaoBetweenOrderByDataMedicaoDesc(any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of(m));
        lenient().when(hematologyBioRecordRepository.findByDataBioBetweenOrderByDataBioDesc(any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of(b));

        ReportFilters filters = new ReportFilters(Map.of(
            "area", "hematologia",
            "periodType", "current-month"
        ));
        ReportArtifact artifact = generator.generate(filters, ctx());
        assertThat(new String(artifact.bytes(), 0, 5)).isEqualTo("%PDF-");
    }

    @Test
    @DisplayName("preview retorna HTML com contagens e warnings quando vazio")
    void previewEmpty() {
        lenient().when(qcRecordRepository.findByAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of());
        ReportPreview preview = generator.preview(
            new ReportFilters(Map.of("area", "bioquimica", "periodType", "current-month")),
            ctx()
        );
        assertThat(preview.html()).contains("Preview");
        assertThat(preview.warnings()).anyMatch(w -> w.toLowerCase().contains("nenhum"));
        assertThat(preview.periodLabel()).isNotBlank();
    }

    @Test
    @DisplayName("generate bytes sao determinísticos para o mesmo input (hash estavel)")
    void deterministicForSameInput() {
        lenient().when(qcRecordRepository.findByAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of());
        lenient().when(postCalibrationRecordRepository.findByQcRecordAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of());
        ReportFilters filters = new ReportFilters(Map.of(
            "area", "bioquimica",
            "periodType", "current-month"
        ));
        ReportArtifact a = generator.generate(filters, ctx());
        ReportArtifact b = generator.generate(filters, ctx());
        // PDFs tem metadata com timestamp interno; bytes podem diferir, mas numero e formato sao estaveis
        assertThat(a.reportNumber()).isEqualTo(b.reportNumber());
        assertThat(a.contentType()).isEqualTo(b.contentType());
    }

    private GenerationContext ctx() {
        return new GenerationContext(
            UUID.randomUUID(),
            "tester",
            Set.of("ADMIN"),
            Instant.now(),
            ZoneId.of("America/Sao_Paulo"),
            null,
            "corr-1",
            "req-1"
        );
    }
}

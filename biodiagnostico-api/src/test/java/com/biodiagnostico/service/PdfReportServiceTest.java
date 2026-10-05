package com.biodiagnostico.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.biodiagnostico.entity.HematologyBioRecord;
import com.biodiagnostico.entity.HematologyQcMeasurement;
import com.biodiagnostico.entity.ImmunologyControlItem;
import com.biodiagnostico.entity.ImmunologyControlSet;
import com.biodiagnostico.entity.ImmunologyQcRun;
import com.biodiagnostico.entity.ImmunologyQcRunResult;
import com.biodiagnostico.entity.PostCalibrationRecord;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.QcReferenceValue;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.repository.AreaQcMeasurementRepository;
import com.biodiagnostico.repository.HematologyBioRecordRepository;
import com.biodiagnostico.repository.HematologyQcMeasurementRepository;
import com.biodiagnostico.repository.ImmunologyQcRunRepository;
import com.biodiagnostico.repository.LabSettingsRepository;
import com.biodiagnostico.repository.PostCalibrationRecordRepository;
import com.biodiagnostico.repository.QcRecordRepository;
import com.biodiagnostico.repository.ReagentLotRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PdfReportServiceTest {

    private PdfReportService pdfReportService;

    @Mock
    private QcRecordRepository qcRecordRepository;

    @Mock
    private PostCalibrationRecordRepository postCalibrationRecordRepository;

    @Mock
    private ReagentLotRepository reagentLotRepository;

    @Mock
    private AreaQcMeasurementRepository areaQcMeasurementRepository;

    @Mock
    private HematologyQcMeasurementRepository hematologyQcMeasurementRepository;

    @Mock
    private HematologyBioRecordRepository hematologyBioRecordRepository;

    @Mock
    private ImmunologyQcRunRepository immunologyQcRunRepository;

    @Mock
    private LabSettingsRepository labSettingsRepository;

    private final ReportNumberingService reportNumberingService = new ReportNumberingService(null, null) {
        @Override
        public String reserveNextNumber() {
            return "BIO-202604-000001";
        }
        @Override
        public com.biodiagnostico.entity.ReportAuditLog registerGeneration(
            String reportNumber, String area, String format, String periodLabel, byte[] content, java.util.UUID generatedBy) {
            return null;
        }
    };

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        org.mockito.Mockito.lenient()
            .when(labSettingsRepository.findSingleton())
            .thenReturn(java.util.Optional.empty());
        pdfReportService = new PdfReportService(
            qcRecordRepository,
            postCalibrationRecordRepository,
            reagentLotRepository,
            areaQcMeasurementRepository,
            hematologyQcMeasurementRepository,
            hematologyBioRecordRepository,
            immunologyQcRunRepository,
            labSettingsRepository,
            reportNumberingService
        );
    }

    @Test
    @DisplayName("bioquímica identifica referências homônimas e ordena datas sem reinterpretar snapshots")
    void bioquimicaGroupsReferencesAndDates() throws Exception {
        UUID refA = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID refB = UUID.fromString("00000000-0000-0000-0000-000000000002");
        QcReferenceValue a = QcReferenceValue.builder().id(refA).name("Controle atual")
            .isActive(false).validUntil(LocalDate.of(2025, 1, 1)).targetValue(999D).build();
        QcReferenceValue b = QcReferenceValue.builder().id(refB).name("Controle atual").build();
        LocalDate day = LocalDate.now().withDayOfMonth(1);
        QcRecord old = referenceRecord(a, day, 81D);
        QcRecord recent = referenceRecord(a, day.plusDays(2), 83D);
        QcRecord other = referenceRecord(b, day.plusDays(1), 82D);
        QcRecord legacy = referenceRecord(null, day, 84D);
        QcRecord legacyOther = referenceRecord(null, day, 85D);
        legacyOther.setLotNumber("LEGADO-2");
        when(qcRecordRepository.findByAreaAndDateRange(eq("bioquimica"), any(), any()))
            .thenReturn(List.of(other, old, legacy, recent, legacyOther));
        when(postCalibrationRecordRepository.findByQcRecordAreaAndDateRange(eq("bioquimica"), any(), any()))
            .thenReturn(List.of());

        PdfReader reader = new PdfReader(pdfReportService.generateQcPdf("bioquimica", "year", null, day.getYear()));
        PdfTextExtractor extractor = new PdfTextExtractor(reader);
        StringBuilder content = new StringBuilder();
        for (int i = 1; i <= reader.getNumberOfPages(); i++) content.append(extractor.getTextFromPage(i));
        reader.close();
        String text = content.toString().replaceAll("\\s+", " ");
        assertThat(text).contains("Controle atual", refA.toString(), refB.toString(),
            "Sem referência vinculada", "LEGADO-2", "cadastro atual", "REPROVADO", "81,00", "83,00");
        String aSection = text.substring(text.indexOf(refA.toString()), text.indexOf(refB.toString()));
        assertThat(aSection.indexOf("03/" + String.format("%02d", day.getMonthValue())))
            .isLessThan(aSection.indexOf("01/" + String.format("%02d", day.getMonthValue())));
        assertThat(text.indexOf(refB.toString())).isLessThan(text.indexOf("Sem referência vinculada"));
        assertThat(text).doesNotContain("999,00");
        assertThat(recent.getTargetValue()).isEqualTo(100D);
        assertThat(recent.getStatus()).isEqualTo("REPROVADO");
    }

    private QcRecord referenceRecord(QcReferenceValue reference, LocalDate date, Double value) {
        return QcRecord.builder().id(UUID.randomUUID()).reference(reference)
            .examName("Glicose").area("bioquimica").date(date).level("Normal").lotNumber("L-1")
            .value(value).targetValue(100D).targetSd(5D).cv(7D).cvLimit(10D)
            .status("REPROVADO").needsCalibration(false).build();
    }

    @Test
    @DisplayName("deve gerar PDF de bioquímica no mês corrido com registros e retornar bytes válidos começando com %PDF")
    void generateQcPdf_bioquimica_mesCorrido_retornaPdfValido() {
        QcRecord record = QcRecord.builder()
            .id(UUID.randomUUID())
            .examName("Glicose")
            .area("bioquimica")
            .date(LocalDate.now())
            .level("N1")
            .lotNumber("L001")
            .value(95.0)
            .targetValue(100.0)
            .targetSd(5.0)
            .cv(5.26)
            .cvLimit(10.0)
            .zScore(1.0)
            .status("APROVADO")
            .needsCalibration(false)
            .build();

        when(qcRecordRepository.findByAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of(record));
        when(postCalibrationRecordRepository.findByQcRecordAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of());

        byte[] pdf = pdfReportService.generateQcPdf("bioquimica", "current-month", null, null);

        assertThat(pdf).isNotNull().isNotEmpty();
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
        verify(qcRecordRepository).findByAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class));
        verify(postCalibrationRecordRepository).findByQcRecordAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class));
    }

    @Test
    @DisplayName("deve gerar PDF de hematologia com medições e retornar bytes válidos começando com %PDF")
    void generateQcPdf_hematologia_retornaPdfValido() {
        HematologyQcMeasurement measurement = HematologyQcMeasurement.builder()
            .id(UUID.randomUUID())
            .dataMedicao(LocalDate.now())
            .analito("WBC")
            .valorMedido(7.5)
            .modoUsado("auto")
            .minAplicado(4.0)
            .maxAplicado(11.0)
            .status("APROVADO")
            .build();

        HematologyBioRecord bioRecord = HematologyBioRecord.builder()
            .id(UUID.randomUUID())
            .dataBio(LocalDate.now())
            .modoCi("bio")
            .bioHemacias(4.5)
            .bioHemoglobina(13.0)
            .bioLeucocitos(7.5)
            .bioPlaquetas(250.0)
            .bioRdw(12.0)
            .bioVpm(8.5)
            .build();

        when(hematologyQcMeasurementRepository.findByDataMedicaoBetweenOrderByDataMedicaoDesc(any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of(measurement));
        when(hematologyBioRecordRepository.findByDataBioBetweenOrderByDataBioDesc(any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of(bioRecord));

        byte[] pdf = pdfReportService.generateQcPdf("hematologia", "current-month", null, null);

        assertThat(pdf).isNotNull().isNotEmpty();
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
        verify(hematologyQcMeasurementRepository).findByDataMedicaoBetweenOrderByDataMedicaoDesc(any(LocalDate.class), any(LocalDate.class));
        verify(hematologyBioRecordRepository).findByDataBioBetweenOrderByDataBioDesc(any(LocalDate.class), any(LocalDate.class));
    }

    @Test
    @DisplayName("deve gerar PDF de imunologia qualitativa com esperado e observado")
    void generateQcPdf_imunologia_retornaPdfValido() {
        ImmunologyControlSet controlSet = ImmunologyControlSet.builder()
            .id(UUID.randomUUID())
            .analito("HIV")
            .manufacturer("Wama")
            .lotNumber("1022")
            .validUntil(LocalDate.now().plusMonths(6))
            .isActive(Boolean.TRUE)
            .build();
        ImmunologyControlItem item = ImmunologyControlItem.builder()
            .id(UUID.randomUUID())
            .controlSet(controlSet)
            .name("Controle 1")
            .expectedResult("REAGENTE")
            .displayOrder(1)
            .build();
        ImmunologyQcRun run = ImmunologyQcRun.builder()
            .id(UUID.randomUUID())
            .controlSet(controlSet)
            .dataMedicao(LocalDate.now())
            .analitoSnapshot("HIV")
            .manufacturerSnapshot("Wama")
            .lotNumberSnapshot("1022")
            .validUntilSnapshot(LocalDate.now().plusMonths(6))
            .status("APROVADO")
            .build();
        run.getResults().add(ImmunologyQcRunResult.builder()
            .id(UUID.randomUUID())
            .run(run)
            .controlItem(item)
            .controlNameSnapshot("Controle 1")
            .expectedResultSnapshot("REAGENTE")
            .observedResult("REAGENTE")
            .status("APROVADO")
            .displayOrder(1)
            .build());

        when(immunologyQcRunRepository.findByDataMedicaoBetweenOrderByDataMedicaoDescCreatedAtDesc(any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of(run));

        byte[] pdf = pdfReportService.generateQcPdf("imunologia", "current-month", null, null);

        assertThat(pdf).isNotNull().isNotEmpty();
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
        verify(immunologyQcRunRepository)
            .findByDataMedicaoBetweenOrderByDataMedicaoDescCreatedAtDesc(any(LocalDate.class), any(LocalDate.class));
    }

    @Test
    @DisplayName("deve gerar PDF sem erro quando não há registros de bioquímica no período")
    void generateQcPdf_semRegistros_retornaPdfVazio() {
        when(qcRecordRepository.findByAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of());
        when(postCalibrationRecordRepository.findByQcRecordAreaAndDateRange(eq("bioquimica"), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of());

        byte[] pdf = pdfReportService.generateQcPdf("bioquimica", "current-month", null, null);

        assertThat(pdf).isNotNull().isNotEmpty();
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
    }

    @Test
    @DisplayName("deve gerar PDF de reagentes com lotes cadastrados e retornar bytes válidos")
    void generateReagentsPdf_retornaPdfValido() {
        ReagentLot lot = ReagentLot.builder()
            .id(UUID.randomUUID())
            .name("ALT")
            .lotNumber("L100")
            .manufacturer("BioSystems")
            .status("em_estoque")
            .expiryDate(LocalDate.now().plusDays(30))
            .unitsInStock(50)
            .unitsInUse(0)
            .needsStockReview(false)
            .build();

        when(reagentLotRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(lot));

        byte[] pdf = pdfReportService.generateReagentsPdf();

        assertThat(pdf).isNotNull().isNotEmpty();
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
        verify(reagentLotRepository).findAllByOrderByCreatedAtDesc();
    }
}

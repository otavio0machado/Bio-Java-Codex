package com.biodiagnostico.service;

import com.biodiagnostico.entity.AreaQcMeasurement;
import com.biodiagnostico.entity.HematologyBioRecord;
import com.biodiagnostico.entity.HematologyQcMeasurement;
import com.biodiagnostico.entity.PostCalibrationRecord;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.repository.AreaQcMeasurementRepository;
import com.biodiagnostico.repository.HematologyBioRecordRepository;
import com.biodiagnostico.repository.HematologyQcMeasurementRepository;
import com.biodiagnostico.repository.PostCalibrationRecordRepository;
import com.biodiagnostico.repository.QcRecordRepository;
import com.biodiagnostico.repository.ReagentLotRepository;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PdfReportService {

    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");
    private static final Font TITLE_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18);
    private static final Font SUBTITLE_FONT = FontFactory.getFont(FontFactory.HELVETICA, 11, new java.awt.Color(90, 100, 110));
    private static final Font HEADER_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, java.awt.Color.WHITE);
    private static final Font BODY_FONT = FontFactory.getFont(FontFactory.HELVETICA, 8);
    private static final Font SECTION_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, new java.awt.Color(20, 83, 45));
    private static final java.awt.Color HEADER_COLOR = new java.awt.Color(22, 101, 52);
    private static final java.awt.Color ROW_ALT_COLOR = new java.awt.Color(244, 247, 245);
    private static final java.awt.Color BORDER_COLOR = new java.awt.Color(210, 214, 218);

    private final QcRecordRepository qcRecordRepository;
    private final PostCalibrationRecordRepository postCalibrationRecordRepository;
    private final ReagentLotRepository reagentLotRepository;
    private final AreaQcMeasurementRepository areaQcMeasurementRepository;
    private final HematologyQcMeasurementRepository hematologyQcMeasurementRepository;
    private final HematologyBioRecordRepository hematologyBioRecordRepository;

    public PdfReportService(
        QcRecordRepository qcRecordRepository,
        PostCalibrationRecordRepository postCalibrationRecordRepository,
        ReagentLotRepository reagentLotRepository,
        AreaQcMeasurementRepository areaQcMeasurementRepository,
        HematologyQcMeasurementRepository hematologyQcMeasurementRepository,
        HematologyBioRecordRepository hematologyBioRecordRepository
    ) {
        this.qcRecordRepository = qcRecordRepository;
        this.postCalibrationRecordRepository = postCalibrationRecordRepository;
        this.reagentLotRepository = reagentLotRepository;
        this.areaQcMeasurementRepository = areaQcMeasurementRepository;
        this.hematologyQcMeasurementRepository = hematologyQcMeasurementRepository;
        this.hematologyBioRecordRepository = hematologyBioRecordRepository;
    }

    @Transactional(readOnly = true)
    public byte[] generateQcPdf(String area, String periodType, Integer month, Integer year) {
        String normalizedArea = normalizeArea(area);
        PeriodRange range = resolvePeriod(periodType, month, year);
        return switch (normalizedArea) {
            case "hematologia" -> buildHematologyPdf(range);
            case "imunologia", "parasitologia", "microbiologia", "uroanalise" -> buildGenericAreaPdf(normalizedArea, range);
            default -> buildBioquimicaPdf(range);
        };
    }

    @Transactional(readOnly = true)
    public byte[] generateReagentsPdf() {
        List<ReagentLot> lots = reagentLotRepository.findAllByOrderByCreatedAtDesc();
        return withLandscapeDocument("Relatório de Reagentes", "Estoque, validade e status operacional", document -> {
            if (lots.isEmpty()) {
                document.add(new Paragraph("Nenhum lote de reagente cadastrado.", BODY_FONT));
                return;
            }

            PdfPTable table = createTable(new float[] {4.3F, 2.8F, 3.4F, 2.2F, 2.2F, 2.2F, 2.2F});
            addHeaderRow(table, "Etiqueta", "Lote", "Fabricante", "Status", "Validade", "Estoque", "Dias");
            boolean alternate = false;
            for (ReagentLot lot : lots) {
                long daysLeft = lot.getExpiryDate() == null ? -1 : ChronoUnit.DAYS.between(LocalDate.now(), lot.getExpiryDate());
                addBodyRow(
                    table,
                    alternate,
                    safe(lot.getName()),
                    safe(lot.getLotNumber()),
                    safe(lot.getManufacturer()),
                    safe(lot.getStatus()),
                    formatDate(lot.getExpiryDate()),
                    formatDecimal(lot.getCurrentStock()) + " " + safe(lot.getStockUnit()),
                    daysLeft >= 0 ? String.valueOf(daysLeft) : "—"
                );
                alternate = !alternate;
            }
            document.add(table);
            document.add(new Paragraph("Total de lotes: " + lots.size(), BODY_FONT));
        });
    }

    private byte[] buildBioquimicaPdf(PeriodRange range) {
        List<QcRecord> records = qcRecordRepository.findByAreaAndDateRange("bioquimica", range.start(), range.end());

        Map<UUID, PostCalibrationRecord> postCalibrations = postCalibrationRecordRepository
            .findByQcRecordAreaAndDateRange("bioquimica", range.start(), range.end()).stream()
            .collect(Collectors.toMap(record -> record.getQcRecord().getId(), record -> record, (left, right) -> left));

        return withLandscapeDocument(
            "Relatório de Controle de Qualidade",
            "Área: Bioquímica · Período: " + range.label(),
            document -> {
                if (records.isEmpty()) {
                    document.add(new Paragraph("Nenhum registro encontrado no período selecionado.", BODY_FONT));
                    return;
                }

                PdfPTable table = createTable(new float[] {2.0F, 3.4F, 1.3F, 1.7F, 1.6F, 1.6F, 1.4F, 1.3F, 1.8F, 1.6F, 1.8F});
                addHeaderRow(table, "Data", "Exame", "Nível", "Lote", "Valor", "Alvo", "CV%", "Lim.", "Status", "Pós-CQ", "Status Pós");
                boolean alternate = false;
                for (QcRecord record : records) {
                    PostCalibrationRecord post = postCalibrations.get(record.getId());
                    String postValueCell;
                    String postStatusCell;
                    if (post == null) {
                        postValueCell = Boolean.TRUE.equals(record.getNeedsCalibration()) ? "Pendente" : "—";
                        postStatusCell = "—";
                    } else {
                        postValueCell = formatDecimal(post.getPostCalibrationValue());
                        double limit = record.getCvLimit() != null ? record.getCvLimit() : 10D;
                        double postCv = post.getPostCalibrationCv() != null ? post.getPostCalibrationCv() : 0D;
                        postStatusCell = postCv <= limit ? "APROVADO" : "REPROVADO";
                    }
                    addBodyRow(
                        table,
                        alternate,
                        formatDate(record.getDate()),
                        safe(record.getExamName()),
                        safe(record.getLevel()),
                        safe(record.getLotNumber()),
                        formatDecimal(record.getValue()),
                        formatDecimal(record.getTargetValue()),
                        formatDecimal(record.getCv()),
                        formatDecimal(record.getCvLimit()),
                        safe(record.getStatus()),
                        postValueCell,
                        postStatusCell
                    );
                    alternate = !alternate;
                }
                document.add(table);
                document.add(new Paragraph("Total de registros: " + records.size(), BODY_FONT));
            }
        );
    }

    private byte[] buildGenericAreaPdf(String area, PeriodRange range) {
        List<AreaQcMeasurement> measurements = areaQcMeasurementRepository
            .findByAreaAndDataMedicaoBetweenOrderByDataMedicaoDesc(area, range.start(), range.end());

        return withLandscapeDocument(
            "Relatório de CQ por Área",
            "Área: " + areaLabel(area) + " · Período: " + range.label(),
            document -> {
                if (measurements.isEmpty()) {
                    document.add(new Paragraph("Nenhuma medição encontrada no período selecionado.", BODY_FONT));
                    return;
                }

                PdfPTable table = createTable(new float[] {2.0F, 2.6F, 1.6F, 1.5F, 1.5F, 1.5F, 1.7F, 2.2F, 2.2F, 2.2F});
                addHeaderRow(table, "Data", "Analito", "Valor", "Min", "Max", "Modo", "Status", "Equip.", "Lote", "Nível");
                boolean alternate = false;
                for (AreaQcMeasurement measurement : measurements) {
                    addBodyRow(
                        table,
                        alternate,
                        formatDate(measurement.getDataMedicao()),
                        safe(measurement.getAnalito()),
                        formatDecimal(measurement.getValorMedido()),
                        formatDecimal(measurement.getMinAplicado()),
                        formatDecimal(measurement.getMaxAplicado()),
                        safe(measurement.getModoUsado()),
                        safe(measurement.getStatus()),
                        safe(measurement.getParameter() != null ? measurement.getParameter().getEquipamento() : null),
                        safe(measurement.getParameter() != null ? measurement.getParameter().getLoteControle() : null),
                        safe(measurement.getParameter() != null ? measurement.getParameter().getNivelControle() : null)
                    );
                    alternate = !alternate;
                }
                document.add(table);
                document.add(new Paragraph("Total de medições: " + measurements.size(), BODY_FONT));
            }
        );
    }

    private byte[] buildHematologyPdf(PeriodRange range) {
        List<HematologyQcMeasurement> measurements = hematologyQcMeasurementRepository
            .findByDataMedicaoBetweenOrderByDataMedicaoDesc(range.start(), range.end());

        List<HematologyBioRecord> bioRecords = hematologyBioRecordRepository
            .findByDataBioBetweenOrderByDataBioDesc(range.start(), range.end());

        return withLandscapeDocument(
            "Relatório de Hematologia",
            "Medições e Bio x Controle Interno · Período: " + range.label(),
            document -> {
                if (measurements.isEmpty() && bioRecords.isEmpty()) {
                    document.add(new Paragraph("Nenhum dado de hematologia encontrado no período selecionado.", BODY_FONT));
                    return;
                }

                if (!measurements.isEmpty()) {
                    document.add(new Paragraph("Medições QC", SECTION_FONT));
                    PdfPTable measurementTable = createTable(new float[] {1.8F, 2.4F, 1.5F, 1.4F, 1.4F, 1.4F, 1.6F, 2.0F, 2.0F, 2.0F, 2.5F});
                    addHeaderRow(measurementTable, "Data", "Analito", "Valor", "Min", "Max", "Modo", "Status", "Equip.", "Lote", "Nível", "Obs.");
                    boolean alternate = false;
                    for (HematologyQcMeasurement measurement : measurements) {
                        addBodyRow(
                            measurementTable,
                            alternate,
                            formatDate(measurement.getDataMedicao()),
                            safe(measurement.getAnalito()),
                            formatDecimal(measurement.getValorMedido()),
                            formatDecimal(measurement.getMinAplicado()),
                            formatDecimal(measurement.getMaxAplicado()),
                            safe(measurement.getModoUsado()),
                            safe(measurement.getStatus()),
                            safe(measurement.getParameter() != null ? measurement.getParameter().getEquipamento() : null),
                            safe(measurement.getParameter() != null ? measurement.getParameter().getLoteControle() : null),
                            safe(measurement.getParameter() != null ? measurement.getParameter().getNivelControle() : null),
                            safe(measurement.getObservacao())
                        );
                        alternate = !alternate;
                    }
                    document.add(measurementTable);
                }

                if (!bioRecords.isEmpty()) {
                    document.add(new Paragraph(" ", BODY_FONT));
                    document.add(new Paragraph("Bio x Controle Interno", SECTION_FONT));
                    PdfPTable bioTable = createTable(new float[] {2.0F, 2.0F, 1.7F, 1.7F, 1.8F, 1.8F, 1.8F, 1.8F});
                    addHeaderRow(bioTable, "Data", "Modo", "RBC", "HGB", "WBC", "PLT", "RDW", "VPM");
                    boolean alternate = false;
                    for (HematologyBioRecord record : bioRecords) {
                        addBodyRow(
                            bioTable,
                            alternate,
                            formatDate(record.getDataBio()),
                            safe(record.getModoCi()),
                            formatDecimal(record.getBioHemacias()),
                            formatDecimal(record.getBioHemoglobina()),
                            formatDecimal(record.getBioLeucocitos()),
                            formatDecimal(record.getBioPlaquetas()),
                            formatDecimal(record.getBioRdw()),
                            formatDecimal(record.getBioVpm())
                        );
                        alternate = !alternate;
                    }
                    document.add(bioTable);
                }
            }
        );
    }

    private byte[] withLandscapeDocument(String title, String subtitle, DocumentCallback callback) {
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4.rotate(), 24F, 24F, 24F, 24F);
            PdfWriter.getInstance(document, outputStream);
            document.open();
            document.add(titleParagraph(title));
            document.add(subtitleParagraph(subtitle));
            callback.accept(document);
            document.close();
            return outputStream.toByteArray();
        } catch (DocumentException | java.io.IOException exception) {
            throw new BusinessException("Não foi possível gerar o PDF solicitado.");
        }
    }

    private PdfPTable createTable(float[] widths) throws DocumentException {
        PdfPTable table = new PdfPTable(widths);
        table.setWidthPercentage(100F);
        table.setSpacingBefore(10F);
        table.setSpacingAfter(10F);
        return table;
    }

    private void addHeaderRow(PdfPTable table, String... values) {
        for (String value : values) {
            PdfPCell cell = new PdfPCell(new Phrase(value, HEADER_FONT));
            cell.setHorizontalAlignment(Element.ALIGN_CENTER);
            cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
            cell.setPadding(6F);
            cell.setBackgroundColor(HEADER_COLOR);
            cell.setBorderColor(BORDER_COLOR);
            table.addCell(cell);
        }
    }

    private void addBodyRow(PdfPTable table, boolean alternate, String... values) {
        for (String value : values) {
            PdfPCell cell = new PdfPCell(new Phrase(value, BODY_FONT));
            cell.setPadding(5F);
            cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
            cell.setBorderColor(BORDER_COLOR);
            cell.setBackgroundColor(alternate ? ROW_ALT_COLOR : java.awt.Color.WHITE);
            table.addCell(cell);
        }
    }

    private Paragraph titleParagraph(String title) {
        Paragraph paragraph = new Paragraph(title, TITLE_FONT);
        paragraph.setAlignment(Element.ALIGN_CENTER);
        paragraph.setSpacingAfter(4F);
        return paragraph;
    }

    private Paragraph subtitleParagraph(String subtitle) {
        Paragraph paragraph = new Paragraph(subtitle, SUBTITLE_FONT);
        paragraph.setAlignment(Element.ALIGN_CENTER);
        paragraph.setSpacingAfter(14F);
        return paragraph;
    }

    private PeriodRange resolvePeriod(String periodType, Integer month, Integer year) {
        LocalDate today = LocalDate.now();
        String normalizedType = periodType == null || periodType.isBlank() ? "current-month" : periodType.trim().toLowerCase(Locale.ROOT);
        return switch (normalizedType) {
            case "year" -> {
                int resolvedYear = year == null ? today.getYear() : year;
                yield new PeriodRange(
                    LocalDate.of(resolvedYear, 1, 1),
                    LocalDate.of(resolvedYear, 12, 31),
                    "Ano " + resolvedYear
                );
            }
            case "specific-month" -> {
                int resolvedMonth = month == null ? today.getMonthValue() : month;
                int resolvedYear = year == null ? today.getYear() : year;
                YearMonth yearMonth = YearMonth.of(resolvedYear, resolvedMonth);
                String monthLabel = yearMonth.getMonth().getDisplayName(TextStyle.FULL, PT_BR);
                yield new PeriodRange(
                    yearMonth.atDay(1),
                    yearMonth.atEndOfMonth(),
                    capitalize(monthLabel) + "/" + resolvedYear
                );
            }
            default -> {
                YearMonth currentMonth = YearMonth.now();
                String monthLabel = currentMonth.getMonth().getDisplayName(TextStyle.FULL, PT_BR);
                yield new PeriodRange(
                    currentMonth.atDay(1),
                    currentMonth.atEndOfMonth(),
                    capitalize(monthLabel) + "/" + currentMonth.getYear()
                );
            }
        };
    }

    private String normalizeArea(String area) {
        if (area == null || area.isBlank()) {
            return "bioquimica";
        }
        return area.trim().toLowerCase(Locale.ROOT);
    }

    private String areaLabel(String area) {
        return switch (normalizeArea(area)) {
            case "hematologia" -> "Hematologia";
            case "imunologia" -> "Imunologia";
            case "parasitologia" -> "Parasitologia";
            case "microbiologia" -> "Microbiologia";
            case "uroanalise" -> "Uroanálise";
            default -> "Bioquímica";
        };
    }

    private String formatDate(LocalDate value) {
        if (value == null) {
            return "—";
        }
        return value.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }

    private String formatDecimal(Double value) {
        if (value == null) {
            return "—";
        }
        return String.format(PT_BR, "%.2f", value);
    }

    private String safe(String value) {
        if (value == null || value.isBlank()) {
            return "—";
        }
        return value.trim();
    }

    private String capitalize(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.substring(0, 1).toUpperCase(PT_BR) + value.substring(1);
    }

    @FunctionalInterface
    private interface DocumentCallback {
        void accept(Document document) throws DocumentException;
    }

    private record PeriodRange(LocalDate start, LocalDate end, String label) {
    }
}

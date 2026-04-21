package com.biodiagnostico.service.reports.v2.generator.impl;

import com.biodiagnostico.entity.AreaQcMeasurement;
import com.biodiagnostico.entity.HematologyBioRecord;
import com.biodiagnostico.entity.HematologyQcMeasurement;
import com.biodiagnostico.entity.LabSettings;
import com.biodiagnostico.entity.PostCalibrationRecord;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.repository.AreaQcMeasurementRepository;
import com.biodiagnostico.repository.HematologyBioRecordRepository;
import com.biodiagnostico.repository.HematologyQcMeasurementRepository;
import com.biodiagnostico.repository.PostCalibrationRecordRepository;
import com.biodiagnostico.repository.QcRecordRepository;
import com.biodiagnostico.service.ReportNumberingService;
import com.biodiagnostico.service.reports.v2.catalog.ReportDefinition;
import com.biodiagnostico.service.reports.v2.catalog.ReportDefinitionRegistry;
import com.biodiagnostico.service.reports.v2.generator.GenerationContext;
import com.biodiagnostico.service.reports.v2.generator.ReportArtifact;
import com.biodiagnostico.service.reports.v2.generator.ReportFilters;
import com.biodiagnostico.service.reports.v2.generator.ReportGenerator;
import com.biodiagnostico.service.reports.v2.generator.ReportPreview;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gerador operacional de CQ V2 (F1 slice). Substitui funcionalmente
 * {@code /api/reports/qc-pdf} quando chamado via {@code /api/reports/v2/generate}
 * com {@code code=CQ_OPERATIONAL_V2}.
 *
 * <p><strong>Reutilizacao V1:</strong> este gerador consulta os <em>mesmos
 * repositorios</em> que {@code PdfReportService} para que os dados sejam
 * identicos. O layout/logica de render e deliberadamente duplicado do V1
 * nesta primeira iteracao (menor risco — V1 permanece byte-a-byte intocado).
 * Domain-auditor vai validar equivalencia numerica e ok para consolidar em
 * um helper compartilhado em iteracao seguinte.
 *
 * <p>Numeracao ({@code BIO-AAAAMM-NNNNNN}) e hash SHA-256 seguem exatamente
 * a mesma lista de codigos que V1 — via {@link ReportNumberingService}.
 */
@Component
public class CqOperationalV2Generator implements ReportGenerator {

    private static final Logger LOG = LoggerFactory.getLogger(CqOperationalV2Generator.class);

    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");
    private static final Font TITLE_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18);
    private static final Font SUBTITLE_FONT = FontFactory.getFont(FontFactory.HELVETICA, 11, new Color(90, 100, 110));
    private static final Font HEADER_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
    private static final Font BODY_FONT = FontFactory.getFont(FontFactory.HELVETICA, 8);
    private static final Font SECTION_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, new Color(20, 83, 45));
    private static final Font META_FONT = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(70, 80, 90));
    private static final Color HEADER_COLOR = new Color(22, 101, 52);
    private static final Color ROW_ALT_COLOR = new Color(244, 247, 245);
    private static final Color BORDER_COLOR = new Color(210, 214, 218);

    private final QcRecordRepository qcRecordRepository;
    private final PostCalibrationRecordRepository postCalibrationRecordRepository;
    private final AreaQcMeasurementRepository areaQcMeasurementRepository;
    private final HematologyQcMeasurementRepository hematologyQcMeasurementRepository;
    private final HematologyBioRecordRepository hematologyBioRecordRepository;
    private final ReportNumberingService reportNumberingService;

    public CqOperationalV2Generator(
        QcRecordRepository qcRecordRepository,
        PostCalibrationRecordRepository postCalibrationRecordRepository,
        AreaQcMeasurementRepository areaQcMeasurementRepository,
        HematologyQcMeasurementRepository hematologyQcMeasurementRepository,
        HematologyBioRecordRepository hematologyBioRecordRepository,
        ReportNumberingService reportNumberingService
    ) {
        this.qcRecordRepository = qcRecordRepository;
        this.postCalibrationRecordRepository = postCalibrationRecordRepository;
        this.areaQcMeasurementRepository = areaQcMeasurementRepository;
        this.hematologyQcMeasurementRepository = hematologyQcMeasurementRepository;
        this.hematologyBioRecordRepository = hematologyBioRecordRepository;
        this.reportNumberingService = reportNumberingService;
    }

    @Override
    public ReportDefinition definition() {
        return ReportDefinitionRegistry.CQ_OPERATIONAL_V2_DEFINITION;
    }

    @Override
    @Transactional
    public ReportArtifact generate(ReportFilters filters, GenerationContext ctx) {
        ResolvedFilters rf = resolveFilters(filters);

        byte[] pdfBytes = renderPdf(rf, ctx, /* reserveNumber */ true);
        String reportNumber = rf.reservedNumber; // preenchido dentro de renderPdf
        String sha256 = reportNumberingService.sha256Hex(pdfBytes);

        // Auditoria compartilhada com V1 — mesma tabela, mesma semantica
        reportNumberingService.registerGeneration(
            reportNumber, rf.area, "PDF", rf.periodLabel, pdfBytes, ctx == null ? null : ctx.userId()
        );

        String filename = reportNumber + ".pdf";
        return new ReportArtifact(
            pdfBytes,
            "application/pdf",
            filename,
            /* pageCount */ 0,  // OpenPDF nao expoe facilmente; aceito como aproximacao
            pdfBytes.length,
            reportNumber,
            sha256,
            rf.periodLabel
        );
    }

    @Override
    @Transactional(readOnly = true)
    public ReportPreview preview(ReportFilters filters, GenerationContext ctx) {
        ResolvedFilters rf = resolveFilters(filters);
        List<String> warnings = new ArrayList<>();

        StringBuilder html = new StringBuilder();
        html.append("<section class=\"preview-cq-operacional\">");
        html.append("<h1>Relatorio Operacional de CQ (Preview)</h1>");
        html.append("<p class=\"muted\">Area: ").append(escape(areaLabel(rf.area)))
            .append(" · Periodo: ").append(escape(rf.periodLabel))
            .append("</p>");

        switch (rf.area) {
            case "hematologia" -> {
                List<HematologyQcMeasurement> meds = hematologyQcMeasurementRepository
                    .findByDataMedicaoBetweenOrderByDataMedicaoDesc(rf.start, rf.end);
                List<HematologyBioRecord> bio = hematologyBioRecordRepository
                    .findByDataBioBetweenOrderByDataBioDesc(rf.start, rf.end);
                if (meds.isEmpty() && bio.isEmpty()) {
                    warnings.add("Nenhum dado de hematologia encontrado no periodo selecionado.");
                }
                html.append("<p>Medicoes QC: <strong>").append(meds.size()).append("</strong></p>");
                html.append("<p>Registros Bio x Controle Interno: <strong>").append(bio.size()).append("</strong></p>");
                warnings.add("Area hematologia — dados de QC e Bio consolidados no PDF final.");
            }
            case "imunologia", "parasitologia", "microbiologia", "uroanalise" -> {
                List<AreaQcMeasurement> meds = areaQcMeasurementRepository
                    .findByAreaAndDataMedicaoBetweenOrderByDataMedicaoDesc(rf.area, rf.start, rf.end);
                if (meds.isEmpty()) {
                    warnings.add("Nenhuma medicao encontrada no periodo selecionado.");
                }
                html.append("<p>Medicoes: <strong>").append(meds.size()).append("</strong></p>");
            }
            default -> {
                List<QcRecord> records = qcRecordRepository.findByAreaAndDateRange(rf.area, rf.start, rf.end);
                if (records.isEmpty()) {
                    warnings.add("Nenhum registro encontrado no periodo selecionado.");
                }
                html.append("<p>Registros de CQ: <strong>").append(records.size()).append("</strong></p>");
                long aprovados = records.stream().filter(r -> "APROVADO".equalsIgnoreCase(r.getStatus())).count();
                long reprovados = records.stream().filter(r -> "REPROVADO".equalsIgnoreCase(r.getStatus())).count();
                long alertas = records.stream().filter(r -> "ALERTA".equalsIgnoreCase(r.getStatus())).count();
                html.append("<ul>")
                    .append("<li>Aprovados: ").append(aprovados).append("</li>")
                    .append("<li>Alerta: ").append(alertas).append("</li>")
                    .append("<li>Reprovados: ").append(reprovados).append("</li>")
                    .append("</ul>");
            }
        }

        if (!rf.examIds.isEmpty()) {
            html.append("<p class=\"muted\">Filtro de exames aplicado: ").append(rf.examIds.size()).append(" id(s).</p>");
        }

        html.append("</section>");
        return new ReportPreview(html.toString(), warnings, rf.periodLabel);
    }

    // ---------- Render PDF ----------

    private byte[] renderPdf(ResolvedFilters rf, GenerationContext ctx, boolean reserveNumber) {
        String reportNumber = reserveNumber ? reportNumberingService.reserveNextNumber() : "BIO-preview";
        rf.reservedNumber = reportNumber;
        LabSettings settings = ctx != null && ctx.labSettings() != null
            ? ctx.labSettings()
            : LabSettings.builder().build();

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4.rotate(), 24F, 24F, 30F, 40F);
            PdfWriter.getInstance(document, out);
            document.open();

            Paragraph title = new Paragraph("Relatorio Operacional de CQ", TITLE_FONT);
            title.setAlignment(Element.ALIGN_CENTER);
            title.setSpacingAfter(4F);
            document.add(title);

            Paragraph subtitle = new Paragraph(
                "Area: " + areaLabel(rf.area) + " · Periodo: " + rf.periodLabel, SUBTITLE_FONT);
            subtitle.setAlignment(Element.ALIGN_CENTER);
            subtitle.setSpacingAfter(10F);
            document.add(subtitle);

            Paragraph meta = new Paragraph(
                "Numero do laudo: " + reportNumber
                    + " · Gerado em: " + LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))
                    + (ctx != null && ctx.username() != null ? " · Por: " + ctx.username() : ""),
                META_FONT);
            meta.setAlignment(Element.ALIGN_CENTER);
            meta.setSpacingAfter(14F);
            document.add(meta);

            if (settings.getLabName() != null && !settings.getLabName().isBlank()) {
                Paragraph lab = new Paragraph(settings.getLabName(), META_FONT);
                lab.setAlignment(Element.ALIGN_CENTER);
                lab.setSpacingAfter(10F);
                document.add(lab);
            }

            switch (rf.area) {
                case "hematologia" -> renderHematology(document, rf);
                case "imunologia", "parasitologia", "microbiologia", "uroanalise" -> renderGenericArea(document, rf);
                default -> renderBioquimica(document, rf);
            }

            document.close();
            return out.toByteArray();
        } catch (DocumentException | java.io.IOException ex) {
            throw new IllegalStateException("Falha ao gerar PDF operacional V2", ex);
        }
    }

    private void renderBioquimica(Document document, ResolvedFilters rf) throws DocumentException {
        List<QcRecord> records = qcRecordRepository.findByAreaAndDateRange("bioquimica", rf.start, rf.end);
        if (!rf.examIds.isEmpty()) {
            records = records.stream()
                .filter(r -> r.getReference() != null
                    && r.getReference().getExam() != null
                    && rf.examIds.contains(r.getReference().getExam().getId()))
                .collect(Collectors.toList());
        }

        Map<UUID, PostCalibrationRecord> postCalibrations = postCalibrationRecordRepository
            .findByQcRecordAreaAndDateRange("bioquimica", rf.start, rf.end).stream()
            .collect(Collectors.toMap(r -> r.getQcRecord().getId(), r -> r, (a, b) -> a));

        if (records.isEmpty()) {
            document.add(new Paragraph("Nenhum registro encontrado no periodo selecionado.", BODY_FONT));
            return;
        }

        PdfPTable table = createTable(new float[] {2.0F, 3.4F, 1.3F, 1.7F, 1.6F, 1.6F, 1.4F, 1.3F, 1.8F, 1.6F, 1.8F});
        addHeaderRow(table, "Data", "Exame", "Nivel", "Lote", "Valor", "Alvo", "CV%", "Lim.", "Status", "Pos-CQ", "Status Pos");
        boolean alt = false;
        for (QcRecord r : records) {
            PostCalibrationRecord post = postCalibrations.get(r.getId());
            String postValueCell;
            String postStatusCell;
            if (post == null) {
                postValueCell = Boolean.TRUE.equals(r.getNeedsCalibration()) ? "Pendente" : "-";
                postStatusCell = "-";
            } else {
                postValueCell = formatDecimal(post.getPostCalibrationValue());
                double limit = r.getCvLimit() != null ? r.getCvLimit() : 10D;
                double postCv = post.getPostCalibrationCv() != null ? post.getPostCalibrationCv() : 0D;
                postStatusCell = postCv <= limit ? "APROVADO" : "REPROVADO";
            }
            addBodyRow(table, alt,
                formatDate(r.getDate()),
                safe(r.getExamName()),
                safe(r.getLevel()),
                safe(r.getLotNumber()),
                formatDecimal(r.getValue()),
                formatDecimal(r.getTargetValue()),
                formatDecimal(r.getCv()),
                formatDecimal(r.getCvLimit()),
                safe(r.getStatus()),
                postValueCell,
                postStatusCell
            );
            alt = !alt;
        }
        document.add(table);
        document.add(new Paragraph("Total de registros: " + records.size(), BODY_FONT));
    }

    private void renderGenericArea(Document document, ResolvedFilters rf) throws DocumentException {
        List<AreaQcMeasurement> measurements = areaQcMeasurementRepository
            .findByAreaAndDataMedicaoBetweenOrderByDataMedicaoDesc(rf.area, rf.start, rf.end);
        if (measurements.isEmpty()) {
            document.add(new Paragraph("Nenhuma medicao encontrada no periodo selecionado.", BODY_FONT));
            return;
        }

        PdfPTable table = createTable(new float[] {2.0F, 2.6F, 1.6F, 1.5F, 1.5F, 1.5F, 1.7F, 2.2F, 2.2F, 2.2F});
        addHeaderRow(table, "Data", "Analito", "Valor", "Min", "Max", "Modo", "Status", "Equip.", "Lote", "Nivel");
        boolean alt = false;
        for (AreaQcMeasurement m : measurements) {
            addBodyRow(table, alt,
                formatDate(m.getDataMedicao()),
                safe(m.getAnalito()),
                formatDecimal(m.getValorMedido()),
                formatDecimal(m.getMinAplicado()),
                formatDecimal(m.getMaxAplicado()),
                safe(m.getModoUsado()),
                safe(m.getStatus()),
                safe(m.getParameter() != null ? m.getParameter().getEquipamento() : null),
                safe(m.getParameter() != null ? m.getParameter().getLoteControle() : null),
                safe(m.getParameter() != null ? m.getParameter().getNivelControle() : null)
            );
            alt = !alt;
        }
        document.add(table);
        document.add(new Paragraph("Total de medicoes: " + measurements.size(), BODY_FONT));
    }

    private void renderHematology(Document document, ResolvedFilters rf) throws DocumentException {
        List<HematologyQcMeasurement> measurements = hematologyQcMeasurementRepository
            .findByDataMedicaoBetweenOrderByDataMedicaoDesc(rf.start, rf.end);
        List<HematologyBioRecord> bioRecords = hematologyBioRecordRepository
            .findByDataBioBetweenOrderByDataBioDesc(rf.start, rf.end);

        if (measurements.isEmpty() && bioRecords.isEmpty()) {
            document.add(new Paragraph("Nenhum dado de hematologia encontrado no periodo selecionado.", BODY_FONT));
            return;
        }

        if (!measurements.isEmpty()) {
            document.add(new Paragraph("Medicoes QC", SECTION_FONT));
            PdfPTable mt = createTable(new float[] {1.8F, 2.4F, 1.5F, 1.4F, 1.4F, 1.4F, 1.6F, 2.0F, 2.0F, 2.0F, 2.5F});
            addHeaderRow(mt, "Data", "Analito", "Valor", "Min", "Max", "Modo", "Status", "Equip.", "Lote", "Nivel", "Obs.");
            boolean alt = false;
            for (HematologyQcMeasurement m : measurements) {
                addBodyRow(mt, alt,
                    formatDate(m.getDataMedicao()),
                    safe(m.getAnalito()),
                    formatDecimal(m.getValorMedido()),
                    formatDecimal(m.getMinAplicado()),
                    formatDecimal(m.getMaxAplicado()),
                    safe(m.getModoUsado()),
                    safe(m.getStatus()),
                    safe(m.getParameter() != null ? m.getParameter().getEquipamento() : null),
                    safe(m.getParameter() != null ? m.getParameter().getLoteControle() : null),
                    safe(m.getParameter() != null ? m.getParameter().getNivelControle() : null),
                    safe(m.getObservacao())
                );
                alt = !alt;
            }
            document.add(mt);
        }

        if (!bioRecords.isEmpty()) {
            document.add(new Paragraph(" ", BODY_FONT));
            document.add(new Paragraph("Bio x Controle Interno", SECTION_FONT));
            PdfPTable bt = createTable(new float[] {2.0F, 2.0F, 1.7F, 1.7F, 1.8F, 1.8F, 1.8F, 1.8F});
            addHeaderRow(bt, "Data", "Modo", "RBC", "HGB", "WBC", "PLT", "RDW", "VPM");
            boolean alt = false;
            for (HematologyBioRecord r : bioRecords) {
                addBodyRow(bt, alt,
                    formatDate(r.getDataBio()),
                    safe(r.getModoCi()),
                    formatDecimal(r.getBioHemacias()),
                    formatDecimal(r.getBioHemoglobina()),
                    formatDecimal(r.getBioLeucocitos()),
                    formatDecimal(r.getBioPlaquetas()),
                    formatDecimal(r.getBioRdw()),
                    formatDecimal(r.getBioVpm())
                );
                alt = !alt;
            }
            document.add(bt);
        }
    }

    // ---------- Filtros ----------

    private ResolvedFilters resolveFilters(ReportFilters filters) {
        String area = filters.getString("area")
            .map(s -> s.trim().toLowerCase(Locale.ROOT))
            .orElseThrow(() -> new IllegalArgumentException("Filtro 'area' obrigatorio"));
        String periodType = filters.getString("periodType")
            .map(s -> s.trim().toLowerCase(Locale.ROOT))
            .orElseThrow(() -> new IllegalArgumentException("Filtro 'periodType' obrigatorio"));
        Integer month = filters.getInteger("month").orElse(null);
        Integer year = filters.getInteger("year").orElse(null);
        LocalDate dateFrom = filters.getDate("dateFrom").orElse(null);
        LocalDate dateTo = filters.getDate("dateTo").orElse(null);
        List<UUID> examIds = filters.getUuidList("examIds").orElse(List.of());

        LocalDate today = LocalDate.now();
        LocalDate start;
        LocalDate end;
        String label;

        switch (periodType) {
            case "year" -> {
                int resolvedYear = year != null ? year : today.getYear();
                start = LocalDate.of(resolvedYear, 1, 1);
                end = LocalDate.of(resolvedYear, 12, 31);
                label = "Ano " + resolvedYear;
            }
            case "specific-month" -> {
                int resolvedMonth = month != null ? month : today.getMonthValue();
                int resolvedYear = year != null ? year : today.getYear();
                YearMonth ym = YearMonth.of(resolvedYear, resolvedMonth);
                start = ym.atDay(1);
                end = ym.atEndOfMonth();
                String monthLabel = ym.getMonth().getDisplayName(TextStyle.FULL, PT_BR);
                label = capitalize(monthLabel) + "/" + resolvedYear;
            }
            case "date-range" -> {
                if (dateFrom == null || dateTo == null) {
                    throw new IllegalArgumentException("periodType=date-range exige dateFrom e dateTo");
                }
                if (dateTo.isBefore(dateFrom)) {
                    throw new IllegalArgumentException("dateTo deve ser >= dateFrom");
                }
                start = dateFrom;
                end = dateTo;
                label = dateFrom.format(DateTimeFormatter.ISO_DATE) + " a " + dateTo.format(DateTimeFormatter.ISO_DATE);
            }
            default -> {
                YearMonth ym = YearMonth.now();
                start = ym.atDay(1);
                end = ym.atEndOfMonth();
                String monthLabel = ym.getMonth().getDisplayName(TextStyle.FULL, PT_BR);
                label = capitalize(monthLabel) + "/" + ym.getYear();
            }
        }

        ResolvedFilters rf = new ResolvedFilters();
        rf.area = area;
        rf.start = start;
        rf.end = end;
        rf.periodLabel = label;
        rf.examIds = examIds;
        return rf;
    }

    // ---------- Helpers de PDF ----------

    private PdfPTable createTable(float[] widths) throws DocumentException {
        PdfPTable table = new PdfPTable(widths);
        table.setWidthPercentage(100F);
        table.setSpacingBefore(10F);
        table.setSpacingAfter(10F);
        return table;
    }

    private void addHeaderRow(PdfPTable table, String... values) {
        for (String v : values) {
            PdfPCell cell = new PdfPCell(new Phrase(v, HEADER_FONT));
            cell.setHorizontalAlignment(Element.ALIGN_CENTER);
            cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
            cell.setPadding(6F);
            cell.setBackgroundColor(HEADER_COLOR);
            cell.setBorderColor(BORDER_COLOR);
            table.addCell(cell);
        }
    }

    private void addBodyRow(PdfPTable table, boolean alternate, String... values) {
        for (String v : values) {
            PdfPCell cell = new PdfPCell(new Phrase(v, BODY_FONT));
            cell.setPadding(5F);
            cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
            cell.setBorderColor(BORDER_COLOR);
            cell.setBackgroundColor(alternate ? ROW_ALT_COLOR : Color.WHITE);
            table.addCell(cell);
        }
    }

    private static String areaLabel(String area) {
        return switch (area) {
            case "hematologia" -> "Hematologia";
            case "imunologia" -> "Imunologia";
            case "parasitologia" -> "Parasitologia";
            case "microbiologia" -> "Microbiologia";
            case "uroanalise" -> "Uroanalise";
            default -> "Bioquimica";
        };
    }

    private static String formatDate(LocalDate d) {
        return d == null ? "-" : d.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }

    private static String formatDecimal(Double d) {
        return d == null ? "-" : String.format(PT_BR, "%.2f", d);
    }

    private static String safe(String v) {
        return (v == null || v.isBlank()) ? "-" : v.trim();
    }

    private static String capitalize(String v) {
        if (v == null || v.isBlank()) return "";
        return v.substring(0, 1).toUpperCase(PT_BR) + v.substring(1);
    }

    private static String escape(String v) {
        if (v == null) return "";
        return v.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static final class ResolvedFilters {
        String area;
        LocalDate start;
        LocalDate end;
        String periodLabel;
        List<UUID> examIds = List.of();
        String reservedNumber;
    }
}

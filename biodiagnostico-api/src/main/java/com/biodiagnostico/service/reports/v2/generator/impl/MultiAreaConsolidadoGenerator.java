package com.biodiagnostico.service.reports.v2.generator.impl;

import com.biodiagnostico.entity.LabSettings;
import com.biodiagnostico.entity.MaintenanceRecord;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.repository.MaintenanceRecordRepository;
import com.biodiagnostico.repository.QcRecordRepository;
import com.biodiagnostico.repository.ReagentLotRepository;
import com.biodiagnostico.repository.WestgardViolationRepository;
import com.biodiagnostico.service.LabSettingsService;
import com.biodiagnostico.service.ReportNumberingService;
import com.biodiagnostico.service.reports.v2.catalog.ReportCode;
import com.biodiagnostico.service.reports.v2.catalog.ReportDefinition;
import com.biodiagnostico.service.reports.v2.catalog.ReportDefinitionRegistry;
import com.biodiagnostico.service.reports.v2.generator.GenerationContext;
import com.biodiagnostico.service.reports.v2.generator.ReportArtifact;
import com.biodiagnostico.service.reports.v2.generator.ReportFilters;
import com.biodiagnostico.service.reports.v2.generator.ReportGenerator;
import com.biodiagnostico.service.reports.v2.generator.ReportPreview;
import com.biodiagnostico.service.reports.v2.generator.ai.ReportAiCommentator;
import com.biodiagnostico.service.reports.v2.generator.chart.ChartRenderer;
import com.biodiagnostico.service.reports.v2.generator.pdf.LabHeaderRenderer;
import com.biodiagnostico.service.reports.v2.generator.pdf.PdfFooterRenderer;
import com.biodiagnostico.service.reports.v2.generator.pdf.ReportV2PdfTheme;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Image;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class MultiAreaConsolidadoGenerator implements ReportGenerator {

    private static final Logger LOG = LoggerFactory.getLogger(MultiAreaConsolidadoGenerator.class);
    private static final Locale PT_BR = ReportV2PdfTheme.PT_BR;

    private final QcRecordRepository qcRecordRepository;
    private final WestgardViolationRepository violationRepository;
    private final ReagentLotRepository reagentLotRepository;
    private final MaintenanceRecordRepository maintenanceRepository;
    private final ReportNumberingService reportNumberingService;
    private final ChartRenderer chartRenderer;
    private final LabHeaderRenderer headerRenderer;
    private final LabSettingsService labSettingsService;
    private final ReportAiCommentator aiCommentator;

    public MultiAreaConsolidadoGenerator(
        QcRecordRepository qcRecordRepository,
        WestgardViolationRepository violationRepository,
        ReagentLotRepository reagentLotRepository,
        MaintenanceRecordRepository maintenanceRepository,
        ReportNumberingService reportNumberingService,
        ChartRenderer chartRenderer,
        LabHeaderRenderer headerRenderer,
        LabSettingsService labSettingsService,
        ReportAiCommentator aiCommentator
    ) {
        this.qcRecordRepository = qcRecordRepository;
        this.violationRepository = violationRepository;
        this.reagentLotRepository = reagentLotRepository;
        this.maintenanceRepository = maintenanceRepository;
        this.reportNumberingService = reportNumberingService;
        this.chartRenderer = chartRenderer;
        this.headerRenderer = headerRenderer;
        this.labSettingsService = labSettingsService;
        this.aiCommentator = aiCommentator;
    }

    @Override
    public ReportDefinition definition() {
        return ReportDefinitionRegistry.MULTI_AREA_CONSOLIDADO_DEFINITION;
    }

    @Override
    @Transactional
    public ReportArtifact generate(ReportFilters filters, GenerationContext ctx) {
        Resolved rf = resolve(filters);
        String reportNumber = reportNumberingService.reserveNextNumber();
        byte[] pdfBytes = renderPdf(rf, ctx, reportNumber);
        String sha256 = reportNumberingService.sha256Hex(pdfBytes);
        reportNumberingService.registerGeneration(reportNumber, "multi-area", "PDF", rf.periodLabel,
            pdfBytes, ctx == null ? null : ctx.userId());
        return new ReportArtifact(pdfBytes, "application/pdf", reportNumber + ".pdf", 0,
            pdfBytes.length, reportNumber, sha256, rf.periodLabel);
    }

    @Override
    @Transactional(readOnly = true)
    public ReportPreview preview(ReportFilters filters, GenerationContext ctx) {
        Resolved rf = resolve(filters);
        StringBuilder html = new StringBuilder();
        html.append("<section><h1 style=\"color:#14532d\">Relatorio Consolidado do Laboratorio</h1>");
        html.append("<p>Areas: ").append(rf.areas == null ? "-" : String.join(", ", rf.areas))
            .append(" - Periodo: ").append(rf.periodLabel).append("</p></section>");
        return new ReportPreview(html.toString(), List.of(), rf.periodLabel);
    }

    private byte[] renderPdf(Resolved rf, GenerationContext ctx, String reportNumber) {
        LabSettings settings = ctx != null && ctx.labSettings() != null ? ctx.labSettings() : labSettingsService.getOrCreateSingleton();
        String respName = settings == null ? "" : settings.getResponsibleName();
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4, 36F, 36F, 40F, 54F);
            PdfWriter writer = PdfWriter.getInstance(doc, out);
            writer.setPageEvent(new PdfFooterRenderer(reportNumber, respName));
            doc.open();
            ReportArtifact headerArtifact = new ReportArtifact(
                new byte[] { 0x25, 0x50 }, "application/pdf", reportNumber + ".pdf", 1, 2L,
                reportNumber, "0000000000000000000000000000000000000000000000000000000000000000",
                rf.periodLabel);
            headerRenderer.render(doc, writer, settings, definition(), headerArtifact);

            doc.add(ReportV2PdfTheme.section("Consolidado por area"));
            PdfPTable t = ReportV2PdfTheme.table(new float[] {2F, 1.3F, 1.3F, 1.3F, 1.3F, 1.5F});
            ReportV2PdfTheme.headerRow(t, "Area", "Registros", "Taxa aprov.", "Alertas", "Reagentes criticos", "Manut. pendentes");
            boolean alt = false;
            Map<String, Number> rateChart = new LinkedHashMap<>();
            List<String> areas = rf.areas == null || rf.areas.isEmpty()
                ? ReportDefinitionRegistry.AREAS
                : rf.areas;
            for (String area : areas) {
                List<QcRecord> recs = qcRecordRepository.findByAreaAndDateRange(area, rf.start, rf.end);
                int total = recs.size();
                long aprovados = recs.stream().filter(r -> "APROVADO".equalsIgnoreCase(r.getStatus())).count();
                long alertas = recs.stream().filter(r -> "ALERTA".equalsIgnoreCase(r.getStatus())).count();
                double taxa = total == 0 ? 0 : (aprovados * 100.0 / total);
                rateChart.put(area, taxa);

                long reagCrit = reagentLotRepository.findAll().stream()
                    .filter(l -> l.getExpiryDate() != null && l.getExpiryDate().isBefore(LocalDate.now())
                        && l.getCurrentStock() != null && l.getCurrentStock() > 0)
                    .count();
                long manutPend = maintenanceRepository.findAll().stream()
                    .filter(m -> m.getNextDate() != null && m.getNextDate().isBefore(LocalDate.now()))
                    .count();

                ReportV2PdfTheme.bodyRow(t, alt,
                    capitalize(area),
                    String.valueOf(total),
                    String.format(PT_BR, "%.1f%%", taxa),
                    String.valueOf(alertas),
                    String.valueOf(reagCrit),
                    String.valueOf(manutPend)
                );
                alt = !alt;
            }
            doc.add(t);

            // Grafico de taxa de aprovacao por area
            if (!rateChart.isEmpty()) {
                try {
                    byte[] png = chartRenderer.renderBarChart(rateChart,
                        "Taxa de aprovacao por area", "Area", "Taxa %");
                    Image img = Image.getInstance(png);
                    img.scaleToFit(500F, 220F);
                    img.setAlignment(Element.ALIGN_CENTER);
                    doc.add(img);
                } catch (Exception ex) {
                    LOG.warn("Falha chart consolidado", ex);
                }
            }

            // Alertas transversais
            doc.add(ReportV2PdfTheme.section("Alertas transversais"));
            long rejeicoesGraves = violationRepository.findAll().stream()
                .filter(v -> "REJEICAO".equalsIgnoreCase(v.getSeverity()) || "REJECTION".equalsIgnoreCase(v.getSeverity()))
                .filter(v -> v.getQcRecord() != null && v.getQcRecord().getDate() != null
                    && !v.getQcRecord().getDate().isBefore(rf.start)
                    && !v.getQcRecord().getDate().isAfter(rf.end))
                .count();
            long reagVencidos = reagentLotRepository.findAll().stream()
                .filter(l -> l.getExpiryDate() != null && l.getExpiryDate().isBefore(LocalDate.now())
                    && l.getCurrentStock() != null && l.getCurrentStock() > 0).count();
            long manutAtrasadas = maintenanceRepository.findAll().stream()
                .filter(m -> m.getNextDate() != null && m.getNextDate().isBefore(LocalDate.now())).count();

            PdfPTable alertTable = ReportV2PdfTheme.table(new float[] {3F, 1F});
            ReportV2PdfTheme.headerRow(alertTable, "Alerta", "Ocorrencias");
            ReportV2PdfTheme.bodyRow(alertTable, false, "Violacoes Westgard REJEICAO", String.valueOf(rejeicoesGraves));
            ReportV2PdfTheme.bodyRow(alertTable, true, "Reagentes vencidos com estoque", String.valueOf(reagVencidos));
            ReportV2PdfTheme.bodyRow(alertTable, false, "Manutencoes atrasadas", String.valueOf(manutAtrasadas));
            doc.add(alertTable);

            if (rf.includeAiCommentary) {
                doc.add(ReportV2PdfTheme.section("Visao executiva"));
                StringBuilder sb = new StringBuilder();
                sb.append("Areas: ").append(areas).append('\n');
                sb.append("Periodo: ").append(rf.periodLabel).append('\n');
                sb.append("Rejeicoes graves: ").append(rejeicoesGraves).append('\n');
                sb.append("Reagentes vencidos com estoque: ").append(reagVencidos).append('\n');
                sb.append("Manutencoes atrasadas: ").append(manutAtrasadas).append('\n');
                String commentary = aiCommentator.commentary(ReportCode.MULTI_AREA_CONSOLIDADO, sb.toString(), ctx);
                PdfPTable wrap = new PdfPTable(1);
                wrap.setWidthPercentage(100F);
                PdfPCell cell = new PdfPCell(new Phrase(commentary, ReportV2PdfTheme.AI_FONT));
                cell.setBackgroundColor(ReportV2PdfTheme.BRAND_LIGHT);
                cell.setBorderColor(ReportV2PdfTheme.BRAND_DARK);
                cell.setPadding(10F);
                wrap.addCell(cell);
                doc.add(wrap);
            }

            doc.close();
            return out.toByteArray();
        } catch (DocumentException | java.io.IOException ex) {
            throw new IllegalStateException("Falha ao gerar PDF consolidado", ex);
        }
    }

    private Resolved resolve(ReportFilters filters) {
        Resolved r = new Resolved();
        r.areas = filters.getStringList("areas").orElse(null);
        r.includeAiCommentary = filters.getBoolean("includeAiCommentary").orElse(false);
        String periodType = filters.getString("periodType")
            .map(s -> s.trim().toLowerCase(Locale.ROOT)).orElse("current-month");
        LocalDate today = LocalDate.now();
        switch (periodType) {
            case "year" -> {
                int y = filters.getInteger("year").orElse(today.getYear());
                r.start = LocalDate.of(y, 1, 1); r.end = LocalDate.of(y, 12, 31);
                r.periodLabel = "Ano " + y;
            }
            case "specific-month" -> {
                int m = filters.getInteger("month").orElse(today.getMonthValue());
                int y = filters.getInteger("year").orElse(today.getYear());
                YearMonth ym = YearMonth.of(y, m);
                r.start = ym.atDay(1); r.end = ym.atEndOfMonth();
                r.periodLabel = capitalize(ym.getMonth().getDisplayName(TextStyle.FULL, PT_BR)) + "/" + y;
            }
            case "date-range" -> {
                r.start = filters.getDate("dateFrom").orElseThrow();
                r.end = filters.getDate("dateTo").orElseThrow();
                r.periodLabel = r.start.format(DateTimeFormatter.ISO_DATE) + " a " + r.end.format(DateTimeFormatter.ISO_DATE);
            }
            default -> {
                YearMonth ym = YearMonth.now();
                r.start = ym.atDay(1); r.end = ym.atEndOfMonth();
                r.periodLabel = capitalize(ym.getMonth().getDisplayName(TextStyle.FULL, PT_BR)) + "/" + ym.getYear();
            }
        }
        return r;
    }

    private static String capitalize(String v) {
        if (v == null || v.isEmpty()) return "";
        return v.substring(0, 1).toUpperCase(PT_BR) + v.substring(1);
    }

    static final class Resolved {
        List<String> areas;
        LocalDate start;
        LocalDate end;
        String periodLabel;
        boolean includeAiCommentary;
    }
}

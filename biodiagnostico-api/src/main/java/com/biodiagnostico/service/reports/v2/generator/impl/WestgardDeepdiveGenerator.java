package com.biodiagnostico.service.reports.v2.generator.impl;

import com.biodiagnostico.entity.LabSettings;
import com.biodiagnostico.entity.WestgardViolation;
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
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Generator de deep-dive em violacoes Westgard. Seccoes:
 * 1. Capa institucional
 * 2. Resumo (total, por severidade)
 * 3. Top 10 regras (barChart + tabela)
 * 4. Exames mais problematicos (barChart)
 * 5. Heatmap temporal dia-semana x semana-mes
 * 6. Lista detalhada top 30
 * 7. Comentario IA
 */
@Component
public class WestgardDeepdiveGenerator implements ReportGenerator {

    private static final Logger LOG = LoggerFactory.getLogger(WestgardDeepdiveGenerator.class);
    private static final Locale PT_BR = ReportV2PdfTheme.PT_BR;

    private final WestgardViolationRepository violationRepository;
    private final ReportNumberingService reportNumberingService;
    private final ChartRenderer chartRenderer;
    private final LabHeaderRenderer headerRenderer;
    private final LabSettingsService labSettingsService;
    private final ReportAiCommentator aiCommentator;

    public WestgardDeepdiveGenerator(
        WestgardViolationRepository violationRepository,
        ReportNumberingService reportNumberingService,
        ChartRenderer chartRenderer,
        LabHeaderRenderer headerRenderer,
        LabSettingsService labSettingsService,
        ReportAiCommentator aiCommentator
    ) {
        this.violationRepository = violationRepository;
        this.reportNumberingService = reportNumberingService;
        this.chartRenderer = chartRenderer;
        this.headerRenderer = headerRenderer;
        this.labSettingsService = labSettingsService;
        this.aiCommentator = aiCommentator;
    }

    @Override
    public ReportDefinition definition() {
        return ReportDefinitionRegistry.WESTGARD_DEEPDIVE_DEFINITION;
    }

    @Override
    @Transactional
    public ReportArtifact generate(ReportFilters filters, GenerationContext ctx) {
        Resolved rf = resolve(filters);
        rf.includeAiCommentary = filters.getBoolean("includeAiCommentary").orElse(false);
        String reportNumber = reportNumberingService.reserveNextNumber();
        byte[] pdfBytes = renderPdf(rf, ctx, reportNumber);
        String sha256 = reportNumberingService.sha256Hex(pdfBytes);
        reportNumberingService.registerGeneration(reportNumber, rf.area, "PDF", rf.periodLabel,
            pdfBytes, ctx == null ? null : ctx.userId());
        return new ReportArtifact(pdfBytes, "application/pdf", reportNumber + ".pdf", 0,
            pdfBytes.length, reportNumber, sha256, rf.periodLabel);
    }

    @Override
    @Transactional(readOnly = true)
    public ReportPreview preview(ReportFilters filters, GenerationContext ctx) {
        Resolved rf = resolve(filters);
        List<WestgardViolation> violations = loadViolations(rf);
        StringBuilder html = new StringBuilder();
        html.append("<section><h1 style=\"color:#14532d\">Analise Profunda de Westgard</h1>");
        html.append("<p>Area: ").append(rf.area).append(" - Periodo: ").append(rf.periodLabel).append("</p>");
        html.append("<p>Total de violacoes: <strong>").append(violations.size()).append("</strong></p>");
        List<String> warnings = violations.isEmpty()
            ? List.of("Nenhuma violacao encontrada no periodo selecionado.")
            : List.of();
        html.append("</section>");
        return new ReportPreview(html.toString(), warnings, rf.periodLabel);
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
                new byte[] { 0x25, 0x50 }, "application/pdf", reportNumber + ".pdf",
                1, 2L, reportNumber,
                "0000000000000000000000000000000000000000000000000000000000000000",
                rf.periodLabel);
            headerRenderer.render(doc, writer, settings, definition(), headerArtifact);

            List<WestgardViolation> violations = loadViolations(rf);

            // Resumo
            doc.add(ReportV2PdfTheme.section("Resumo"));
            long advertencias = violations.stream()
                .filter(v -> "ADVERTENCIA".equalsIgnoreCase(v.getSeverity())).count();
            long rejeicoes = violations.stream()
                .filter(v -> "REJEICAO".equalsIgnoreCase(v.getSeverity()) || "REJECTION".equalsIgnoreCase(v.getSeverity())).count();
            long exames = violations.stream()
                .filter(v -> v.getQcRecord() != null)
                .map(v -> v.getQcRecord().getExamName()).filter(java.util.Objects::nonNull).distinct().count();
            PdfPTable summary = new PdfPTable(new float[] {1, 1, 1, 1});
            summary.setWidthPercentage(100F);
            summary.setSpacingAfter(6F);
            summary.addCell(summaryCell("Total", String.valueOf(violations.size()), ReportV2PdfTheme.BRAND_PRIMARY));
            summary.addCell(summaryCell("Advertencias", String.valueOf(advertencias), ReportV2PdfTheme.STATUS_ALERTA));
            summary.addCell(summaryCell("Rejeicoes", String.valueOf(rejeicoes), ReportV2PdfTheme.STATUS_REPROVADO));
            summary.addCell(summaryCell("Exames afetados", String.valueOf(exames), ReportV2PdfTheme.BRAND_DARK));
            doc.add(summary);

            if (violations.isEmpty()) {
                doc.add(new Paragraph("Nenhuma violacao registrada no periodo.", ReportV2PdfTheme.BODY_FONT));
                doc.close();
                return out.toByteArray();
            }

            // Top regras
            Map<String, Long> byRule = violations.stream()
                .collect(Collectors.groupingBy(
                    v -> v.getRule() == null ? "-" : v.getRule(),
                    LinkedHashMap::new, Collectors.counting()));
            List<Map.Entry<String, Long>> topRules = byRule.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(10).collect(Collectors.toList());

            doc.add(ReportV2PdfTheme.section("Top 10 regras violadas"));
            Map<String, Number> ruleDs = new LinkedHashMap<>();
            topRules.forEach(e -> ruleDs.put(e.getKey(), e.getValue()));
            try {
                byte[] png = chartRenderer.renderBarChart(ruleDs, "Violacoes por regra", "Regra", "Ocorrencias");
                Image img = Image.getInstance(png);
                img.scaleToFit(500F, 220F);
                img.setAlignment(Element.ALIGN_CENTER);
                doc.add(img);
            } catch (Exception ex) {
                LOG.warn("Falha ao renderizar barChart de regras", ex);
            }
            PdfPTable rulesT = ReportV2PdfTheme.table(new float[] {2F, 1.5F, 1.5F});
            ReportV2PdfTheme.headerRow(rulesT, "Regra", "Ocorrencias", "% do total");
            boolean alt = false;
            for (Map.Entry<String, Long> e : topRules) {
                double pct = violations.isEmpty() ? 0 : (e.getValue() * 100.0 / violations.size());
                ReportV2PdfTheme.bodyRow(rulesT, alt, e.getKey(), String.valueOf(e.getValue()),
                    String.format(PT_BR, "%.1f%%", pct));
                alt = !alt;
            }
            doc.add(rulesT);

            // Exames mais problematicos
            Map<String, Long> byExam = violations.stream()
                .filter(v -> v.getQcRecord() != null)
                .collect(Collectors.groupingBy(
                    v -> v.getQcRecord().getExamName() == null ? "-" : v.getQcRecord().getExamName(),
                    LinkedHashMap::new, Collectors.counting()));
            List<Map.Entry<String, Long>> topExames = byExam.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(10).collect(Collectors.toList());
            if (!topExames.isEmpty()) {
                doc.add(ReportV2PdfTheme.section("Exames mais problematicos"));
                Map<String, Number> examDs = new LinkedHashMap<>();
                topExames.forEach(e -> examDs.put(e.getKey(), e.getValue()));
                try {
                    byte[] png = chartRenderer.renderBarChart(examDs, "Violacoes por exame", "Exame", "Ocorrencias");
                    Image img = Image.getInstance(png);
                    img.scaleToFit(500F, 220F);
                    img.setAlignment(Element.ALIGN_CENTER);
                    doc.add(img);
                } catch (Exception ex) {
                    LOG.warn("Falha ao renderizar barChart de exames", ex);
                }
            }

            // Heatmap dia-semana x semana-mes
            doc.add(ReportV2PdfTheme.section("Distribuicao temporal (dia da semana x semana do mes)"));
            double[][] matrix = new double[7][5]; // dia [0..6] x semana [0..4]
            for (WestgardViolation v : violations) {
                if (v.getQcRecord() == null || v.getQcRecord().getDate() == null) continue;
                LocalDate d = v.getQcRecord().getDate();
                int dow = d.getDayOfWeek().getValue() - 1; // 0..6 (Seg..Dom)
                int week = Math.min(4, (d.getDayOfMonth() - 1) / 7);
                matrix[dow][week]++;
            }
            List<String> xLabels = List.of("Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom");
            List<String> yLabels = List.of("Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5");
            try {
                byte[] png = chartRenderer.renderHeatmap(matrix, xLabels, yLabels, "Violacoes no tempo");
                Image img = Image.getInstance(png);
                img.scaleToFit(500F, 220F);
                img.setAlignment(Element.ALIGN_CENTER);
                doc.add(img);
            } catch (Exception ex) {
                LOG.warn("Falha ao renderizar heatmap", ex);
            }

            // Lista detalhada top 30
            doc.add(ReportV2PdfTheme.section("Ultimas violacoes"));
            PdfPTable detail = ReportV2PdfTheme.table(new float[] {1.2F, 1.3F, 2.2F, 1.3F, 1.5F, 3.5F});
            ReportV2PdfTheme.headerRow(detail, "Regra", "Severidade", "Exame", "Lote", "Data", "Descricao");
            alt = false;
            int limit = Math.min(30, violations.size());
            for (int i = 0; i < limit; i++) {
                WestgardViolation v = violations.get(i);
                ReportV2PdfTheme.bodyRow(detail, alt,
                    ReportV2PdfTheme.safe(v.getRule()),
                    ReportV2PdfTheme.safe(v.getSeverity()),
                    v.getQcRecord() == null ? "-" : ReportV2PdfTheme.safe(v.getQcRecord().getExamName()),
                    v.getQcRecord() == null ? "-" : ReportV2PdfTheme.safe(v.getQcRecord().getLotNumber()),
                    v.getQcRecord() == null ? "-" : ReportV2PdfTheme.formatDate(v.getQcRecord().getDate()),
                    ReportV2PdfTheme.safe(v.getDescription())
                );
                alt = !alt;
            }
            doc.add(detail);

            // Comentario IA
            if (rf.includeAiCommentary) {
                doc.add(ReportV2PdfTheme.section("Analise executiva"));
                String structured = "Area: " + rf.area + "\nPeriodo: " + rf.periodLabel
                    + "\nTotal: " + violations.size() + "\nRejeicoes: " + rejeicoes;
                String commentary = aiCommentator.commentary(ReportCode.WESTGARD_DEEPDIVE, structured, ctx);
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
            throw new IllegalStateException("Falha ao gerar Westgard deep dive PDF", ex);
        }
    }

    private List<WestgardViolation> loadViolations(Resolved rf) {
        return violationRepository.findAll().stream()
            .filter(v -> v.getQcRecord() != null && v.getQcRecord().getDate() != null
                && !v.getQcRecord().getDate().isBefore(rf.start)
                && !v.getQcRecord().getDate().isAfter(rf.end)
                && (rf.area == null || (v.getQcRecord().getArea() != null
                        && v.getQcRecord().getArea().equalsIgnoreCase(rf.area))))
            .filter(v -> rf.rules == null || rf.rules.isEmpty() || rf.rules.contains(v.getRule()))
            .filter(v -> rf.severity == null || rf.severity.isBlank()
                || (v.getSeverity() != null && v.getSeverity().equalsIgnoreCase(rf.severity)))
            .sorted(Comparator.comparing((WestgardViolation v) -> v.getQcRecord().getDate()).reversed())
            .collect(Collectors.toList());
    }

    private PdfPCell summaryCell(String label, String value, java.awt.Color color) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(8F);
        cell.setBorderColor(ReportV2PdfTheme.BORDER);
        Paragraph l = new Paragraph(label, ReportV2PdfTheme.META_FONT);
        l.setAlignment(Element.ALIGN_CENTER);
        cell.addElement(l);
        Paragraph v = new Paragraph(value,
            com.lowagie.text.FontFactory.getFont(com.lowagie.text.FontFactory.HELVETICA_BOLD, 14, color));
        v.setAlignment(Element.ALIGN_CENTER);
        cell.addElement(v);
        return cell;
    }

    private Resolved resolve(ReportFilters filters) {
        Resolved r = new Resolved();
        r.area = filters.getString("area")
            .map(s -> s.trim().toLowerCase(Locale.ROOT))
            .orElseThrow(() -> new IllegalArgumentException("Filtro 'area' obrigatorio"));
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
                r.start = filters.getDate("dateFrom").orElseThrow(
                    () -> new IllegalArgumentException("dateFrom obrigatorio em date-range"));
                r.end = filters.getDate("dateTo").orElseThrow(
                    () -> new IllegalArgumentException("dateTo obrigatorio em date-range"));
                r.periodLabel = r.start.format(DateTimeFormatter.ISO_DATE) + " a "
                    + r.end.format(DateTimeFormatter.ISO_DATE);
            }
            default -> {
                YearMonth ym = YearMonth.now();
                r.start = ym.atDay(1); r.end = ym.atEndOfMonth();
                r.periodLabel = capitalize(ym.getMonth().getDisplayName(TextStyle.FULL, PT_BR)) + "/" + ym.getYear();
            }
        }
        r.rules = filters.getStringList("rules").orElse(null);
        r.severity = filters.getString("severity").orElse(null);
        return r;
    }

    private static String capitalize(String v) {
        if (v == null || v.isEmpty()) return "";
        return v.substring(0, 1).toUpperCase(PT_BR) + v.substring(1);
    }

    static final class Resolved {
        String area;
        LocalDate start;
        LocalDate end;
        String periodLabel;
        List<String> rules;
        String severity;
        boolean includeAiCommentary;
    }
}

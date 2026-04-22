package com.biodiagnostico.service.reports.v2.generator.impl;

import com.biodiagnostico.entity.AreaQcMeasurement;
import com.biodiagnostico.entity.HematologyBioRecord;
import com.biodiagnostico.entity.HematologyQcMeasurement;
import com.biodiagnostico.entity.LabSettings;
import com.biodiagnostico.entity.PostCalibrationRecord;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.WestgardViolation;
import com.biodiagnostico.repository.AreaQcMeasurementRepository;
import com.biodiagnostico.repository.HematologyBioRecordRepository;
import com.biodiagnostico.repository.HematologyQcMeasurementRepository;
import com.biodiagnostico.repository.PostCalibrationRecordRepository;
import com.biodiagnostico.repository.QcRecordRepository;
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
import com.biodiagnostico.service.reports.v2.generator.comparison.ComparisonWindow;
import com.biodiagnostico.service.reports.v2.generator.comparison.PeriodComparator;
import com.biodiagnostico.service.reports.v2.generator.comparison.ResolvedPeriod;
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
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.DoubleSummaryStatistics;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gerador operacional de CQ V2 (evolucao Fase 2). Produz um laudo completo
 * com capa institucional, resumo executivo, tabelas por exame, graficos
 * Levey-Jennings embutidos, secao Westgard, pos-calibracao, comparativo
 * vs periodo anterior e comentario IA.
 *
 * <p>V1 ({@code PdfReportService}) permanece intocado. Reutiliza os mesmos
 * repositorios para garantir equivalencia numerica de dados.
 */
@Component
public class CqOperationalV2Generator implements ReportGenerator {

    private static final Logger LOG = LoggerFactory.getLogger(CqOperationalV2Generator.class);
    private static final Locale PT_BR = ReportV2PdfTheme.PT_BR;
    private static final int MAX_LJ_CHARTS = 6;
    private static final int MAX_VIOLATIONS_ROWS = 50;

    private final QcRecordRepository qcRecordRepository;
    private final PostCalibrationRecordRepository postCalibrationRecordRepository;
    private final AreaQcMeasurementRepository areaQcMeasurementRepository;
    private final HematologyQcMeasurementRepository hematologyQcMeasurementRepository;
    private final HematologyBioRecordRepository hematologyBioRecordRepository;
    private final WestgardViolationRepository westgardViolationRepository;
    private final ReportNumberingService reportNumberingService;
    private final ChartRenderer chartRenderer;
    private final LabHeaderRenderer headerRenderer;
    private final LabSettingsService labSettingsService;
    private final PeriodComparator periodComparator;
    private final ReportAiCommentator aiCommentator;

    @Autowired
    public CqOperationalV2Generator(
        QcRecordRepository qcRecordRepository,
        PostCalibrationRecordRepository postCalibrationRecordRepository,
        AreaQcMeasurementRepository areaQcMeasurementRepository,
        HematologyQcMeasurementRepository hematologyQcMeasurementRepository,
        HematologyBioRecordRepository hematologyBioRecordRepository,
        WestgardViolationRepository westgardViolationRepository,
        ReportNumberingService reportNumberingService,
        ChartRenderer chartRenderer,
        LabHeaderRenderer headerRenderer,
        LabSettingsService labSettingsService,
        PeriodComparator periodComparator,
        ReportAiCommentator aiCommentator
    ) {
        this.qcRecordRepository = qcRecordRepository;
        this.postCalibrationRecordRepository = postCalibrationRecordRepository;
        this.areaQcMeasurementRepository = areaQcMeasurementRepository;
        this.hematologyQcMeasurementRepository = hematologyQcMeasurementRepository;
        this.hematologyBioRecordRepository = hematologyBioRecordRepository;
        this.westgardViolationRepository = westgardViolationRepository;
        this.reportNumberingService = reportNumberingService;
        this.chartRenderer = chartRenderer;
        this.headerRenderer = headerRenderer;
        this.labSettingsService = labSettingsService;
        this.periodComparator = periodComparator;
        this.aiCommentator = aiCommentator;
    }

    @Override
    public ReportDefinition definition() {
        return ReportDefinitionRegistry.CQ_OPERATIONAL_V2_DEFINITION;
    }

    @Override
    @Transactional
    public ReportArtifact generate(ReportFilters filters, GenerationContext ctx) {
        ResolvedFilters rf = resolveFilters(filters);
        String reportNumber = reportNumberingService.reserveNextNumber();
        byte[] pdfBytes = renderPdf(rf, ctx, reportNumber);
        String sha256 = reportNumberingService.sha256Hex(pdfBytes);

        reportNumberingService.registerGeneration(
            reportNumber, rf.area, "PDF", rf.periodLabel, pdfBytes, ctx == null ? null : ctx.userId()
        );
        String filename = reportNumber + ".pdf";
        return new ReportArtifact(
            pdfBytes, "application/pdf", filename, 0, pdfBytes.length,
            reportNumber, sha256, rf.periodLabel
        );
    }

    @Override
    @Transactional(readOnly = true)
    public ReportPreview preview(ReportFilters filters, GenerationContext ctx) {
        ResolvedFilters rf = resolveFilters(filters);
        List<String> warnings = new ArrayList<>();

        StringBuilder html = new StringBuilder();
        html.append("<section class=\"preview-cq-operacional\" style=\"font-family:sans-serif\">");
        html.append("<h1 style=\"color:#14532d\">Relatorio Operacional de CQ</h1>");
        html.append("<p style=\"color:#6b7280\">Area: ").append(escape(areaLabel(rf.area)))
            .append(" &middot; Periodo: ").append(escape(rf.periodLabel)).append("</p>");

        PeriodSummary summary = gatherSummary(rf);
        if (summary.total == 0) {
            warnings.add("Nenhum registro encontrado no periodo selecionado.");
        }
        html.append("<div style=\"display:flex;gap:12px;margin:12px 0\">")
            .append(box("Total", String.valueOf(summary.total), "#166534"))
            .append(box("Aprovados", String.valueOf(summary.approved), "#16a34a"))
            .append(box("Alertas", String.valueOf(summary.alerted), "#eab308"))
            .append(box("Reprovados", String.valueOf(summary.rejected), "#dc2626"))
            .append(box("Taxa", String.format(PT_BR, "%.1f%%", summary.approvalRate()), "#166534"))
            .append("</div>");

        if (rf.includeComparison) {
            Optional<ComparisonWindow> prev = periodComparator.previousWindow(rf.toResolvedPeriod());
            if (prev.isPresent()) {
                PeriodSummary prevSummary = gatherSummaryFor(rf.area, prev.get().start(), prev.get().end(), rf.examIds);
                double delta = summary.approvalRate() - prevSummary.approvalRate();
                String arrow = delta >= 0 ? "&#8593;" : "&#8595;";
                String color = delta >= 0 ? "#16a34a" : "#dc2626";
                html.append("<p>vs ").append(escape(prev.get().label()))
                    .append(": <strong style=\"color:").append(color).append("\">")
                    .append(String.format(PT_BR, "%+.1f%%", delta)).append(" ").append(arrow)
                    .append("</strong></p>");
            } else {
                html.append("<p style=\"color:#b45309\">Comparativo indisponivel para periodo customizado.</p>");
            }
        }

        switch (rf.area) {
            case "hematologia" -> {
                int meds = hematologyQcMeasurementRepository
                    .findByDataMedicaoBetweenOrderByDataMedicaoDesc(rf.start, rf.end).size();
                int bio = hematologyBioRecordRepository
                    .findByDataBioBetweenOrderByDataBioDesc(rf.start, rf.end).size();
                html.append("<p>Medicoes QC: <strong>").append(meds).append("</strong></p>");
                html.append("<p>Registros Bio x Controle Interno: <strong>").append(bio).append("</strong></p>");
            }
            case "imunologia", "parasitologia", "microbiologia", "uroanalise" -> {
                int meds = areaQcMeasurementRepository
                    .findByAreaAndDataMedicaoBetweenOrderByDataMedicaoDesc(rf.area, rf.start, rf.end).size();
                html.append("<p>Medicoes: <strong>").append(meds).append("</strong></p>");
            }
            default -> {
                html.append("<p>Registros de bioquimica: <strong>").append(summary.total).append("</strong></p>");
            }
        }

        if (rf.includeAiCommentary) {
            html.append("<p style=\"color:#14532d\"><em>Comentario IA: sera gerado no PDF final.</em></p>");
        }

        html.append("</section>");
        return new ReportPreview(html.toString(), warnings, rf.periodLabel);
    }

    // ---------- Render ----------

    private byte[] renderPdf(ResolvedFilters rf, GenerationContext ctx, String reportNumber) {
        LabSettings settings = ctx != null && ctx.labSettings() != null
            ? ctx.labSettings()
            : labSettingsService.getOrCreateSingleton();
        String responsibleName = settings == null ? "" : settings.getResponsibleName();

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 36F, 36F, 40F, 54F);
            PdfWriter writer = PdfWriter.getInstance(document, out);
            writer.setPageEvent(new PdfFooterRenderer(reportNumber, responsibleName));
            document.open();

            // 1. Capa institucional
            ReportArtifact headerArtifact = new ReportArtifact(
                new byte[] { 0x25, 0x50 /* placeholder */ },
                "application/pdf", reportNumber + ".pdf",
                1, 2L, reportNumber,
                "0000000000000000000000000000000000000000000000000000000000000000",
                rf.periodLabel
            );
            headerRenderer.render(document, writer, settings, definition(), headerArtifact);

            // Contexto de dados
            PeriodSummary summary = gatherSummary(rf);

            // 2. Resumo executivo
            renderExecutiveSummary(document, summary, rf);

            // 3. Tabela por exame
            document.add(ReportV2PdfTheme.section("Estatistica por exame"));
            switch (rf.area) {
                case "hematologia" -> renderHematologyTables(document, rf);
                case "imunologia", "parasitologia", "microbiologia", "uroanalise" ->
                    renderGenericAreaTable(document, rf);
                default -> renderBioquimicaTable(document, rf);
            }

            // 4. Graficos Levey-Jennings (bioquimica)
            if ("bioquimica".equals(rf.area)) {
                renderLeveyJenningsCharts(document, rf);
            }

            // 5. Westgard detalhado
            renderWestgardSection(document, rf);

            // 6. Pos-calibracao (bioquimica)
            if ("bioquimica".equals(rf.area)) {
                renderPostCalibration(document, rf);
            }

            // 7. Comparativo
            if (rf.includeComparison) {
                renderComparison(document, rf, summary);
            }

            // 8. Comentario IA
            if (rf.includeAiCommentary) {
                renderAiCommentary(document, rf, summary, ctx);
            }

            document.close();
            return out.toByteArray();
        } catch (DocumentException | java.io.IOException ex) {
            throw new IllegalStateException("Falha ao gerar PDF operacional V2", ex);
        }
    }

    private void renderExecutiveSummary(Document document, PeriodSummary summary, ResolvedFilters rf)
        throws DocumentException {
        document.add(ReportV2PdfTheme.section("Resumo executivo"));
        PdfPTable cards = new PdfPTable(new float[] {1, 1, 1, 1, 1});
        cards.setWidthPercentage(100F);
        cards.setSpacingAfter(8F);
        cards.addCell(summaryCard("Total", String.valueOf(summary.total), ReportV2PdfTheme.BRAND_PRIMARY));
        cards.addCell(summaryCard("Aprovados", String.valueOf(summary.approved), ReportV2PdfTheme.STATUS_APROVADO));
        cards.addCell(summaryCard("Alertas", String.valueOf(summary.alerted), ReportV2PdfTheme.STATUS_ALERTA));
        cards.addCell(summaryCard("Reprovados", String.valueOf(summary.rejected), ReportV2PdfTheme.STATUS_REPROVADO));
        cards.addCell(summaryCard("Taxa aprovacao",
            String.format(PT_BR, "%.1f%%", summary.approvalRate()), ReportV2PdfTheme.BRAND_DARK));
        document.add(cards);

        if (rf.includeComparison) {
            Optional<ComparisonWindow> prev = periodComparator.previousWindow(rf.toResolvedPeriod());
            if (prev.isPresent()) {
                PeriodSummary prevSummary = gatherSummaryFor(rf.area, prev.get().start(), prev.get().end(), rf.examIds);
                double delta = summary.approvalRate() - prevSummary.approvalRate();
                String arrow = delta >= 0 ? "\u2191" : "\u2193";
                Color c = delta >= 0 ? ReportV2PdfTheme.STATUS_APROVADO : ReportV2PdfTheme.STATUS_REPROVADO;
                Paragraph p = new Paragraph(
                    "vs " + prev.get().label() + ": "
                    + String.format(PT_BR, "%+.1f%% ", delta) + arrow,
                    com.lowagie.text.FontFactory.getFont(
                        com.lowagie.text.FontFactory.HELVETICA_BOLD, 10, c));
                p.setSpacingAfter(6F);
                document.add(p);
            }
        }
    }

    private PdfPCell summaryCard(String label, String value, Color valueColor) {
        PdfPCell cell = new PdfPCell();
        cell.setBackgroundColor(Color.WHITE);
        cell.setBorderColor(ReportV2PdfTheme.BORDER);
        cell.setPadding(8F);
        Paragraph l = new Paragraph(label, ReportV2PdfTheme.META_FONT);
        l.setAlignment(Element.ALIGN_CENTER);
        cell.addElement(l);
        Paragraph v = new Paragraph(value,
            com.lowagie.text.FontFactory.getFont(
                com.lowagie.text.FontFactory.HELVETICA_BOLD, 16, valueColor));
        v.setAlignment(Element.ALIGN_CENTER);
        cell.addElement(v);
        return cell;
    }

    private void renderBioquimicaTable(Document document, ResolvedFilters rf) throws DocumentException {
        List<QcRecord> records = loadBioquimicaRecords(rf);
        if (records.isEmpty()) {
            document.add(new Paragraph("Nenhum registro encontrado no periodo selecionado.", ReportV2PdfTheme.BODY_FONT));
            return;
        }
        Map<String, List<QcRecord>> byExamLevel = records.stream().collect(Collectors.groupingBy(
            r -> safe(r.getExamName()) + " | " + safe(r.getLevel()) + " | " + safe(r.getLotNumber()),
            LinkedHashMap::new, Collectors.toList()));
        PdfPTable table = ReportV2PdfTheme.table(new float[] {2.4F, 1.2F, 1.6F, 1.5F, 1.5F, 1.3F, 1.2F, 1.6F, 1.0F});
        ReportV2PdfTheme.headerRow(table, "Exame", "Nivel", "Lote", "Target", "Media", "DP", "CV%", "Status", "N");
        boolean alt = false;
        for (Map.Entry<String, List<QcRecord>> entry : byExamLevel.entrySet()) {
            List<QcRecord> group = entry.getValue();
            String[] parts = entry.getKey().split(" \\| ");
            String exam = parts.length > 0 ? parts[0] : "-";
            String level = parts.length > 1 ? parts[1] : "-";
            String lot = parts.length > 2 ? parts[2] : "-";
            DoubleSummaryStatistics stats = group.stream().mapToDouble(QcRecord::getValue).summaryStatistics();
            double mean = stats.getAverage();
            double sd = stddev(group, mean);
            double target = group.get(0).getTargetValue() == null ? 0 : group.get(0).getTargetValue();
            double cv = mean == 0 ? 0 : (sd / mean) * 100.0;
            long reprovados = group.stream().filter(r -> "REPROVADO".equalsIgnoreCase(r.getStatus())).count();
            long alertas = group.stream().filter(r -> "ALERTA".equalsIgnoreCase(r.getStatus())).count();
            String status = reprovados > 0 ? "REPROVADO" : (alertas > 0 ? "ALERTA" : "APROVADO");
            ReportV2PdfTheme.statusRow(table, alt, status,
                exam, level, lot,
                ReportV2PdfTheme.formatDecimal(target),
                ReportV2PdfTheme.formatDecimal(mean),
                ReportV2PdfTheme.formatDecimal(sd),
                ReportV2PdfTheme.formatDecimal(cv),
                status,
                String.valueOf(group.size())
            );
            alt = !alt;
        }
        document.add(table);
    }

    private void renderGenericAreaTable(Document document, ResolvedFilters rf) throws DocumentException {
        List<AreaQcMeasurement> meds = areaQcMeasurementRepository
            .findByAreaAndDataMedicaoBetweenOrderByDataMedicaoDesc(rf.area, rf.start, rf.end);
        if (meds.isEmpty()) {
            document.add(new Paragraph("Nenhuma medicao encontrada no periodo selecionado.", ReportV2PdfTheme.BODY_FONT));
            return;
        }
        PdfPTable t = ReportV2PdfTheme.table(new float[] {2.0F, 2.6F, 1.6F, 1.5F, 1.5F, 1.5F, 1.7F, 2.2F, 2.2F, 2.2F});
        ReportV2PdfTheme.headerRow(t, "Data", "Analito", "Valor", "Min", "Max", "Modo", "Status", "Equip.", "Lote", "Nivel");
        boolean alt = false;
        for (AreaQcMeasurement m : meds) {
            ReportV2PdfTheme.statusRow(t, alt, m.getStatus(),
                ReportV2PdfTheme.formatDate(m.getDataMedicao()),
                ReportV2PdfTheme.safe(m.getAnalito()),
                ReportV2PdfTheme.formatDecimal(m.getValorMedido()),
                ReportV2PdfTheme.formatDecimal(m.getMinAplicado()),
                ReportV2PdfTheme.formatDecimal(m.getMaxAplicado()),
                ReportV2PdfTheme.safe(m.getModoUsado()),
                ReportV2PdfTheme.safe(m.getParameter() != null ? m.getParameter().getEquipamento() : null),
                ReportV2PdfTheme.safe(m.getParameter() != null ? m.getParameter().getLoteControle() : null),
                ReportV2PdfTheme.safe(m.getParameter() != null ? m.getParameter().getNivelControle() : null),
                ReportV2PdfTheme.safe(m.getStatus())
            );
            alt = !alt;
        }
        document.add(t);
    }

    private void renderHematologyTables(Document document, ResolvedFilters rf) throws DocumentException {
        List<HematologyQcMeasurement> meds = hematologyQcMeasurementRepository
            .findByDataMedicaoBetweenOrderByDataMedicaoDesc(rf.start, rf.end);
        List<HematologyBioRecord> bioRecs = hematologyBioRecordRepository
            .findByDataBioBetweenOrderByDataBioDesc(rf.start, rf.end);
        if (meds.isEmpty() && bioRecs.isEmpty()) {
            document.add(new Paragraph("Nenhum dado de hematologia encontrado no periodo selecionado.", ReportV2PdfTheme.BODY_FONT));
            return;
        }
        if (!meds.isEmpty()) {
            document.add(ReportV2PdfTheme.subsection("Medicoes QC"));
            PdfPTable t = ReportV2PdfTheme.table(new float[] {1.8F, 2.4F, 1.5F, 1.4F, 1.4F, 1.4F, 1.6F});
            ReportV2PdfTheme.headerRow(t, "Data", "Analito", "Valor", "Min", "Max", "Modo", "Status");
            boolean alt = false;
            for (HematologyQcMeasurement m : meds) {
                ReportV2PdfTheme.statusRow(t, alt, m.getStatus(),
                    ReportV2PdfTheme.formatDate(m.getDataMedicao()),
                    ReportV2PdfTheme.safe(m.getAnalito()),
                    ReportV2PdfTheme.formatDecimal(m.getValorMedido()),
                    ReportV2PdfTheme.formatDecimal(m.getMinAplicado()),
                    ReportV2PdfTheme.formatDecimal(m.getMaxAplicado()),
                    ReportV2PdfTheme.safe(m.getModoUsado()),
                    ReportV2PdfTheme.safe(m.getStatus())
                );
                alt = !alt;
            }
            document.add(t);
        }
        if (!bioRecs.isEmpty()) {
            document.add(ReportV2PdfTheme.subsection("Bio x Controle Interno"));
            PdfPTable t = ReportV2PdfTheme.table(new float[] {2.0F, 2.0F, 1.7F, 1.7F, 1.8F, 1.8F});
            ReportV2PdfTheme.headerRow(t, "Data", "Modo", "RBC", "HGB", "WBC", "PLT");
            boolean alt = false;
            for (HematologyBioRecord r : bioRecs) {
                ReportV2PdfTheme.bodyRow(t, alt,
                    ReportV2PdfTheme.formatDate(r.getDataBio()),
                    ReportV2PdfTheme.safe(r.getModoCi()),
                    ReportV2PdfTheme.formatDecimal(r.getBioHemacias()),
                    ReportV2PdfTheme.formatDecimal(r.getBioHemoglobina()),
                    ReportV2PdfTheme.formatDecimal(r.getBioLeucocitos()),
                    ReportV2PdfTheme.formatDecimal(r.getBioPlaquetas())
                );
                alt = !alt;
            }
            document.add(t);
        }
    }

    private void renderLeveyJenningsCharts(Document document, ResolvedFilters rf) throws DocumentException {
        List<QcRecord> records = loadBioquimicaRecords(rf);
        if (records.isEmpty()) return;
        Map<String, List<QcRecord>> byExamLevel = records.stream().collect(Collectors.groupingBy(
            r -> safe(r.getExamName()) + "|" + safe(r.getLevel()),
            LinkedHashMap::new, Collectors.toList()));

        List<Map.Entry<String, List<QcRecord>>> top = byExamLevel.entrySet().stream()
            .filter(e -> e.getValue().size() >= 5)
            .sorted(Comparator.<Map.Entry<String, List<QcRecord>>>comparingInt(e -> e.getValue().size()).reversed())
            .limit(MAX_LJ_CHARTS)
            .collect(Collectors.toList());
        if (top.isEmpty()) return;

        document.add(ReportV2PdfTheme.section("Graficos Levey-Jennings"));
        for (Map.Entry<String, List<QcRecord>> entry : top) {
            List<QcRecord> group = entry.getValue();
            double target = group.get(0).getTargetValue() == null ? 0 : group.get(0).getTargetValue();
            double sd = group.get(0).getTargetSd() == null || group.get(0).getTargetSd() == 0
                ? Math.max(stddev(group, mean(group)), 0.0001)
                : group.get(0).getTargetSd();
            List<ChartRenderer.LjPoint> points = group.stream()
                .sorted(Comparator.comparing(QcRecord::getDate))
                .map(r -> new ChartRenderer.LjPoint(r.getDate(), r.getValue() == null ? 0 : r.getValue(),
                    safe(r.getStatus())))
                .collect(Collectors.toList());
            String title = entry.getKey().replace('|', ' ');
            try {
                byte[] png = chartRenderer.renderLeveyJennings(points, target, sd, title);
                Image img = Image.getInstance(png);
                img.scaleToFit(500F, 260F);
                img.setAlignment(Element.ALIGN_CENTER);
                document.add(img);
            } catch (Exception ex) {
                LOG.warn("Falha ao renderizar L-J para {}", title, ex);
            }
        }
    }

    private void renderWestgardSection(Document document, ResolvedFilters rf) throws DocumentException {
        List<WestgardViolation> all = westgardViolationRepository.findAll().stream()
            .filter(v -> v.getQcRecord() != null
                && v.getQcRecord().getDate() != null
                && !v.getQcRecord().getDate().isBefore(rf.start)
                && !v.getQcRecord().getDate().isAfter(rf.end)
                && v.getQcRecord().getArea() != null
                && v.getQcRecord().getArea().equalsIgnoreCase(rf.area))
            .sorted(Comparator.comparing((WestgardViolation v) -> v.getQcRecord().getDate()).reversed())
            .collect(Collectors.toList());
        if (all.isEmpty()) {
            // Omitimos secao silenciosamente — ausencia de violacoes e bom sinal
            return;
        }
        document.add(ReportV2PdfTheme.section("Violacoes Westgard"));
        PdfPTable t = ReportV2PdfTheme.table(new float[] {1.4F, 1.2F, 2.4F, 1.2F, 1.6F, 3.8F});
        ReportV2PdfTheme.headerRow(t, "Regra", "Severidade", "Exame", "Lote", "Data", "Descricao");
        boolean alt = false;
        int count = 0;
        for (WestgardViolation v : all) {
            if (count >= MAX_VIOLATIONS_ROWS) break;
            ReportV2PdfTheme.bodyRow(t, alt,
                ReportV2PdfTheme.safe(v.getRule()),
                ReportV2PdfTheme.safe(v.getSeverity()),
                ReportV2PdfTheme.safe(v.getQcRecord().getExamName()),
                ReportV2PdfTheme.safe(v.getQcRecord().getLotNumber()),
                ReportV2PdfTheme.formatDate(v.getQcRecord().getDate()),
                ReportV2PdfTheme.safe(v.getDescription())
            );
            alt = !alt;
            count++;
        }
        document.add(t);
        if (all.size() > MAX_VIOLATIONS_ROWS) {
            Paragraph p = new Paragraph(
                (all.size() - MAX_VIOLATIONS_ROWS) + " violacoes adicionais omitidas.",
                ReportV2PdfTheme.META_FONT);
            document.add(p);
        }
    }

    private void renderPostCalibration(Document document, ResolvedFilters rf) throws DocumentException {
        List<PostCalibrationRecord> post = postCalibrationRecordRepository
            .findByQcRecordAreaAndDateRange("bioquimica", rf.start, rf.end);
        if (post.isEmpty()) return;
        document.add(ReportV2PdfTheme.section("Pos-calibracao"));
        PdfPTable t = ReportV2PdfTheme.table(new float[] {2.6F, 1.6F, 1.6F, 1.2F, 1.2F, 1.2F, 1.4F});
        ReportV2PdfTheme.headerRow(t, "Exame", "Lote", "CV antes", "CV depois", "Delta%", "Status", "Data");
        boolean alt = false;
        for (PostCalibrationRecord r : post) {
            double origCv = r.getOriginalCv() == null ? 0 : r.getOriginalCv();
            double postCv = r.getPostCalibrationCv() == null ? 0 : r.getPostCalibrationCv();
            double delta = postCv - origCv;
            String status = delta < 0 ? "EFICAZ" : (delta == 0 ? "SEM EFEITO" : "PIOROU");
            ReportV2PdfTheme.bodyRow(t, alt,
                ReportV2PdfTheme.safe(r.getExamName()),
                ReportV2PdfTheme.safe(r.getQcRecord() == null ? null : r.getQcRecord().getLotNumber()),
                ReportV2PdfTheme.formatDecimal(origCv),
                ReportV2PdfTheme.formatDecimal(postCv),
                String.format(PT_BR, "%+.2f", delta),
                status,
                ReportV2PdfTheme.formatDate(r.getDate())
            );
            alt = !alt;
        }
        document.add(t);
    }

    private void renderComparison(Document document, ResolvedFilters rf, PeriodSummary current)
        throws DocumentException {
        document.add(ReportV2PdfTheme.section("Comparativo com periodo anterior"));
        Optional<ComparisonWindow> prev = periodComparator.previousWindow(rf.toResolvedPeriod());
        if (prev.isEmpty()) {
            Paragraph p = new Paragraph(
                "Comparativo indisponivel para periodo customizado (date-range).",
                ReportV2PdfTheme.META_FONT);
            document.add(p);
            return;
        }
        PeriodSummary prevSummary = gatherSummaryFor(rf.area, prev.get().start(), prev.get().end(), rf.examIds);
        PdfPTable t = ReportV2PdfTheme.table(new float[] {2.4F, 1.5F, 1.5F, 1.5F, 1.5F, 1.5F, 1.2F});
        ReportV2PdfTheme.headerRow(t, "Metrica", "Atual", "Anterior", "Delta", "Atual %", "Anterior %", "Tendencia");
        renderComparisonRow(t, false, "Total de registros", current.total, prevSummary.total);
        renderComparisonRow(t, true, "Aprovados", current.approved, prevSummary.approved);
        renderComparisonRow(t, false, "Alertas", current.alerted, prevSummary.alerted);
        renderComparisonRow(t, true, "Reprovados", current.rejected, prevSummary.rejected);
        document.add(t);
    }

    private void renderComparisonRow(PdfPTable t, boolean alt, String label, int current, int prev) {
        int delta = current - prev;
        String arrow = delta == 0 ? "=" : (delta > 0 ? "\u2191" : "\u2193");
        ReportV2PdfTheme.bodyRow(t, alt,
            label,
            String.valueOf(current),
            String.valueOf(prev),
            (delta > 0 ? "+" : "") + delta,
            "-",
            "-",
            arrow
        );
    }

    private void renderAiCommentary(Document document, ResolvedFilters rf, PeriodSummary summary, GenerationContext ctx)
        throws DocumentException {
        document.add(ReportV2PdfTheme.section("Analise executiva"));
        String structured = buildStructuredContext(rf, summary);
        String commentary = aiCommentator.commentary(ReportCode.CQ_OPERATIONAL_V2, structured, ctx);
        PdfPTable wrap = new PdfPTable(1);
        wrap.setWidthPercentage(100F);
        PdfPCell cell = new PdfPCell(new Phrase(commentary, ReportV2PdfTheme.AI_FONT));
        cell.setBackgroundColor(ReportV2PdfTheme.BRAND_LIGHT);
        cell.setBorderColor(ReportV2PdfTheme.BRAND_DARK);
        cell.setPadding(10F);
        wrap.addCell(cell);
        document.add(wrap);
    }

    // ---------- Helpers de dados ----------

    private List<QcRecord> loadBioquimicaRecords(ResolvedFilters rf) {
        List<QcRecord> records = qcRecordRepository.findByAreaAndDateRange("bioquimica", rf.start, rf.end);
        if (!rf.examIds.isEmpty()) {
            records = records.stream()
                .filter(r -> r.getReference() != null
                    && r.getReference().getExam() != null
                    && rf.examIds.contains(r.getReference().getExam().getId()))
                .collect(Collectors.toList());
        }
        return records;
    }

    private PeriodSummary gatherSummary(ResolvedFilters rf) {
        return gatherSummaryFor(rf.area, rf.start, rf.end, rf.examIds);
    }

    private PeriodSummary gatherSummaryFor(String area, LocalDate start, LocalDate end, List<UUID> examIds) {
        PeriodSummary s = new PeriodSummary();
        List<QcRecord> records = qcRecordRepository.findByAreaAndDateRange(area, start, end);
        if (examIds != null && !examIds.isEmpty()) {
            records = records.stream()
                .filter(r -> r.getReference() != null
                    && r.getReference().getExam() != null
                    && examIds.contains(r.getReference().getExam().getId()))
                .collect(Collectors.toList());
        }
        s.total = records.size();
        s.approved = (int) records.stream().filter(r -> "APROVADO".equalsIgnoreCase(r.getStatus())).count();
        s.alerted = (int) records.stream().filter(r -> "ALERTA".equalsIgnoreCase(r.getStatus())).count();
        s.rejected = (int) records.stream().filter(r -> "REPROVADO".equalsIgnoreCase(r.getStatus())).count();
        return s;
    }

    private String buildStructuredContext(ResolvedFilters rf, PeriodSummary summary) {
        StringBuilder sb = new StringBuilder();
        sb.append("Area: ").append(areaLabel(rf.area)).append('\n');
        sb.append("Periodo: ").append(rf.periodLabel).append('\n');
        sb.append("Total de registros: ").append(summary.total).append('\n');
        sb.append("Aprovados: ").append(summary.approved).append(" ("
            + String.format(PT_BR, "%.1f%%", summary.approvalRate()) + ")\n");
        sb.append("Alertas: ").append(summary.alerted).append('\n');
        sb.append("Reprovados: ").append(summary.rejected).append('\n');
        if (rf.includeComparison) {
            Optional<ComparisonWindow> prev = periodComparator.previousWindow(rf.toResolvedPeriod());
            if (prev.isPresent()) {
                PeriodSummary prevSummary = gatherSummaryFor(rf.area, prev.get().start(), prev.get().end(), rf.examIds);
                sb.append("Periodo anterior (").append(prev.get().label()).append("): ")
                  .append(prevSummary.total).append(" registros, taxa ")
                  .append(String.format(PT_BR, "%.1f%%", prevSummary.approvalRate())).append('\n');
            }
        }
        return sb.toString();
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
        boolean includeAi = filters.getBoolean("includeAiCommentary").orElse(false);
        boolean includeComp = filters.getBoolean("includeComparison").orElse(false);

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
                periodType = "current-month";
            }
        }

        ResolvedFilters rf = new ResolvedFilters();
        rf.area = area;
        rf.periodType = periodType;
        rf.start = start;
        rf.end = end;
        rf.periodLabel = label;
        rf.examIds = examIds;
        rf.includeAiCommentary = includeAi;
        rf.includeComparison = includeComp;
        return rf;
    }

    // ---------- Helpers estaticos ----------

    private static double mean(List<QcRecord> recs) {
        return recs.stream().mapToDouble(r -> r.getValue() == null ? 0 : r.getValue()).average().orElse(0);
    }

    private static double stddev(List<QcRecord> recs, double mean) {
        if (recs.size() < 2) return 0;
        double sum = 0;
        int n = 0;
        for (QcRecord r : recs) {
            if (r.getValue() == null) continue;
            double d = r.getValue() - mean;
            sum += d * d;
            n++;
        }
        return n < 2 ? 0 : Math.sqrt(sum / (n - 1));
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

    private static String capitalize(String v) {
        if (v == null || v.isBlank()) return "";
        return v.substring(0, 1).toUpperCase(PT_BR) + v.substring(1);
    }

    private static String safe(String v) {
        return v == null ? "-" : v;
    }

    private static String escape(String v) {
        if (v == null) return "";
        return v.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String box(String label, String value, String color) {
        return "<div style=\"flex:1;border:1px solid #e5e7eb;padding:8px;text-align:center\">"
            + "<div style=\"font-size:10px;color:#6b7280\">" + label + "</div>"
            + "<div style=\"font-size:18px;font-weight:bold;color:" + color + "\">" + value + "</div>"
            + "</div>";
    }

    // ---------- Data classes ----------

    /** Filtros normalizados + datas resolvidas. */
    static final class ResolvedFilters {
        String area;
        String periodType;
        LocalDate start;
        LocalDate end;
        String periodLabel;
        List<UUID> examIds = List.of();
        boolean includeAiCommentary;
        boolean includeComparison;

        ResolvedPeriod toResolvedPeriod() {
            return new ResolvedPeriod(periodType, start, end, periodLabel);
        }
    }

    /** Resumo rapido por periodo (contagens). */
    static final class PeriodSummary {
        int total;
        int approved;
        int alerted;
        int rejected;

        double approvalRate() {
            return total == 0 ? 0.0 : (approved * 100.0) / total;
        }
    }
}

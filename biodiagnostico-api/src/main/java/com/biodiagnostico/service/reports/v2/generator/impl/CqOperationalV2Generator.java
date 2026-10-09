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
import com.biodiagnostico.service.reports.QcReferenceReportGrouping;
import com.biodiagnostico.service.reports.QcReferenceReportGrouping.Group;
import com.biodiagnostico.service.reports.QcReferenceReportGrouping.ReferenceKey;
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
import com.biodiagnostico.service.reports.v2.util.WestgardSeverity;
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
 * <p>Reutiliza os mesmos repositorios do V1 para garantir equivalencia
 * numerica de dados; referencia e valores historicos vem do registro persistido.
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
    private final com.biodiagnostico.config.ReportsV2Properties properties;

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
        ReportAiCommentator aiCommentator,
        com.biodiagnostico.config.ReportsV2Properties properties
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
        this.properties = properties;
    }

    /**
     * Classifica o efeito de uma calibracao segundo a tolerancia configurada em
     * {@code reports.v2.calibration-effective-delta-tolerance} (default 0.5 pp).
     * Mesma regra do CalibracaoPrePostGenerator.
     */
    private String classifyCalibrationDelta(double delta) {
        double tol = properties == null ? 0.5 : properties.getCalibrationEffectiveDeltaTolerance();
        if (delta <= -tol) return "EFICAZ";
        if (delta >= tol) return "PIOROU";
        return "SEM EFEITO";
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
                if (rf.isPartialCurrentMonth()) {
                    html.append("<p style=\"color:#b45309\"><em>")
                        .append(escape(partialCurrentMonthNotice(LocalDate.now())))
                        .append("</em></p>");
                }
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

            // 8. Historico diario — uma sub-secao por dia com TODOS os registros
            if (rf.includeDailyHistory) {
                renderDailyHistory(document, rf);
            }

            // 9. Comentario IA
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
                if (rf.isPartialCurrentMonth()) {
                    Paragraph notice = new Paragraph(
                        partialCurrentMonthNotice(LocalDate.now()),
                        com.lowagie.text.FontFactory.getFont(
                            com.lowagie.text.FontFactory.HELVETICA_OBLIQUE, 8,
                            ReportV2PdfTheme.STATUS_ALERTA));
                    notice.setSpacingAfter(6F);
                    document.add(notice);
                }
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
        boolean identifyReferences = "bioquimica".equals(rf.area);
        List<Group<QcRecord>> references;
        if (identifyReferences) {
            references = QcReferenceReportGrouping.groups(records);
        } else {
            // Preserve the pre-existing summary fallback for other areas.
            Map<String, List<QcRecord>> legacyGroups = records.stream().collect(Collectors.groupingBy(
                this::legacyReferenceGroupingKey, LinkedHashMap::new, Collectors.toList()));
            references = legacyGroups.values().stream().map(group -> new Group<>(group.getFirst(), group)).toList();
        }
        float[] widths = {2.4F, 1.2F, 1.6F, 1.5F, 1.5F, 1.3F, 1.2F, 1.6F, 1.0F};
        PdfPTable table = ReportV2PdfTheme.table(widths);
        if (!identifyReferences) {
            ReportV2PdfTheme.headerRow(table, "Exame", "Nivel", "Lote", "Target", "Media", "DP", "CV%", "Status", "N");
        }
        boolean alternate = false;
        for (Group<QcRecord> reference : references) {
            List<QcRecord> group = reference.items();
            QcRecord first = reference.record();
            if (identifyReferences) {
                table = ReportV2PdfTheme.table(widths);
                addReferenceHeader(table, first, records, null);
                ReportV2PdfTheme.headerRow(table, "Exame", "Nivel", "Lote", "Target", "Media", "DP", "CV%", "Status", "N");
                table.setHeaderRows(2);
            }
            String exam = safe(first.getExamName());
            String level = safe(first.getLevel());
            String lot = safe(first.getLotNumber());
            // T6: usa Statistics (BigDecimal interno) — estabilidade numerica
            // em series longas. Apresentacao final continua em double/%.2f.
            List<Double> values = group.stream()
                .map(QcRecord::getValue)
                .collect(Collectors.toList());
            double mean = com.biodiagnostico.service.reports.v2.util.Statistics
                .mean(values).doubleValue();
            double sd = com.biodiagnostico.service.reports.v2.util.Statistics
                .stdDev(values).doubleValue();
            double cv = com.biodiagnostico.service.reports.v2.util.Statistics
                .cv(values).doubleValue();
            double target = first.getTargetValue() == null ? 0 : first.getTargetValue();
            long reprovados = group.stream().filter(r -> "REPROVADO".equalsIgnoreCase(r.getStatus())).count();
            long alertas = group.stream().filter(r -> "ALERTA".equalsIgnoreCase(r.getStatus())).count();
            String status = reprovados > 0 ? "REPROVADO" : (alertas > 0 ? "ALERTA" : "APROVADO");
            ReportV2PdfTheme.statusRow(table, alternate, status,
                exam, level, lot,
                ReportV2PdfTheme.formatDecimal(target),
                ReportV2PdfTheme.formatDecimal(mean),
                ReportV2PdfTheme.formatDecimal(sd),
                ReportV2PdfTheme.formatDecimal(cv),
                status,
                String.valueOf(group.size())
            );
            alternate = !alternate;
            if (identifyReferences) document.add(table);
        }
        if (!identifyReferences) document.add(table);
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
        Map<ReferenceKey, List<QcRecord>> byReference = records.stream().collect(Collectors.groupingBy(
            QcReferenceReportGrouping::key,
            LinkedHashMap::new,
            Collectors.toList()));

        List<QcRecord> selected = byReference.entrySet().stream()
            .filter(e -> e.getValue().size() >= 5)
            .sorted(Comparator.<Map.Entry<ReferenceKey, List<QcRecord>>>comparingInt(e -> e.getValue().size()).reversed())
            .limit(MAX_LJ_CHARTS)
            .flatMap(e -> e.getValue().stream())
            .toList();
        if (selected.isEmpty()) return;

        boolean firstChart = true;
        for (Group<QcRecord> reference : QcReferenceReportGrouping.groups(selected)) {
            List<QcRecord> group = reference.items();
            QcRecord first = reference.record();
            double target = first.getTargetValue() == null ? 0 : first.getTargetValue();
            // T6: quando targetSd nao e informado, usa stdDev do grupo via
            // Statistics (BigDecimal). Minimo de 0.0001 para nao quebrar
            // traces L-J (divisao por zero em limites +/-nSD).
            double groupSd = com.biodiagnostico.service.reports.v2.util.Statistics
                .stdDev(group.stream().map(QcRecord::getValue).collect(Collectors.toList()))
                .doubleValue();
            double sd = first.getTargetSd() == null || first.getTargetSd() == 0
                ? Math.max(groupSd, 0.0001)
                : first.getTargetSd();
            List<ChartRenderer.LjPoint> points = group.stream()
                .sorted(Comparator.comparing(QcRecord::getDate))
                .map(r -> new ChartRenderer.LjPoint(r.getDate(), r.getValue() == null ? 0 : r.getValue(),
                    safe(r.getStatus())))
                .collect(Collectors.toList());
            String title = safe(first.getExamName()) + " " + safe(first.getLevel());
            try {
                byte[] png = chartRenderer.renderLeveyJennings(points, target, sd, title);
                Image img = Image.getInstance(png);
                img.scaleToFit(500F, 260F);
                img.setAlignment(Element.ALIGN_CENTER);
                PdfPTable chartBlock = new PdfPTable(1);
                chartBlock.setWidthPercentage(100F);
                chartBlock.setKeepTogether(true);
                PdfPCell chartCell = new PdfPCell();
                chartCell.setBorder(com.lowagie.text.Rectangle.NO_BORDER);
                chartCell.setPadding(0F);
                if (firstChart) chartCell.addElement(ReportV2PdfTheme.section("Graficos Levey-Jennings"));
                chartCell.addElement(new Paragraph("Referencia: "
                    + QcReferenceReportGrouping.referenceLabel(first, selected), ReportV2PdfTheme.META_FONT));
                chartCell.addElement(img);
                chartBlock.addCell(chartCell);
                document.add(chartBlock);
                firstChart = false;
            } catch (Exception ex) {
                LOG.warn("Falha ao renderizar L-J para {}", title, ex);
            }
        }
    }

    private void renderWestgardSection(Document document, ResolvedFilters rf) throws DocumentException {
        // T5: query janelada (area ja em lowercase em rf.area)
        List<WestgardViolation> all = westgardViolationRepository
            .findByAreaAndPeriod(rf.area, rf.start, rf.end);
        if (all.isEmpty()) {
            // Omitimos secao silenciosamente — ausencia de violacoes e bom sinal
            return;
        }
        document.add(ReportV2PdfTheme.section("Violacoes Westgard"));
        if ("bioquimica".equals(rf.area)) {
            List<WestgardViolation> selected = all.stream().limit(MAX_VIOLATIONS_ROWS).toList();
            List<QcRecord> scope = selected.stream().map(WestgardViolation::getQcRecord).toList();
            for (Group<WestgardViolation> reference : QcReferenceReportGrouping.groups(selected,
                WestgardViolation::getQcRecord,
                v -> v.getQcRecord() == null ? null : v.getQcRecord().getDate(),
                WestgardViolation::getCreatedAt, WestgardViolation::getId)) {
                PdfPTable table = ReportV2PdfTheme.table(new float[] {1.4F, 1.2F, 2.4F, 1.2F, 1.6F, 3.8F});
                addReferenceHeader(table, reference.record(), scope, null);
                ReportV2PdfTheme.headerRow(table, "Regra", "Severidade", "Exame", "Lote", "Data", "Descricao");
                table.setHeaderRows(2);
                boolean alternate = false;
                for (WestgardViolation v : reference.items()) {
                    QcRecord record = v.getQcRecord();
                    ReportV2PdfTheme.bodyRow(table, alternate,
                        ReportV2PdfTheme.safe(v.getRule()),
                        ReportV2PdfTheme.safe(WestgardSeverity.display(v.getSeverity())),
                        ReportV2PdfTheme.safe(record == null ? null : record.getExamName()),
                        ReportV2PdfTheme.safe(record == null ? null : record.getLotNumber()),
                        ReportV2PdfTheme.formatDate(record == null ? null : record.getDate()),
                        ReportV2PdfTheme.safe(v.getDescription()));
                    alternate = !alternate;
                }
                document.add(table);
            }
            if (all.size() > MAX_VIOLATIONS_ROWS) {
                document.add(new Paragraph((all.size() - MAX_VIOLATIONS_ROWS)
                    + " violacoes adicionais omitidas.", ReportV2PdfTheme.META_FONT));
            }
            return;
        }
        PdfPTable t = ReportV2PdfTheme.table(new float[] {1.4F, 1.2F, 2.4F, 1.2F, 1.6F, 3.8F});
        ReportV2PdfTheme.headerRow(t, "Regra", "Severidade", "Exame", "Lote", "Data", "Descricao");
        boolean alt = false;
        int count = 0;
        for (WestgardViolation v : all) {
            if (count >= MAX_VIOLATIONS_ROWS) break;
            ReportV2PdfTheme.bodyRow(t, alt,
                ReportV2PdfTheme.safe(v.getRule()),
                ReportV2PdfTheme.safe(WestgardSeverity.display(v.getSeverity())),
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
        List<QcRecord> scope = post.stream().map(PostCalibrationRecord::getQcRecord).toList();
        for (Group<PostCalibrationRecord> reference : QcReferenceReportGrouping.groups(post,
            PostCalibrationRecord::getQcRecord, PostCalibrationRecord::getDate,
            PostCalibrationRecord::getCreatedAt, PostCalibrationRecord::getId)) {
            PdfPTable t = ReportV2PdfTheme.table(new float[] {2.6F, 1.6F, 1.6F, 1.2F, 1.2F, 1.2F, 1.4F});
            addReferenceHeader(t, reference.record(), scope, null);
            ReportV2PdfTheme.headerRow(t, "Exame", "Lote", "CV antes", "CV depois", "Delta%", "Status", "Data");
            t.setHeaderRows(2);
            boolean alt = false;
            for (PostCalibrationRecord r : reference.items()) {
                // Espelha CalibracaoPrePostGenerator: CV original/pos null = "SEM MEDICAO".
                // Nao houve medicao, logo nao e decisao de eficacia. NAO coage a 0 nem
                // classifica via classifyCalibrationDelta (evita "EFICAZ"/"SEM EFEITO"
                // espurio contra base 0). CV nulos renderizados como "-" (formatDecimal).
                boolean medido = r.getOriginalCv() != null && r.getPostCalibrationCv() != null;
                String deltaTxt;
                String status;
                if (medido) {
                    double delta = r.getPostCalibrationCv() - r.getOriginalCv();
                    deltaTxt = String.format(PT_BR, "%+.2f", delta);
                    status = classifyCalibrationDelta(delta);
                } else {
                    deltaTxt = "N/D";
                    status = "SEM MEDICAO";
                }
                ReportV2PdfTheme.bodyRow(t, alt,
                    ReportV2PdfTheme.safe(r.getExamName()),
                    ReportV2PdfTheme.safe(r.getQcRecord() == null ? null : r.getQcRecord().getLotNumber()),
                    ReportV2PdfTheme.formatDecimal(r.getOriginalCv()),
                    ReportV2PdfTheme.formatDecimal(r.getPostCalibrationCv()),
                    deltaTxt,
                    status,
                    ReportV2PdfTheme.formatDate(r.getDate())
                );
                alt = !alt;
            }
            document.add(t);
        }
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
        if (rf.isPartialCurrentMonth()) {
            Paragraph notice = new Paragraph(
                partialCurrentMonthNotice(LocalDate.now()),
                com.lowagie.text.FontFactory.getFont(
                    com.lowagie.text.FontFactory.HELVETICA_OBLIQUE, 8,
                    ReportV2PdfTheme.STATUS_ALERTA));
            notice.setSpacingBefore(4F);
            notice.setSpacingAfter(6F);
            document.add(notice);
        }
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

    /**
     * Renderiza bioquimica por referencia e data; demais areas mantem historico por dia.
     * Para cada dia que teve registros: cabecalho com a data + tabela com TODOS
     * os registros daquele dia + sub-resumo (total, aprovados, alertas, reprovados).
     *
     * Suporta as 3 estrategias por area: bioquimica/genericas via QcRecord ou
     * AreaQcMeasurement; hematologia consolida QcMeasurement + BioRecord.
     *
     * Pedido do laboratorio: a vigilancia precisa ver "o que aconteceu em cada dia".
     * Tambem entra automaticamente no REGULATORIO_PACOTE (que herda CQ).
     */
    private void renderDailyHistory(Document document, ResolvedFilters rf) throws DocumentException {
        document.newPage();
        document.add(ReportV2PdfTheme.section("Historico diario"));
        Paragraph intro = new Paragraph(
            "Cada dia abaixo tem um cabecalho com a data e uma tabela cronologica "
            + "com todos os registros lancados naquele dia, seguida de um sub-resumo (total, "
            + "aprovados, alertas, reprovados).",
            ReportV2PdfTheme.META_FONT);
        intro.setSpacingAfter(8F);
        document.add(intro);

        switch (rf.area) {
            case "hematologia" -> renderDailyHistoryHematologia(document, rf);
            case "imunologia", "parasitologia", "microbiologia", "uroanalise" ->
                renderDailyHistoryGenerica(document, rf);
            case "bioquimica" -> renderDailyHistoryBioquimica(document, rf);
            default -> renderDailyHistoryOtherQcRecords(document, rf);
        }
    }

    /** Preserve the existing day-based presentation for other QcRecord areas. */
    private void renderDailyHistoryOtherQcRecords(Document document, ResolvedFilters rf)
            throws DocumentException {
        List<QcRecord> records = qcRecordRepository.findByAreaAndDateRange(rf.area, rf.start, rf.end);
        if (!rf.examIds.isEmpty()) {
            records = records.stream().filter(r -> r.getReference() != null
                && r.getReference().getExam() != null
                && rf.examIds.contains(r.getReference().getExam().getId())).toList();
        }
        if (records.isEmpty()) {
            renderEmptyDailyHistory(document);
            return;
        }
        Map<LocalDate, List<QcRecord>> byDay = records.stream().filter(r -> r.getDate() != null)
            .collect(Collectors.groupingBy(QcRecord::getDate, LinkedHashMap::new, Collectors.toList()));
        for (LocalDate day : byDay.keySet().stream().sorted(Comparator.reverseOrder()).toList()) {
            List<QcRecord> dayRecs = byDay.get(day);
            renderDayHeader(document, day, dayRecs.size(), dayRecs.stream().map(QcRecord::getStatus).toList());
            PdfPTable table = ReportV2PdfTheme.table(new float[] {1.8F, 1F, 1.3F, 1F, 1F, 1F, 1F, 1.4F, 1.2F});
            ReportV2PdfTheme.headerRow(table, "Exame", "Nivel", "Lote", "Valor", "Target", "CV%",
                "Z-score", "Equipamento", "Status");
            boolean alternate = false;
            List<QcRecord> sorted = dayRecs.stream().sorted(Comparator.comparing(QcRecord::getCreatedAt,
                Comparator.nullsLast(Comparator.naturalOrder()))).toList();
            for (QcRecord record : sorted) {
                ReportV2PdfTheme.bodyRow(table, alternate,
                    ReportV2PdfTheme.safe(record.getExamName()),
                    ReportV2PdfTheme.safe(record.getLevel()),
                    ReportV2PdfTheme.safe(record.getLotNumber()),
                    ReportV2PdfTheme.formatDecimal(record.getValue()),
                    ReportV2PdfTheme.formatDecimal(record.getTargetValue()),
                    ReportV2PdfTheme.formatDecimal(record.getCv()),
                    ReportV2PdfTheme.formatDecimal(record.getZScore()),
                    ReportV2PdfTheme.safe(record.getEquipment()),
                    ReportV2PdfTheme.safe(record.getStatus()));
                alternate = !alternate;
            }
            document.add(table);
        }
    }

    private void renderDailyHistoryBioquimica(Document document, ResolvedFilters rf)
            throws DocumentException {
        List<QcRecord> records = loadBioquimicaRecords(rf);
        if (records.isEmpty()) {
            renderEmptyDailyHistory(document);
            return;
        }
        Map<LocalDate, List<QcRecord>> byDay = new LinkedHashMap<>();
        for (QcRecord record : records) {
            byDay.computeIfAbsent(record.getDate(), ignored -> new ArrayList<>()).add(record);
        }
        for (LocalDate day : byDay.keySet().stream()
                .sorted(Comparator.nullsLast(Comparator.reverseOrder())).toList()) {
            List<QcRecord> dayRecs = byDay.get(day);
            renderDayHeader(document, day, dayRecs.size(),
                dayRecs.stream().map(QcRecord::getStatus).toList());
            for (Group<QcRecord> reference : QcReferenceReportGrouping.groups(dayRecs)) {
                PdfPTable t = ReportV2PdfTheme.table(new float[] {1.8F, 1F, 1.3F, 1F, 1F, 1F, 1F, 1.4F, 1.6F});
                addReferenceHeader(t, reference.record(), records, day);
                ReportV2PdfTheme.headerRow(t, "Exame", "Nivel", "Lote", "Valor", "Target", "CV%",
                    "Z-score", "Equip.", "Status");
                t.setHeaderRows(2);
                boolean alt = false;
                for (QcRecord r : reference.items()) {
                    ReportV2PdfTheme.bodyRow(t, alt,
                        ReportV2PdfTheme.safe(r.getExamName()),
                        ReportV2PdfTheme.safe(r.getLevel()),
                        ReportV2PdfTheme.safe(r.getLotNumber()),
                        ReportV2PdfTheme.formatDecimal(r.getValue()),
                        ReportV2PdfTheme.formatDecimal(r.getTargetValue()),
                        ReportV2PdfTheme.formatDecimal(r.getCv()),
                        ReportV2PdfTheme.formatDecimal(r.getZScore()),
                        ReportV2PdfTheme.safe(r.getEquipment()),
                        ReportV2PdfTheme.safe(r.getStatus()));
                    alt = !alt;
                }
                document.add(t);
            }
        }
    }

    /** Repeated together with column titles when a reference table spans pages. */
    private void addReferenceHeader(PdfPTable table, QcRecord record, List<QcRecord> scope, LocalDate day) {
        String text = "Referencia: " + QcReferenceReportGrouping.referenceLabel(record, scope)
            + (day == null ? "" : " | Data: " + ReportV2PdfTheme.formatDate(day));
        PdfPCell cell = new PdfPCell(new Phrase(text, ReportV2PdfTheme.META_FONT));
        cell.setColspan(table.getNumberOfColumns());
        cell.setPadding(0F);
        cell.setPaddingBottom(3F);
        cell.setBackgroundColor(Color.WHITE);
        cell.setBorder(com.lowagie.text.Rectangle.NO_BORDER);
        table.addCell(cell);
    }

    private void renderDailyHistoryGenerica(Document document, ResolvedFilters rf)
            throws DocumentException {
        java.util.List<com.biodiagnostico.entity.AreaQcMeasurement> meds = areaQcMeasurementRepository
            .findByAreaAndDataMedicaoBetweenOrderByDataMedicaoDesc(rf.area, rf.start, rf.end);
        if (meds.isEmpty()) {
            renderEmptyDailyHistory(document);
            return;
        }
        java.util.Map<LocalDate, java.util.List<com.biodiagnostico.entity.AreaQcMeasurement>> byDay = meds.stream()
            .filter(m -> m.getDataMedicao() != null)
            .collect(java.util.stream.Collectors.groupingBy(
                com.biodiagnostico.entity.AreaQcMeasurement::getDataMedicao,
                java.util.LinkedHashMap::new, java.util.stream.Collectors.toList()));

        java.util.List<LocalDate> days = byDay.keySet().stream()
            .sorted(java.util.Comparator.reverseOrder())
            .collect(java.util.stream.Collectors.toList());

        for (LocalDate day : days) {
            java.util.List<com.biodiagnostico.entity.AreaQcMeasurement> dayRecs = byDay.get(day);
            renderDayHeader(document, day, dayRecs.size(), dayRecs.stream()
                .map(com.biodiagnostico.entity.AreaQcMeasurement::getStatus)
                .collect(java.util.stream.Collectors.toList()));
            PdfPTable t = ReportV2PdfTheme.table(new float[] {2F, 1F, 1F, 1F, 1F, 1.2F, 1.2F});
            ReportV2PdfTheme.headerRow(t, "Analito", "Valor", "Min", "Max", "Modo",
                "Equipamento", "Status");
            boolean alt = false;
            for (com.biodiagnostico.entity.AreaQcMeasurement m : dayRecs) {
                String equipamento = m.getParameter() == null ? "—"
                    : ReportV2PdfTheme.safe(m.getParameter().getEquipamento());
                ReportV2PdfTheme.bodyRow(t, alt,
                    ReportV2PdfTheme.safe(m.getAnalito()),
                    ReportV2PdfTheme.formatDecimal(m.getValorMedido()),
                    ReportV2PdfTheme.formatDecimal(m.getMinAplicado()),
                    ReportV2PdfTheme.formatDecimal(m.getMaxAplicado()),
                    ReportV2PdfTheme.safe(m.getModoUsado()),
                    equipamento,
                    ReportV2PdfTheme.safe(m.getStatus()));
                alt = !alt;
            }
            document.add(t);
        }
    }

    private void renderDailyHistoryHematologia(Document document, ResolvedFilters rf)
            throws DocumentException {
        java.util.List<com.biodiagnostico.entity.HematologyQcMeasurement> qc = hematologyQcMeasurementRepository
            .findByDataMedicaoBetweenOrderByDataMedicaoDesc(rf.start, rf.end);
        java.util.List<com.biodiagnostico.entity.HematologyBioRecord> bio = hematologyBioRecordRepository
            .findByDataBioBetweenOrderByDataBioDesc(rf.start, rf.end);
        if (qc.isEmpty() && bio.isEmpty()) {
            renderEmptyDailyHistory(document);
            return;
        }
        java.util.TreeSet<LocalDate> allDays = new java.util.TreeSet<>(java.util.Comparator.reverseOrder());
        qc.forEach(m -> { if (m.getDataMedicao() != null) allDays.add(m.getDataMedicao()); });
        bio.forEach(b -> { if (b.getDataBio() != null) allDays.add(b.getDataBio()); });

        for (LocalDate day : allDays) {
            java.util.List<com.biodiagnostico.entity.HematologyQcMeasurement> dayQc = qc.stream()
                .filter(m -> day.equals(m.getDataMedicao()))
                .collect(java.util.stream.Collectors.toList());
            java.util.List<com.biodiagnostico.entity.HematologyBioRecord> dayBio = bio.stream()
                .filter(b -> day.equals(b.getDataBio()))
                .collect(java.util.stream.Collectors.toList());
            int totalDay = dayQc.size() + dayBio.size();
            renderDayHeader(document, day, totalDay,
                dayQc.stream().map(com.biodiagnostico.entity.HematologyQcMeasurement::getStatus)
                    .collect(java.util.stream.Collectors.toList()));
            if (!dayQc.isEmpty()) {
                document.add(ReportV2PdfTheme.subsection("Controle de qualidade (" + dayQc.size() + ")"));
                PdfPTable t = ReportV2PdfTheme.table(new float[] {2F, 1F, 1F, 1F, 1F, 1.4F});
                ReportV2PdfTheme.headerRow(t, "Analito", "Valor", "Min", "Max", "Modo", "Status");
                boolean alt = false;
                for (com.biodiagnostico.entity.HematologyQcMeasurement m : dayQc) {
                    ReportV2PdfTheme.bodyRow(t, alt,
                        ReportV2PdfTheme.safe(m.getAnalito()),
                        ReportV2PdfTheme.formatDecimal(m.getValorMedido()),
                        ReportV2PdfTheme.formatDecimal(m.getMinAplicado()),
                        ReportV2PdfTheme.formatDecimal(m.getMaxAplicado()),
                        ReportV2PdfTheme.safe(m.getModoUsado()),
                        ReportV2PdfTheme.safe(m.getStatus()));
                    alt = !alt;
                }
                document.add(t);
            }
            if (!dayBio.isEmpty()) {
                document.add(ReportV2PdfTheme.subsection("Bio (" + dayBio.size() + ")"));
                PdfPTable t = ReportV2PdfTheme.table(new float[] {1F, 1F, 1F, 1F, 1F, 1F});
                ReportV2PdfTheme.headerRow(t, "Hemacias", "Hemoglobina", "Leucocitos", "Plaquetas", "RDW", "VPM");
                boolean alt = false;
                for (com.biodiagnostico.entity.HematologyBioRecord b : dayBio) {
                    ReportV2PdfTheme.bodyRow(t, alt,
                        ReportV2PdfTheme.formatDecimal(b.getBioHemacias()),
                        ReportV2PdfTheme.formatDecimal(b.getBioHemoglobina()),
                        ReportV2PdfTheme.formatDecimal(b.getBioLeucocitos()),
                        ReportV2PdfTheme.formatDecimal(b.getBioPlaquetas()),
                        ReportV2PdfTheme.formatDecimal(b.getBioRdw()),
                        ReportV2PdfTheme.formatDecimal(b.getBioVpm()));
                    alt = !alt;
                }
                document.add(t);
            }
        }
    }

    private void renderDayHeader(Document document, LocalDate day, int total, java.util.List<String> statuses)
            throws DocumentException {
        long aprov = statuses.stream().filter(s -> "APROVADO".equalsIgnoreCase(s)).count();
        long alerta = statuses.stream().filter(s -> "ALERTA".equalsIgnoreCase(s)).count();
        long reprov = statuses.stream().filter(s -> "REPROVADO".equalsIgnoreCase(s)).count();

        String dayName = day == null ? "Data não informada" : day.getDayOfWeek().getDisplayName(TextStyle.FULL, PT_BR);
        Paragraph header = new Paragraph();
        header.add(new com.lowagie.text.Chunk(capitalize(dayName) + ", ",
            com.lowagie.text.FontFactory.getFont(
                com.lowagie.text.FontFactory.HELVETICA_BOLD, 11, ReportV2PdfTheme.BRAND_DARK)));
        header.add(new com.lowagie.text.Chunk(ReportV2PdfTheme.formatDate(day),
            com.lowagie.text.FontFactory.getFont(
                com.lowagie.text.FontFactory.HELVETICA_BOLD, 11, ReportV2PdfTheme.BRAND_DARK)));
        header.add(new com.lowagie.text.Chunk("    " + total + " registros",
            ReportV2PdfTheme.META_FONT));
        if (aprov > 0) {
            header.add(new com.lowagie.text.Chunk("    " + aprov + " aprovados",
                com.lowagie.text.FontFactory.getFont(
                    com.lowagie.text.FontFactory.HELVETICA, 9, ReportV2PdfTheme.STATUS_APROVADO)));
        }
        if (alerta > 0) {
            header.add(new com.lowagie.text.Chunk("    " + alerta + " alertas",
                com.lowagie.text.FontFactory.getFont(
                    com.lowagie.text.FontFactory.HELVETICA, 9, ReportV2PdfTheme.STATUS_ALERTA)));
        }
        if (reprov > 0) {
            header.add(new com.lowagie.text.Chunk("    " + reprov + " reprovados",
                com.lowagie.text.FontFactory.getFont(
                    com.lowagie.text.FontFactory.HELVETICA, 9, ReportV2PdfTheme.STATUS_REPROVADO)));
        }
        header.setSpacingBefore(10F);
        header.setSpacingAfter(4F);
        document.add(header);
    }

    private void renderEmptyDailyHistory(Document document) throws DocumentException {
        Paragraph empty = new Paragraph(
            "Nenhum registro encontrado no periodo para popular o historico diario.",
            ReportV2PdfTheme.META_FONT);
        empty.setSpacingAfter(8F);
        document.add(empty);
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

    private String legacyReferenceGroupingKey(QcRecord record) {
        if (record.getReference() != null && record.getReference().getId() != null) {
            return "REF:" + record.getReference().getId();
        }
        return "LEGACY:" + safe(record.getExamName()) + "|" + safe(record.getLevel()) + "|" + safe(record.getLotNumber());
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
        boolean includeDailyHist = filters.getBoolean("includeDailyHistory").orElse(true);

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
        rf.includeDailyHistory = includeDailyHist;
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
        boolean includeDailyHistory;

        ResolvedPeriod toResolvedPeriod() {
            return new ResolvedPeriod(periodType, start, end, periodLabel);
        }

        /**
         * Detecta o "mes corrente parcial": periodType current-month, com o
         * mes/ano do periodo igual ao mes/ano de hoje e hoje ANTES do fim do
         * mes. Nesse caso o periodo cobre apenas dados ate hoje, enquanto o
         * comparativo confronta contra um mes anterior COMPLETO — o que pode
         * subestimar a taxa/tendencia. Usado apenas para emitir ressalva
         * textual; nao altera valores calculados.
         */
        boolean isPartialCurrentMonth() {
            return isPartialCurrentMonth(LocalDate.now());
        }

        boolean isPartialCurrentMonth(LocalDate today) {
            if (!"current-month".equals(periodType) || start == null || end == null) {
                return false;
            }
            YearMonth periodMonth = YearMonth.from(start);
            return periodMonth.equals(YearMonth.from(today)) && today.isBefore(end);
        }
    }

    /**
     * Ressalva exibida junto ao bloco comparativo quando o periodo e o mes
     * corrente parcial. Texto sem acento por padrao do arquivo.
     */
    static String partialCurrentMonthNotice(LocalDate today) {
        String dia = today.format(PARTIAL_NOTICE_DATE_FMT);
        return "Comparativo parcial: o mes corrente inclui dados somente ate " + dia
            + "; a comparacao com o mes anterior completo pode estar subestimada.";
    }

    private static final DateTimeFormatter PARTIAL_NOTICE_DATE_FMT =
        DateTimeFormatter.ofPattern("dd/MM");

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

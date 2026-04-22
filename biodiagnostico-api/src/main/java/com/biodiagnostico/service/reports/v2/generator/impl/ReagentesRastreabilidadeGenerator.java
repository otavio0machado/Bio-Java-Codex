package com.biodiagnostico.service.reports.v2.generator.impl;

import com.biodiagnostico.entity.LabSettings;
import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.repository.ReagentLotRepository;
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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Rastreabilidade de reagentes — lotes, vencimentos, consumo, movimentos.
 * Secoes:
 * 1. Capa
 * 2. Resumo (total, ativos, vencidos c/ estoque, inativos)
 * 3. Vencimentos proximos (30/60/90 dias)
 * 4. Vencidos com estoque (caixa vermelha)
 * 5. Inativos (opt-in)
 * 6. Consumo por categoria (barChart)
 * 7. Comentario IA
 */
@Component
public class ReagentesRastreabilidadeGenerator implements ReportGenerator {

    private static final Logger LOG = LoggerFactory.getLogger(ReagentesRastreabilidadeGenerator.class);

    private final ReagentLotRepository lotRepository;
    private final ReportNumberingService reportNumberingService;
    private final ChartRenderer chartRenderer;
    private final LabHeaderRenderer headerRenderer;
    private final LabSettingsService labSettingsService;
    private final ReportAiCommentator aiCommentator;

    public ReagentesRastreabilidadeGenerator(
        ReagentLotRepository lotRepository,
        ReportNumberingService reportNumberingService,
        ChartRenderer chartRenderer,
        LabHeaderRenderer headerRenderer,
        LabSettingsService labSettingsService,
        ReportAiCommentator aiCommentator
    ) {
        this.lotRepository = lotRepository;
        this.reportNumberingService = reportNumberingService;
        this.chartRenderer = chartRenderer;
        this.headerRenderer = headerRenderer;
        this.labSettingsService = labSettingsService;
        this.aiCommentator = aiCommentator;
    }

    @Override
    public ReportDefinition definition() {
        return ReportDefinitionRegistry.REAGENTES_RASTREABILIDADE_DEFINITION;
    }

    @Override
    @Transactional
    public ReportArtifact generate(ReportFilters filters, GenerationContext ctx) {
        Resolved rf = resolve(filters);
        String reportNumber = reportNumberingService.reserveNextNumber();
        byte[] pdfBytes = renderPdf(rf, ctx, reportNumber);
        String sha256 = reportNumberingService.sha256Hex(pdfBytes);
        reportNumberingService.registerGeneration(reportNumber, "reagentes", "PDF", rf.periodLabel,
            pdfBytes, ctx == null ? null : ctx.userId());
        return new ReportArtifact(pdfBytes, "application/pdf", reportNumber + ".pdf", 0,
            pdfBytes.length, reportNumber, sha256, rf.periodLabel);
    }

    @Override
    @Transactional(readOnly = true)
    public ReportPreview preview(ReportFilters filters, GenerationContext ctx) {
        Resolved rf = resolve(filters);
        List<ReagentLot> all = filteredLots(rf);
        StringBuilder html = new StringBuilder();
        html.append("<section><h1 style=\"color:#14532d\">Rastreabilidade de Reagentes</h1>");
        html.append("<p>Lotes no recorte: <strong>").append(all.size()).append("</strong></p>");
        html.append("</section>");
        return new ReportPreview(html.toString(),
            all.isEmpty() ? List.of("Nenhum lote encontrado.") : List.of(), rf.periodLabel);
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

            List<ReagentLot> all = filteredLots(rf);
            LocalDate today = LocalDate.now();
            long ativos = all.stream().filter(l -> "ativo".equalsIgnoreCase(l.getStatus())).count();
            long inativos = all.stream().filter(l -> "inativo".equalsIgnoreCase(l.getStatus())).count();
            long vencidosComEstoque = all.stream()
                .filter(l -> l.getExpiryDate() != null && l.getExpiryDate().isBefore(today)
                    && l.getCurrentStock() != null && l.getCurrentStock() > 0)
                .count();

            doc.add(ReportV2PdfTheme.section("Resumo"));
            PdfPTable cards = new PdfPTable(new float[] {1, 1, 1, 1});
            cards.setWidthPercentage(100F); cards.setSpacingAfter(6F);
            cards.addCell(summaryCell("Total", String.valueOf(all.size()), ReportV2PdfTheme.BRAND_PRIMARY));
            cards.addCell(summaryCell("Ativos", String.valueOf(ativos), ReportV2PdfTheme.STATUS_APROVADO));
            cards.addCell(summaryCell("Vencidos c/ estoque", String.valueOf(vencidosComEstoque), ReportV2PdfTheme.STATUS_REPROVADO));
            cards.addCell(summaryCell("Inativos", String.valueOf(inativos), ReportV2PdfTheme.MUTED));
            doc.add(cards);

            // Vencimentos proximos
            int horizon = rf.expiryHorizonDays > 0 ? rf.expiryHorizonDays : 90;
            List<ReagentLot> expiring = all.stream()
                .filter(l -> l.getExpiryDate() != null
                    && !l.getExpiryDate().isBefore(today)
                    && !l.getExpiryDate().isAfter(today.plusDays(horizon)))
                .sorted(Comparator.comparing(ReagentLot::getExpiryDate))
                .collect(Collectors.toList());
            if (!expiring.isEmpty()) {
                doc.add(ReportV2PdfTheme.section("Vencimentos proximos (" + horizon + " dias)"));
                PdfPTable t = ReportV2PdfTheme.table(new float[] {2.4F, 1.6F, 2.0F, 1.4F, 1.2F, 1.3F});
                ReportV2PdfTheme.headerRow(t, "Nome", "Lote", "Categoria", "Vence", "Estoque", "Status");
                boolean alt = false;
                for (ReagentLot l : expiring) {
                    ReportV2PdfTheme.bodyRow(t, alt,
                        ReportV2PdfTheme.safe(l.getName()),
                        ReportV2PdfTheme.safe(l.getLotNumber()),
                        ReportV2PdfTheme.safe(l.getCategory()),
                        ReportV2PdfTheme.formatDate(l.getExpiryDate()),
                        ReportV2PdfTheme.formatDecimal(l.getCurrentStock()),
                        ReportV2PdfTheme.safe(l.getStatus())
                    );
                    alt = !alt;
                }
                doc.add(t);
            }

            // Vencidos com estoque (caixa vermelha)
            if (vencidosComEstoque > 0) {
                doc.add(ReportV2PdfTheme.section("ATENCAO: Vencidos com estoque remanescente"));
                PdfPTable wrap = new PdfPTable(1);
                wrap.setWidthPercentage(100F);
                wrap.addCell(ReportV2PdfTheme.calloutBox(
                    vencidosComEstoque + " lote(s) vencido(s) com estoque - risco regulatorio. "
                    + "Separar e descartar conforme POP de residuos.",
                    ReportV2PdfTheme.ALERT_BG, ReportV2PdfTheme.STATUS_REPROVADO));
                doc.add(wrap);
                PdfPTable t = ReportV2PdfTheme.table(new float[] {2.4F, 1.6F, 1.4F, 1.2F});
                ReportV2PdfTheme.headerRow(t, "Nome", "Lote", "Venceu em", "Estoque");
                boolean alt = false;
                for (ReagentLot l : all) {
                    if (l.getExpiryDate() == null || !l.getExpiryDate().isBefore(today)) continue;
                    if (l.getCurrentStock() == null || l.getCurrentStock() <= 0) continue;
                    ReportV2PdfTheme.bodyRow(t, alt,
                        ReportV2PdfTheme.safe(l.getName()),
                        ReportV2PdfTheme.safe(l.getLotNumber()),
                        ReportV2PdfTheme.formatDate(l.getExpiryDate()),
                        ReportV2PdfTheme.formatDecimal(l.getCurrentStock())
                    );
                    alt = !alt;
                }
                doc.add(t);
            }

            // Consumo por categoria (barChart)
            Map<String, Number> catDs = new LinkedHashMap<>();
            all.stream()
                .collect(Collectors.groupingBy(
                    l -> l.getCategory() == null || l.getCategory().isBlank() ? "Sem categoria" : l.getCategory(),
                    Collectors.summingDouble(l -> l.getEstimatedConsumption() == null ? 0 : l.getEstimatedConsumption())
                )).forEach(catDs::put);
            if (!catDs.isEmpty()) {
                doc.add(ReportV2PdfTheme.section("Consumo estimado por categoria"));
                try {
                    byte[] png = chartRenderer.renderBarChart(catDs, "Consumo por categoria", "Categoria", "Consumo");
                    Image img = Image.getInstance(png);
                    img.scaleToFit(500F, 220F);
                    img.setAlignment(Element.ALIGN_CENTER);
                    doc.add(img);
                } catch (Exception ex) {
                    LOG.warn("Falha ao renderizar barChart reagentes", ex);
                }
            }

            // Comentario IA
            if (rf.includeAiCommentary) {
                doc.add(ReportV2PdfTheme.section("Analise executiva"));
                String structured = "Total lotes: " + all.size() + "\nAtivos: " + ativos
                    + "\nVencidos com estoque: " + vencidosComEstoque + "\nInativos: " + inativos;
                String commentary = aiCommentator.commentary(ReportCode.REAGENTES_RASTREABILIDADE, structured, ctx);
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
            throw new IllegalStateException("Falha ao gerar PDF reagentes", ex);
        }
    }

    private List<ReagentLot> filteredLots(Resolved rf) {
        List<ReagentLot> all = lotRepository.findAll();
        return all.stream()
            .filter(l -> rf.categories == null || rf.categories.isEmpty()
                || (l.getCategory() != null && rf.categories.contains(l.getCategory())))
            .filter(l -> rf.includeInactive || !"inativo".equalsIgnoreCase(l.getStatus()))
            .collect(Collectors.toList());
    }

    private Resolved resolve(ReportFilters filters) {
        Resolved r = new Resolved();
        r.categories = filters.getStringList("categories").orElse(null);
        r.includeInactive = filters.getBoolean("includeInactive").orElse(false);
        r.expiryHorizonDays = filters.getInteger("expiryHorizonDays").orElse(90);
        r.includeAiCommentary = filters.getBoolean("includeAiCommentary").orElse(false);
        r.periodLabel = "Recorte atual";
        return r;
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

    static final class Resolved {
        List<String> categories;
        boolean includeInactive;
        int expiryHorizonDays;
        boolean includeAiCommentary;
        String periodLabel;
    }
}

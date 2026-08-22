package com.biodiagnostico.service;

import com.biodiagnostico.dto.request.TemperatureLocationRequest;
import com.biodiagnostico.dto.request.TemperatureRecordRequest;
import com.biodiagnostico.dto.response.TemperatureOcrResponse;
import com.biodiagnostico.dto.response.TemperatureSummaryResponse;
import com.biodiagnostico.entity.TemperatureLocation;
import com.biodiagnostico.entity.TemperatureRecord;
import com.biodiagnostico.entity.User;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.exception.ResourceNotFoundException;
import com.biodiagnostico.repository.TemperatureLocationRepository;
import com.biodiagnostico.repository.TemperatureRecordRepository;
import com.biodiagnostico.repository.UserRepository;
import com.biodiagnostico.service.ai.AiModelRouter;
import com.biodiagnostico.service.ai.AiProvider;
import com.biodiagnostico.service.ai.AiTask;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
public class TemperatureService {

    private final TemperatureLocationRepository locationRepository;
    private final TemperatureRecordRepository recordRepository;
    private final UserRepository userRepository;
    private final AiProvider aiProvider;
    private final AiModelRouter modelRouter;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    public TemperatureService(
        TemperatureLocationRepository locationRepository,
        TemperatureRecordRepository recordRepository,
        UserRepository userRepository,
        AiProvider aiProvider,
        AiModelRouter modelRouter,
        ObjectMapper objectMapper
    ) {
        this.locationRepository = locationRepository;
        this.recordRepository = recordRepository;
        this.userRepository = userRepository;
        this.aiProvider = aiProvider;
        this.modelRouter = modelRouter;
        this.objectMapper = objectMapper;
    }

    // ========================================================================
    // 1. GESTÃO DE PONTOS DE MONITORAMENTO (LOCATIONS)
    // ========================================================================

    @Transactional(readOnly = true)
    public List<TemperatureLocation> getLocations(String area, Boolean active) {
        boolean hasArea = area != null && !area.trim().isEmpty();
        if (hasArea && active != null) {
            return locationRepository.findByAreaIgnoreCaseAndActiveOrderByNameAsc(area.trim(), active);
        } else if (hasArea) {
            return locationRepository.findByAreaIgnoreCaseOrderByNameAsc(area.trim());
        } else if (active != null) {
            return locationRepository.findByActiveOrderByNameAsc(active);
        } else {
            return locationRepository.findAllByOrderByNameAsc();
        }
    }

    @Transactional(readOnly = true)
    public TemperatureLocation getLocationById(UUID id) {
        return locationRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Ponto de monitoramento não encontrado com id: " + id));
    }

    @Transactional
    public TemperatureLocation createLocation(TemperatureLocationRequest request) {
        if (locationRepository.findByCode(request.code()).isPresent()) {
            throw new BusinessException("Já existe um ponto de monitoramento com o código: " + request.code());
        }
        if (request.minTempTarget().compareTo(request.maxTempTarget()) > 0) {
            throw new BusinessException("A temperatura mínima alvo não pode ser maior que a máxima.");
        }

        TemperatureLocation location = TemperatureLocation.builder()
            .name(request.name().trim())
            .code(request.code().trim().toUpperCase())
            .category(request.category().trim().toUpperCase())
            .area(request.area() != null ? request.area().trim().toUpperCase() : "GERAL")
            .minTempTarget(request.minTempTarget())
            .maxTempTarget(request.maxTempTarget())
            .minHumidityTarget(request.minHumidityTarget())
            .maxHumidityTarget(request.maxHumidityTarget())
            .thermometerCode(request.thermometerCode())
            .calibrationCertNumber(request.calibrationCertNumber())
            .calibrationDueDate(request.calibrationDueDate())
            .frequency(request.frequency() != null ? request.frequency() : "DIARIO_1X")
            .active(request.active() != null ? request.active() : true)
            .notes(request.notes())
            .build();

        return locationRepository.save(location);
    }

    @Transactional
    public TemperatureLocation updateLocation(UUID id, TemperatureLocationRequest request) {
        TemperatureLocation location = getLocationById(id);

        Optional<TemperatureLocation> existingCode = locationRepository.findByCode(request.code());
        if (existingCode.isPresent() && !existingCode.get().getId().equals(id)) {
            throw new BusinessException("Já existe outro ponto com o código: " + request.code());
        }
        if (request.minTempTarget().compareTo(request.maxTempTarget()) > 0) {
            throw new BusinessException("A temperatura mínima alvo não pode ser maior que a máxima.");
        }

        location.setName(request.name().trim());
        location.setCode(request.code().trim().toUpperCase());
        location.setCategory(request.category().trim().toUpperCase());
        location.setArea(request.area() != null ? request.area().trim().toUpperCase() : "GERAL");
        location.setMinTempTarget(request.minTempTarget());
        location.setMaxTempTarget(request.maxTempTarget());
        location.setMinHumidityTarget(request.minHumidityTarget());
        location.setMaxHumidityTarget(request.maxHumidityTarget());
        location.setThermometerCode(request.thermometerCode());
        location.setCalibrationCertNumber(request.calibrationCertNumber());
        location.setCalibrationDueDate(request.calibrationDueDate());
        if (request.frequency() != null) {
            location.setFrequency(request.frequency());
        }
        if (request.active() != null) {
            location.setActive(request.active());
        }
        location.setNotes(request.notes());

        return locationRepository.save(location);
    }

    @Transactional
    public void deleteLocation(UUID id) {
        TemperatureLocation location = getLocationById(id);
        locationRepository.delete(location);
    }

    // ========================================================================
    // 2. GESTÃO DE REGISTROS DE TEMPERATURA (RECORDS)
    // ========================================================================

    @Transactional(readOnly = true)
    public List<TemperatureRecord> getRecords(
        UUID locationId,
        Integer month,
        Integer year,
        LocalDate startDate,
        LocalDate endDate,
        String status
    ) {
        LocalDate start;
        LocalDate end;

        if (startDate != null && endDate != null) {
            start = startDate;
            end = endDate;
        } else if (month != null && year != null) {
            YearMonth ym = YearMonth.of(year, month);
            start = ym.atDay(1);
            end = ym.atEndOfMonth();
        } else {
            YearMonth ym = YearMonth.now();
            start = ym.atDay(1);
            end = ym.atEndOfMonth();
        }

        boolean hasLoc = locationId != null;
        boolean hasStatus = status != null && !status.trim().isEmpty();

        if (hasLoc && hasStatus) {
            return recordRepository.findByLocationAndStatusAndPeriod(start, end, locationId, status.trim().toUpperCase());
        } else if (hasLoc) {
            return recordRepository.findByLocationAndPeriod(start, end, locationId);
        } else if (hasStatus) {
            return recordRepository.findByStatusAndPeriod(start, end, status.trim().toUpperCase());
        } else {
            return recordRepository.findInPeriod(start, end);
        }
    }

    @Transactional(readOnly = true)
    public TemperatureRecord getRecordById(UUID id) {
        return recordRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Registro de temperatura não encontrado com id: " + id));
    }

    @Transactional
    public TemperatureRecord createRecord(TemperatureRecordRequest request, String authenticatedUsername) {
        TemperatureLocation location = getLocationById(request.locationId());

        String status = evaluateStatus(location, request.tempMin(), request.tempMax(), request.humidity());

        User responsibleUser = null;
        if (authenticatedUsername != null && !authenticatedUsername.isBlank()) {
            responsibleUser = userRepository.findByUsername(authenticatedUsername).orElse(null);
        }

        TemperatureRecord record = TemperatureRecord.builder()
            .location(location)
            .date(request.date())
            .time(request.time())
            .period(request.period() != null ? request.period() : "UNICO")
            .tempCurrent(request.tempCurrent())
            .tempMax(request.tempMax())
            .tempMin(request.tempMin())
            .humidity(request.humidity())
            .status(status)
            .responsible(request.responsible().trim())
            .responsibleUser(responsibleUser)
            .actionTaken(request.actionTaken())
            .notes(request.notes())
            .photoUrl(request.photoUrl())
            .photoFilename(request.photoFilename())
            .ocrRawResult(request.ocrRawResult())
            .ocrApplied(request.ocrApplied() != null ? request.ocrApplied() : false)
            .build();

        return recordRepository.save(record);
    }

    @Transactional
    public TemperatureRecord updateRecord(UUID id, TemperatureRecordRequest request, String authenticatedUsername) {
        TemperatureRecord record = getRecordById(id);
        TemperatureLocation location = getLocationById(request.locationId());

        String status = evaluateStatus(location, request.tempMin(), request.tempMax(), request.humidity());

        record.setLocation(location);
        record.setDate(request.date());
        record.setTime(request.time());
        if (request.period() != null) {
            record.setPeriod(request.period());
        }
        record.setTempCurrent(request.tempCurrent());
        record.setTempMax(request.tempMax());
        record.setTempMin(request.tempMin());
        record.setHumidity(request.humidity());
        record.setStatus(status);
        record.setResponsible(request.responsible().trim());
        record.setActionTaken(request.actionTaken());
        record.setNotes(request.notes());
        if (request.photoUrl() != null) {
            record.setPhotoUrl(request.photoUrl());
        }
        if (request.photoFilename() != null) {
            record.setPhotoFilename(request.photoFilename());
        }
        if (request.ocrRawResult() != null) {
            record.setOcrRawResult(request.ocrRawResult());
        }
        if (request.ocrApplied() != null) {
            record.setOcrApplied(request.ocrApplied());
        }

        return recordRepository.save(record);
    }

    @Transactional
    public void deleteRecord(UUID id) {
        TemperatureRecord record = getRecordById(id);
        recordRepository.delete(record);
    }

    /**
     * Avalia deterministica e rigorosamente a conformidade de temperatura e umidade.
     */
    public String evaluateStatus(
        TemperatureLocation location,
        BigDecimal tempMin,
        BigDecimal tempMax,
        BigDecimal humidity
    ) {
        if (tempMin == null || tempMax == null) {
            return "NAO_CONFORME";
        }

        // Checa faixa de temperatura
        boolean tempOk = tempMin.compareTo(location.getMinTempTarget()) >= 0
            && tempMax.compareTo(location.getMaxTempTarget()) <= 0;

        if (!tempOk) {
            return "NAO_CONFORME";
        }

        // Checa faixa de umidade, se o ponto tiver limite de umidade configurado
        if (humidity != null) {
            if (location.getMinHumidityTarget() != null && humidity.compareTo(location.getMinHumidityTarget()) < 0) {
                return "NAO_CONFORME";
            }
            if (location.getMaxHumidityTarget() != null && humidity.compareTo(location.getMaxHumidityTarget()) > 0) {
                return "NAO_CONFORME";
            }
        }

        return "CONFORME";
    }

    // ========================================================================
    // 3. DASHBOARD / SUMMARY
    // ========================================================================

    @Transactional(readOnly = true)
    public TemperatureSummaryResponse getSummary() {
        LocalDate today = LocalDate.now();
        YearMonth currentMonth = YearMonth.now();
        LocalDate startMonth = currentMonth.atDay(1);
        LocalDate endMonth = currentMonth.atEndOfMonth();

        List<TemperatureLocation> activeLocations = locationRepository.findByActiveTrueOrderByNameAsc();
        long totalLocations = locationRepository.count();
        long activeCount = activeLocations.size();

        List<TemperatureRecord> recordsToday = recordRepository.findByDateWithLocation(today);
        long recordedToday = recordsToday.size();

        // Contabiliza pontos ativos sem registro hoje
        long recordedLocationIdsToday = recordsToday.stream()
            .map(r -> r.getLocation().getId())
            .distinct()
            .count();
        long pendingToday = Math.max(0, activeCount - recordedLocationIdsToday);

        long nonCompliantToday = recordsToday.stream()
            .filter(r -> "NAO_CONFORME".equalsIgnoreCase(r.getStatus()))
            .count();

        long nonCompliantMonth = recordRepository.countNonCompliantBetween(startMonth, endMonth);

        // Calibrações a vencer em até 30 dias
        LocalDate in30Days = today.plusDays(30);
        long expiringCalibrations = locationRepository.findExpiringCalibrations(in30Days).size();

        return new TemperatureSummaryResponse(
            totalLocations,
            activeCount,
            recordedToday,
            pendingToday,
            nonCompliantToday,
            nonCompliantMonth,
            expiringCalibrations
        );
    }

    // ========================================================================
    // 4. OCR / VISÃO COMPUTACIONAL DO VISOR DO TERMÔMETRO
    // ========================================================================

    public TemperatureOcrResponse processThermometerPhoto(String imageBase64, String mimeType, UUID locationId) {
        if (imageBase64 == null || imageBase64.isBlank()) {
            throw new BusinessException("Imagem base64 não fornecida.");
        }

        String cleanBase64 = imageBase64.contains(",") ? imageBase64.substring(imageBase64.indexOf(",") + 1) : imageBase64;
        String effectiveMime = (mimeType != null && !mimeType.isBlank()) ? mimeType : "image/jpeg";

        String prompt = """
            Você é um leitor de visão computacional de alta precisão para termômetros digitais laboratoriais de máxima e mínima (ex: Incoterm, Jprolab SH-102, TFA).
            Analise a imagem e extraia os dados do visor LCD.
            Responda ESTRITAMENTE em JSON com a estrutura:
            {
              "time": "HH:mm ou null",
              "tempMax": float ou null,
              "tempMin": float ou null,
              "tempCurrent": float ou null,
              "humidity": float ou null,
              "confidence": float entre 0.0 e 1.0,
              "statusMessage": "descrição curta",
              "rawText": "texto lido"
            }
            Regras obrigatórias:
            1. 'tempMax' é o valor ao lado ou acima de MAX (ou MAX OUT). Ex: 1.9.
            2. 'tempMin' é o valor ao lado ou acima de MIN (ou MIN OUT). Ex: 1.9.
            3. 'time' é a hora mostrada no visor (ex: '15:05'). Se não houver, null.
            4. Ignore etiquetas adesivas de calibração ou patrimônio para a data de medição.
            5. Suporte números negativos (ex: -18.5). Converta vírgulas em pontos.
            """;

        try {
            String model = modelRouter.modelFor(AiTask.TEMPERATURE_OCR);
            String aiResult = aiProvider.completeVision(model, prompt, cleanBase64, effectiveMime);

            JsonNode root = objectMapper.readTree(aiResult);

            String time = root.path("time").isTextual() ? root.path("time").asText() : null;
            BigDecimal tempMax = root.path("tempMax").isNumber() ? BigDecimal.valueOf(root.path("tempMax").asDouble()) : null;
            BigDecimal tempMin = root.path("tempMin").isNumber() ? BigDecimal.valueOf(root.path("tempMin").asDouble()) : null;
            BigDecimal tempCurrent = root.path("tempCurrent").isNumber() ? BigDecimal.valueOf(root.path("tempCurrent").asDouble()) : null;
            BigDecimal humidity = root.path("humidity").isNumber() ? BigDecimal.valueOf(root.path("humidity").asDouble()) : null;
            Double confidence = root.path("confidence").isNumber() ? root.path("confidence").asDouble() : 0.90;
            String statusMsg = root.path("statusMessage").asText("Leitura processada com sucesso");
            String rawText = root.path("rawText").asText("");

            return new TemperatureOcrResponse(
                time,
                tempMax,
                tempMin,
                tempCurrent,
                humidity,
                LocalDate.now(),
                confidence,
                statusMsg,
                rawText
            );
        } catch (Exception e) {
            log.warn("Falha no OCR de visão por IA, aplicando fallback heurístico: {}", e.getMessage());
            return new TemperatureOcrResponse(
                LocalTime.now().format(TIME_FMT),
                null,
                null,
                null,
                null,
                LocalDate.now(),
                0.0,
                "Não foi possível ler os dígitos automaticamente. Preencha manualmente os campos.",
                ""
            );
        }
    }

    // ========================================================================
    // 5. EXPORTAÇÃO EXCEL (.XLSX / CSV FORMATADO)
    // ========================================================================

    @Transactional(readOnly = true)
    public byte[] exportToExcel(UUID locationId, int month, int year) {
        YearMonth ym = YearMonth.of(year, month);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        TemperatureLocation location = locationId != null ? getLocationById(locationId) : null;
        List<TemperatureRecord> records = locationId != null
            ? recordRepository.findByLocationAndPeriod(start, end, locationId)
            : recordRepository.findInPeriod(start, end);

        StringBuilder csv = new StringBuilder();
        // BOM UTF-8 para Excel abrir acentuação perfeitamente
        csv.append('\ufeff');

        csv.append("RELATÓRIO DE CONTROLE DIÁRIO DE TEMPERATURA E TERMOHIGROMETRIA\n");
        csv.append("Laboratório Biodiagnóstico\n");
        csv.append("Mês de Referência:;").append(ym.format(DateTimeFormatter.ofPattern("MM/yyyy"))).append("\n");
        if (location != null) {
            csv.append("Equipamento / Ambiente:;").append(location.getName()).append(" (").append(location.getCode()).append(")\n");
            csv.append("Faixa Aceitável (°C):;").append(location.getMinTempTarget()).append(" a ").append(location.getMaxTempTarget()).append(" °C\n");
            if (location.getMinHumidityTarget() != null && location.getMaxHumidityTarget() != null) {
                csv.append("Faixa Aceitável Umidade (%):;").append(location.getMinHumidityTarget()).append(" a ").append(location.getMaxHumidityTarget()).append(" %\n");
            }
            if (location.getThermometerCode() != null) {
                csv.append("Termômetro / Certificado:;").append(location.getThermometerCode());
                if (location.getCalibrationCertNumber() != null) {
                    csv.append(" | Cert: ").append(location.getCalibrationCertNumber());
                }
                csv.append("\n");
            }
        }
        csv.append("\n");

        csv.append("Data;Hora;Equipamento;Temp. Máx. (°C);Temp. Mín. (°C);Temp. Momento (°C);Umidade (%);Status;Responsável;Ação Corretiva;Observações\n");

        for (TemperatureRecord r : records) {
            csv.append(r.getDate().format(DATE_FMT)).append(";");
            csv.append(r.getTime().format(TIME_FMT)).append(";");
            csv.append(r.getLocation() != null ? r.getLocation().getName() : "").append(";");
            csv.append(r.getTempMax() != null ? r.getTempMax().toString().replace('.', ',') : "").append(";");
            csv.append(r.getTempMin() != null ? r.getTempMin().toString().replace('.', ',') : "").append(";");
            csv.append(r.getTempCurrent() != null ? r.getTempCurrent().toString().replace('.', ',') : "").append(";");
            csv.append(r.getHumidity() != null ? r.getHumidity().toString().replace('.', ',') : "").append(";");
            csv.append(r.getStatus()).append(";");
            csv.append(r.getResponsible()).append(";");
            csv.append(r.getActionTaken() != null ? r.getActionTaken().replace(';', ',').replace('\n', ' ') : "").append(";");
            csv.append(r.getNotes() != null ? r.getNotes().replace(';', ',').replace('\n', ' ') : "").append("\n");
        }

        return csv.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    // ========================================================================
    // 6. RELATÓRIO PDF OFICIAL (FOLHA MENSAL ANVISA / PNCQ)
    // ========================================================================

    @Transactional(readOnly = true)
    public byte[] generateMonthlyPdfReport(UUID locationId, int month, int year) {
        YearMonth ym = YearMonth.of(year, month);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        TemperatureLocation location = locationId != null ? getLocationById(locationId) : null;
        List<TemperatureRecord> records = locationId != null
            ? recordRepository.findByLocationAndPeriod(start, end, locationId)
            : recordRepository.findInPeriod(start, end);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4.rotate(), 20, 20, 20, 20);

        try {
            PdfWriter.getInstance(doc, out);
            doc.open();

            Font titleFont = new Font(Font.HELVETICA, 14, Font.BOLD, new Color(20, 83, 45));
            Font subTitleFont = new Font(Font.HELVETICA, 10, Font.NORMAL, Color.DARK_GRAY);
            Font headerFont = new Font(Font.HELVETICA, 8, Font.BOLD, Color.WHITE);
            Font cellFont = new Font(Font.HELVETICA, 8, Font.NORMAL, Color.BLACK);
            Font cellAlertFont = new Font(Font.HELVETICA, 8, Font.BOLD, new Color(185, 28, 28));

            Paragraph header = new Paragraph("BIODIAGNÓSTICO — CONTROLE DE TEMPERATURA E TERMOHIGROMETRIA", titleFont);
            header.setAlignment(Element.ALIGN_CENTER);
            doc.add(header);

            String locInfo = location != null
                ? String.format("Equipamento: %s (%s) | Faixa Aceitável: %.1f°C a %.1f°C | Mês: %s",
                    location.getName(), location.getCode(), location.getMinTempTarget(), location.getMaxTempTarget(), ym.format(DateTimeFormatter.ofPattern("MM/yyyy")))
                : String.format("Todos os Equipamentos | Mês: %s", ym.format(DateTimeFormatter.ofPattern("MM/yyyy")));

            Paragraph sub = new Paragraph(locInfo, subTitleFont);
            sub.setAlignment(Element.ALIGN_CENTER);
            sub.setSpacingAfter(12);
            doc.add(sub);

            PdfPTable table = new PdfPTable(9);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{10, 8, 22, 10, 10, 10, 12, 18, 20});

            String[] headers = {"Data", "Hora", "Equipamento", "Máx (°C)", "Mín (°C)", "Atual (°C)", "Status", "Responsável", "Ação Corretiva"};
            for (String h : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(h, headerFont));
                cell.setBackgroundColor(new Color(22, 101, 52));
                cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                cell.setPadding(4);
                table.addCell(cell);
            }

            for (TemperatureRecord r : records) {
                boolean isAlert = "NAO_CONFORME".equalsIgnoreCase(r.getStatus());
                Font f = isAlert ? cellAlertFont : cellFont;

                PdfPCell cData = new PdfPCell(new Phrase(r.getDate().format(DATE_FMT), f));
                cData.setHorizontalAlignment(Element.ALIGN_CENTER);
                table.addCell(cData);

                PdfPCell cHora = new PdfPCell(new Phrase(r.getTime().format(TIME_FMT), f));
                cHora.setHorizontalAlignment(Element.ALIGN_CENTER);
                table.addCell(cHora);

                table.addCell(new PdfPCell(new Phrase(r.getLocation() != null ? r.getLocation().getName() : "-", f)));

                PdfPCell cMax = new PdfPCell(new Phrase(r.getTempMax() != null ? String.format("%.1f", r.getTempMax()) : "-", f));
                cMax.setHorizontalAlignment(Element.ALIGN_RIGHT);
                table.addCell(cMax);

                PdfPCell cMin = new PdfPCell(new Phrase(r.getTempMin() != null ? String.format("%.1f", r.getTempMin()) : "-", f));
                cMin.setHorizontalAlignment(Element.ALIGN_RIGHT);
                table.addCell(cMin);

                PdfPCell cCur = new PdfPCell(new Phrase(r.getTempCurrent() != null ? String.format("%.1f", r.getTempCurrent()) : "-", f));
                cCur.setHorizontalAlignment(Element.ALIGN_RIGHT);
                table.addCell(cCur);

                PdfPCell cStatus = new PdfPCell(new Phrase(r.getStatus(), f));
                cStatus.setHorizontalAlignment(Element.ALIGN_CENTER);
                if (isAlert) {
                    cStatus.setBackgroundColor(new Color(254, 226, 226));
                }
                table.addCell(cStatus);

                table.addCell(new PdfPCell(new Phrase(r.getResponsible(), f)));
                table.addCell(new PdfPCell(new Phrase(r.getActionTaken() != null ? r.getActionTaken() : "-", f)));
            }

            doc.add(table);

            Paragraph footer = new Paragraph(
                "\nDocumento emitido eletronicamente conforme ANVISA RDC 786/2023. Rastreabilidade e integridade asseguradas pelo Sistema Biodiagnóstico.",
                new Font(Font.HELVETICA, 7, Font.ITALIC, Color.GRAY)
            );
            footer.setAlignment(Element.ALIGN_CENTER);
            doc.add(footer);

            doc.close();
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Erro ao gerar PDF de temperatura: {}", e.getMessage(), e);
            throw new BusinessException("Falha ao gerar relatório PDF de temperatura: " + e.getMessage());
        }
    }
}

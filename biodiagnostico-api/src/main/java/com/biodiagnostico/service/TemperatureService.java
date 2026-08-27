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
import java.util.ArrayList;
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

        BigDecimal tempCurrent = request.tempCurrent();
        if (tempCurrent == null && request.tempMaxIn() != null && request.tempMinIn() != null) {
            tempCurrent = request.tempMaxIn().add(request.tempMinIn()).divide(BigDecimal.valueOf(2), 1, RoundingMode.HALF_UP);
        }

        TemperatureRecord record = TemperatureRecord.builder()
            .location(location)
            .date(request.date())
            .time(request.time())
            .period(request.period() != null ? request.period() : "UNICO")
            .tempCurrent(tempCurrent)
            .tempMax(request.tempMax())
            .tempMin(request.tempMin())
            .tempMaxIn(request.tempMaxIn())
            .tempMinIn(request.tempMinIn())
            .humidity(request.humidity())
            .status(status)
            .responsible(request.responsible().trim())
            .responsibleUser(responsibleUser)
            .actionTaken(request.actionTaken())
            .notes(request.notes())
            .photoUrl(request.photoUrl())
            .photoFilename(request.photoFilename())
            .photoMinUrl(request.photoMinUrl())
            .photoMinFilename(request.photoMinFilename())
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

        BigDecimal tempCurrent = request.tempCurrent();
        if (tempCurrent == null && request.tempMaxIn() != null && request.tempMinIn() != null) {
            tempCurrent = request.tempMaxIn().add(request.tempMinIn()).divide(BigDecimal.valueOf(2), 1, RoundingMode.HALF_UP);
        }

        record.setLocation(location);
        record.setDate(request.date());
        record.setTime(request.time());
        if (request.period() != null) {
            record.setPeriod(request.period());
        }
        record.setTempCurrent(tempCurrent);
        record.setTempMax(request.tempMax());
        record.setTempMin(request.tempMin());
        record.setTempMaxIn(request.tempMaxIn());
        record.setTempMinIn(request.tempMinIn());
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
        if (request.photoMinUrl() != null) {
            record.setPhotoMinUrl(request.photoMinUrl());
        }
        if (request.photoMinFilename() != null) {
            record.setPhotoMinFilename(request.photoMinFilename());
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

    private static final Pattern TIME_REGEX = Pattern.compile("(?i)\\b(\\d{1,2})[:hH.](\\d{2})(?:[:.]\\d{2})?\\s*(AM|PM)?\\b");

    public static String normalizeOcrTime(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        Matcher matcher = TIME_REGEX.matcher(raw.trim());
        if (matcher.find()) {
            try {
                int hour = Integer.parseInt(matcher.group(1));
                int minute = Integer.parseInt(matcher.group(2));
                String ampm = matcher.group(3);

                if (ampm != null) {
                    if ("PM".equalsIgnoreCase(ampm) && hour < 12) {
                        hour += 12;
                    } else if ("AM".equalsIgnoreCase(ampm) && hour == 12) {
                        hour = 0;
                    }
                }

                if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
                    return String.format("%02d:%02d", hour, minute);
                }
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private String extractTimeFromExif(String base64Image) {
        if (base64Image == null || base64Image.isBlank()) return null;
        try {
            String clean = base64Image.contains(",") ? base64Image.substring(base64Image.indexOf(",") + 1) : base64Image;
            byte[] bytes = java.util.Base64.getDecoder().decode(clean);
            int limit = Math.min(bytes.length, 8192);
            String headerAscii = new String(bytes, 0, limit, java.nio.charset.StandardCharsets.ISO_8859_1);
            Matcher m = Pattern.compile("\\b\\d{4}:\\d{2}:\\d{2} (\\d{2}):(\\d{2}):\\d{2}\\b").matcher(headerAscii);
            if (m.find()) {
                int hour = Integer.parseInt(m.group(1));
                int minute = Integer.parseInt(m.group(2));
                if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
                    return String.format("%02d:%02d", hour, minute);
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    public TemperatureOcrResponse processThermometerPhoto(String imageBase64, String mimeType, UUID locationId) {
        return processThermometerPhoto(imageBase64, mimeType, null, null, locationId);
    }

    public TemperatureOcrResponse processThermometerPhoto(
        String imageBase64,
        String mimeType,
        String imageMinBase64,
        String mimeTypeMin,
        UUID locationId
    ) {
        List<AiProvider.VisionImage> images = new ArrayList<>();

        if (imageBase64 != null && !imageBase64.isBlank()) {
            String clean = imageBase64.contains(",") ? imageBase64.substring(imageBase64.indexOf(",") + 1) : imageBase64;
            String mime = (mimeType != null && !mimeType.isBlank()) ? mimeType : "image/jpeg";
            images.add(new AiProvider.VisionImage(clean, mime));
        }

        if (imageMinBase64 != null && !imageMinBase64.isBlank()) {
            String cleanMin = imageMinBase64.contains(",") ? imageMinBase64.substring(imageMinBase64.indexOf(",") + 1) : imageMinBase64;
            String mimeMin = (mimeTypeMin != null && !mimeTypeMin.isBlank()) ? mimeTypeMin : "image/jpeg";
            images.add(new AiProvider.VisionImage(cleanMin, mimeMin));
        }

        if (images.isEmpty()) {
            throw new BusinessException("Nenhuma imagem fornecida para leitura.");
        }

        // Busca contexto do equipamento se locationId fornecido
        TemperatureLocation loc = null;
        if (locationId != null) {
            loc = locationRepository.findById(locationId).orElse(null);
        }

        String prompt = String.format("""
            Você é um leitor de visão computacional de alta precisão especializado em termômetros digitais laboratoriais de máxima e mínima (ex: Metrins 340, Instrusul INS-1342, Incoterm, HTC-1, HTC-2, Testo).
            Você receberá %d foto(s) do visor LCD de termômetro laboratorial.

            ESTRUTURA DO DISPLAY LCD DO TERMÔMETRO:
            1. LINHA SUPERIOR (indicador 'IN' no canto superior direito): sensor interno / ar ambiente da sala (~18°C a 25°C).
               - Na Foto 1 (em modo MAX): extraia o valor desta linha como 'tempMaxIn' (Máxima IN).
               - Na Foto 2 (em modo MIN): extraia o valor desta linha como 'tempMinIn' (Mínima IN).
            2. LINHA DO MEIO / CENTRAL (indicador 'OUT' no canto direito): sensor externo / sonda do equipamento.
               - Na Foto 1 (em modo MAX): extraia o valor desta linha como 'tempMax' (Máxima OUT).
               - Na Foto 2 (em modo MIN): extraia o valor desta linha como 'tempMin' (Mínima OUT).
            3. LINHA INFERIOR: relógio digital 'HH:mm' à esquerda e umidade relativa '%% RH' à direita.

            REGRAS DE EXTRAÇÃO:
            - 'tempMax': É OBRIGATORIAMENTE o valor da LINHA DO MEIO ('OUT') da Foto 1 (modo MAX). Exemplo: 6.1
            - 'tempMin': É OBRIGATORIAMENTE o valor da LINHA DO MEIO ('OUT') da Foto 2 (modo MIN). Exemplo: 0.2
            - 'tempMaxIn': É OBRIGATORIAMENTE o valor da LINHA SUPERIOR ('IN') da Foto 1 (modo MAX). Exemplo: 19.9
            - 'tempMinIn': É OBRIGATORIAMENTE o valor da LINHA SUPERIOR ('IN') da Foto 2 (modo MIN). Exemplo: 19.6
            - 'time': Horário exibido no relógio digital do display (geralmente no canto inferior esquerdo ou linha inferior, ex: '15:37', '08:15', '10:42', '09:05'). Se houver carimbo de data/hora impresso na foto, utilize-o caso o visor não possua relógio legível. Retorne estritamente em formato 24h 'HH:mm' (ex: '08:30', '14:15').
            - 'humidity': percentual de umidade na linha inferior ao lado de '%% RH' (ex: 98, 97, 60).

            Responda ESTRITAMENTE em formato JSON:
            {
              "time": "HH:mm ou null",
              "tempMax": float ou null,
              "tempMin": float ou null,
              "tempMaxIn": float ou null,
              "tempMinIn": float ou null,
              "humidity": float ou null,
              "confidence": float entre 0.0 e 1.0,
              "statusMessage": "descrição (ex: 'OUT: Máx 6.1°C / Mín 0.2°C | IN: Máx 19.9°C / Mín 19.6°C | UR: 98%%')",
              "rawText": "transcrição dos dados lidos"
            }
            """,
            images.size()
        );

        try {
            String model = modelRouter.modelFor(AiTask.TEMPERATURE_OCR);
            String aiResult = aiProvider.completeVisionMulti(model, prompt, images);

            JsonNode root = objectMapper.readTree(aiResult);

            String rawTime = root.path("time").isTextual() ? root.path("time").asText() : null;
            String rawText = root.path("rawText").asText("");

            String time = normalizeOcrTime(rawTime);
            if (time == null) {
                time = normalizeOcrTime(rawText);
            }
            if (time == null) {
                time = extractTimeFromExif(imageBase64);
            }
            if (time == null && imageMinBase64 != null) {
                time = extractTimeFromExif(imageMinBase64);
            }

            BigDecimal tempMax = root.path("tempMax").isNumber() ? BigDecimal.valueOf(root.path("tempMax").asDouble()) : null;
            BigDecimal tempMin = root.path("tempMin").isNumber() ? BigDecimal.valueOf(root.path("tempMin").asDouble()) : null;
            BigDecimal tempMaxIn = root.path("tempMaxIn").isNumber() ? BigDecimal.valueOf(root.path("tempMaxIn").asDouble()) : null;
            BigDecimal tempMinIn = root.path("tempMinIn").isNumber() ? BigDecimal.valueOf(root.path("tempMinIn").asDouble()) : null;
            BigDecimal humidity = root.path("humidity").isNumber() ? BigDecimal.valueOf(root.path("humidity").asDouble()) : null;
            Double confidence = root.path("confidence").isNumber() ? root.path("confidence").asDouble() : 0.95;

            // Calcula Temperatura Ambiente a partir da média aritmética de (Max IN + Min IN) / 2
            BigDecimal tempCurrent = null;
            if (tempMaxIn != null && tempMinIn != null) {
                tempCurrent = tempMaxIn.add(tempMinIn).divide(BigDecimal.valueOf(2), 1, RoundingMode.HALF_UP);
            } else if (root.path("tempCurrent").isNumber()) {
                tempCurrent = BigDecimal.valueOf(root.path("tempCurrent").asDouble()).setScale(1, RoundingMode.HALF_UP);
            }

            String statusMsg = root.path("statusMessage").asText("Leitura processada com sucesso");

            return new TemperatureOcrResponse(
                time,
                tempMax,
                tempMin,
                tempMaxIn,
                tempMinIn,
                tempCurrent,
                humidity,
                LocalDate.now(),
                confidence,
                statusMsg,
                rawText
            );
        } catch (Exception e) {
            log.warn("Falha no OCR de visão por IA, aplicando fallback heurístico: {}", e.getMessage());
            String fallbackTime = extractTimeFromExif(imageBase64);
            if (fallbackTime == null && imageMinBase64 != null) {
                fallbackTime = extractTimeFromExif(imageMinBase64);
            }
            if (fallbackTime == null) {
                fallbackTime = LocalTime.now().format(TIME_FMT);
            }

            return new TemperatureOcrResponse(
                fallbackTime,
                null,
                null,
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
            csv.append("Setor:;").append(location.getArea() != null ? location.getArea() : "Geral").append("\n");
            csv.append("Faixa Aceitável (°C):;").append(location.getMinTempTarget()).append(" a ").append(location.getMaxTempTarget()).append(" °C\n");
            if (location.getMinHumidityTarget() != null && location.getMaxHumidityTarget() != null) {
                csv.append("Faixa Aceitável Umidade (%):;").append(location.getMinHumidityTarget()).append(" a ").append(location.getMaxHumidityTarget()).append(" %\n");
            }
            if (location.getThermometerCode() != null) {
                csv.append("Termômetro / Certificado:;").append(location.getThermometerCode());
                if (location.getCalibrationCertNumber() != null) {
                    csv.append(" | Cert: ").append(location.getCalibrationCertNumber());
                }
                if (location.getCalibrationDueDate() != null) {
                    csv.append(" | Validade: ").append(location.getCalibrationDueDate().format(DATE_FMT));
                }
                csv.append("\n");
            }
        }
        csv.append("\n");

        csv.append("Data;Hora;Equipamento;Máx OUT (°C);Mín OUT (°C);Temp. Ambiente (°C);Umidade (%);Status;Responsável;Ação Corretiva;Observações\n");

        for (TemperatureRecord r : records) {
            BigDecimal current = r.getTempCurrent();
            if (current == null && r.getTempMaxIn() != null && r.getTempMinIn() != null) {
                current = r.getTempMaxIn().add(r.getTempMinIn()).divide(BigDecimal.valueOf(2), 1, RoundingMode.HALF_UP);
            }

            csv.append(r.getDate().format(DATE_FMT)).append(";");
            csv.append(r.getTime().format(TIME_FMT)).append(";");
            csv.append(r.getLocation() != null ? r.getLocation().getName() : "").append(";");
            csv.append(r.getTempMax() != null ? r.getTempMax().toString().replace('.', ',') : "").append(";");
            csv.append(r.getTempMin() != null ? r.getTempMin().toString().replace('.', ',') : "").append(";");
            csv.append(current != null ? current.toString().replace('.', ',') : "").append(";");
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

            // Fontes e Paleta Visual Harmoniosa
            Font mainTitleFont = new Font(Font.HELVETICA, 13, Font.BOLD, new Color(20, 83, 45));
            Font subTitleFont = new Font(Font.HELVETICA, 8, Font.NORMAL, Color.DARK_GRAY);
            Font sectionTitleFont = new Font(Font.HELVETICA, 9, Font.BOLD, new Color(22, 101, 52));
            Font headerCellFont = new Font(Font.HELVETICA, 7.5f, Font.BOLD, Color.WHITE);
            Font cellFont = new Font(Font.HELVETICA, 7.5f, Font.NORMAL, Color.BLACK);
            Font cellBoldFont = new Font(Font.HELVETICA, 7.5f, Font.BOLD, Color.BLACK);
            Font cellAlertFont = new Font(Font.HELVETICA, 7.5f, Font.BOLD, new Color(185, 28, 28));
            Font footerFont = new Font(Font.HELVETICA, 6.5f, Font.ITALIC, Color.GRAY);

            // 1. Cabeçalho Institucional
            Paragraph header = new Paragraph("LABORATÓRIO BIODIAGNÓSTICO — CONTROLE DE TEMPERATURA E TERMOHIGROMETRIA", mainTitleFont);
            header.setAlignment(Element.ALIGN_CENTER);
            doc.add(header);

            Paragraph sub = new Paragraph("Folha de Registro Mensal da Cadeia de Frio e Ambientes Climatizados (ANVISA RDC 978/2025 / RDC 786/2023 / PNCQ)", subTitleFont);
            sub.setAlignment(Element.ALIGN_CENTER);
            sub.setSpacingAfter(8);
            doc.add(sub);

            // 2. Quadro de Metadados do Equipamento e Período
            PdfPTable metaTable = new PdfPTable(4);
            metaTable.setWidthPercentage(100);
            metaTable.setWidths(new float[]{25, 25, 25, 25});
            metaTable.setSpacingAfter(8);

            String equipLabel = location != null ? location.getName() + " (" + location.getCode() + ")" : "Todos os Equipamentos / Ambientes";
            String setorLabel = location != null && location.getArea() != null ? location.getArea() : "Geral";
            String faixaTempLabel = location != null ? String.format("%.1f°C a %.1f°C", location.getMinTempTarget(), location.getMaxTempTarget()) : "Variável";
            String faixaHumLabel = location != null && location.getMinHumidityTarget() != null && location.getMaxHumidityTarget() != null
                ? String.format("%.0f%% a %.0f%% UR", location.getMinHumidityTarget(), location.getMaxHumidityTarget())
                : "Não aplicável";

            String termoLabel = location != null && location.getThermometerCode() != null ? location.getThermometerCode() : "-";
            String certLabel = location != null && location.getCalibrationCertNumber() != null ? location.getCalibrationCertNumber() : "-";
            String valLabel = location != null && location.getCalibrationDueDate() != null ? location.getCalibrationDueDate().format(DATE_FMT) : "-";
            String mesRefLabel = ym.format(DateTimeFormatter.ofPattern("MM/yyyy"));

            addMetaCell(metaTable, "Equipamento / Local:", equipLabel, cellBoldFont, cellFont);
            addMetaCell(metaTable, "Setor / Área:", setorLabel, cellBoldFont, cellFont);
            addMetaCell(metaTable, "Faixa Térmica Aceitável:", faixaTempLabel, cellBoldFont, cellFont);
            addMetaCell(metaTable, "Faixa de Umidade:", faixaHumLabel, cellBoldFont, cellFont);

            addMetaCell(metaTable, "Termômetro Vinculado:", termoLabel, cellBoldFont, cellFont);
            addMetaCell(metaTable, "Certificado Calibração:", certLabel, cellBoldFont, cellFont);
            addMetaCell(metaTable, "Validade Calibração:", valLabel, cellBoldFont, cellFont);
            addMetaCell(metaTable, "Mês de Referência:", mesRefLabel, cellBoldFont, cellFont);

            doc.add(metaTable);

            // 3. Indicadores e Estatísticas de Conformidade (KPI Box)
            int totalRecords = records.size();
            long conformeCount = records.stream().filter(r -> "CONFORME".equalsIgnoreCase(r.getStatus())).count();
            long naoConformeCount = totalRecords - conformeCount;
            double taxaConformidade = totalRecords > 0 ? (conformeCount * 100.0) / totalRecords : 100.0;

            BigDecimal minOutAbs = records.stream().map(TemperatureRecord::getTempMin).filter(java.util.Objects::nonNull).min(BigDecimal::compareTo).orElse(null);
            BigDecimal maxOutAbs = records.stream().map(TemperatureRecord::getTempMax).filter(java.util.Objects::nonNull).max(BigDecimal::compareTo).orElse(null);

            double avgCurrent = records.stream()
                .map(r -> {
                    if (r.getTempCurrent() != null) return r.getTempCurrent();
                    if (r.getTempMaxIn() != null && r.getTempMinIn() != null) {
                        return r.getTempMaxIn().add(r.getTempMinIn()).divide(BigDecimal.valueOf(2), 1, RoundingMode.HALF_UP);
                    }
                    return null;
                })
                .filter(java.util.Objects::nonNull)
                .mapToDouble(BigDecimal::doubleValue)
                .average()
                .orElse(Double.NaN);

            PdfPTable kpiTable = new PdfPTable(5);
            kpiTable.setWidthPercentage(100);
            kpiTable.setWidths(new float[]{20, 20, 20, 20, 20});
            kpiTable.setSpacingAfter(8);

            addKpiBox(kpiTable, "Total de Registros", String.valueOf(totalRecords), new Color(240, 253, 244));
            addKpiBox(kpiTable, "Conformes / NC", conformeCount + " / " + naoConformeCount, naoConformeCount > 0 ? new Color(254, 242, 242) : new Color(240, 253, 244));
            addKpiBox(kpiTable, "Taxa Conformidade", String.format("%.1f%%", taxaConformidade), taxaConformidade >= 95.0 ? new Color(240, 253, 244) : new Color(254, 242, 242));
            addKpiBox(kpiTable, "Faixa Registrada (OUT)", (minOutAbs != null ? minOutAbs + "°C" : "-") + " a " + (maxOutAbs != null ? maxOutAbs + "°C" : "-"), new Color(248, 250, 252));
            addKpiBox(kpiTable, "Média Temp. Ambiente", !Double.isNaN(avgCurrent) ? String.format("%.1f°C", avgCurrent) : "-", new Color(248, 250, 252));

            doc.add(kpiTable);

            // 4. Tabela Principal de Registros Diários
            PdfPTable table = new PdfPTable(9);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{10, 8, 20, 10, 10, 12, 8, 10, 12});

            String[] headers = {"Data", "Hora", "Equipamento", "Máx OUT", "Mín OUT", "Temp. Ambiente", "UR (%)", "Status", "Responsável"};
            for (String h : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(h, headerCellFont));
                cell.setBackgroundColor(new Color(22, 101, 52));
                cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
                cell.setPadding(4);
                table.addCell(cell);
            }

            for (TemperatureRecord r : records) {
                boolean isAlert = "NAO_CONFORME".equalsIgnoreCase(r.getStatus());
                Font f = isAlert ? cellAlertFont : cellFont;

                BigDecimal current = r.getTempCurrent();
                if (current == null && r.getTempMaxIn() != null && r.getTempMinIn() != null) {
                    current = r.getTempMaxIn().add(r.getTempMinIn()).divide(BigDecimal.valueOf(2), 1, RoundingMode.HALF_UP);
                }

                PdfPCell cData = new PdfPCell(new Phrase(r.getDate().format(DATE_FMT), f));
                cData.setHorizontalAlignment(Element.ALIGN_CENTER);
                if (isAlert) cData.setBackgroundColor(new Color(254, 242, 242));
                table.addCell(cData);

                PdfPCell cHora = new PdfPCell(new Phrase(r.getTime().format(TIME_FMT), f));
                cHora.setHorizontalAlignment(Element.ALIGN_CENTER);
                if (isAlert) cHora.setBackgroundColor(new Color(254, 242, 242));
                table.addCell(cHora);

                PdfPCell cLoc = new PdfPCell(new Phrase(r.getLocation() != null ? r.getLocation().getName() : "-", f));
                if (isAlert) cLoc.setBackgroundColor(new Color(254, 242, 242));
                table.addCell(cLoc);

                PdfPCell cMaxOut = new PdfPCell(new Phrase(r.getTempMax() != null ? String.format("%.1f°C", r.getTempMax()) : "-", f));
                cMaxOut.setHorizontalAlignment(Element.ALIGN_RIGHT);
                if (isAlert) cMaxOut.setBackgroundColor(new Color(254, 242, 242));
                table.addCell(cMaxOut);

                PdfPCell cMinOut = new PdfPCell(new Phrase(r.getTempMin() != null ? String.format("%.1f°C", r.getTempMin()) : "-", f));
                cMinOut.setHorizontalAlignment(Element.ALIGN_RIGHT);
                if (isAlert) cMinOut.setBackgroundColor(new Color(254, 242, 242));
                table.addCell(cMinOut);

                PdfPCell cCur = new PdfPCell(new Phrase(current != null ? String.format("%.1f°C", current) : "-", f));
                cCur.setHorizontalAlignment(Element.ALIGN_RIGHT);
                if (isAlert) cCur.setBackgroundColor(new Color(254, 242, 242));
                table.addCell(cCur);

                PdfPCell cHum = new PdfPCell(new Phrase(r.getHumidity() != null ? String.format("%.0f%%", r.getHumidity()) : "-", f));
                cHum.setHorizontalAlignment(Element.ALIGN_RIGHT);
                if (isAlert) cHum.setBackgroundColor(new Color(254, 242, 242));
                table.addCell(cHum);

                PdfPCell cStatus = new PdfPCell(new Phrase(r.getStatus(), f));
                cStatus.setHorizontalAlignment(Element.ALIGN_CENTER);
                cStatus.setBackgroundColor(isAlert ? new Color(254, 226, 226) : new Color(240, 253, 244));
                table.addCell(cStatus);

                PdfPCell cResp = new PdfPCell(new Phrase(r.getResponsible() != null ? r.getResponsible() : "-", f));
                if (isAlert) cResp.setBackgroundColor(new Color(254, 242, 242));
                table.addCell(cResp);
            }

            if (records.isEmpty()) {
                PdfPCell emptyCell = new PdfPCell(new Phrase("Nenhum registro de temperatura encontrado no período selecionado.", cellFont));
                emptyCell.setColspan(9);
                emptyCell.setHorizontalAlignment(Element.ALIGN_CENTER);
                emptyCell.setPadding(10);
                table.addCell(emptyCell);
            }

            doc.add(table);

            // 5. Seção de Não Conformidades e Ações Corretivas
            List<TemperatureRecord> nonCompliantRecords = records.stream()
                .filter(r -> "NAO_CONFORME".equalsIgnoreCase(r.getStatus()) || (r.getActionTaken() != null && !r.getActionTaken().isBlank()))
                .toList();

            if (!nonCompliantRecords.isEmpty()) {
                Paragraph ncHeader = new Paragraph("\nREGISTRO DE NÃO CONFORMIDADES E AÇÕES CORRETIVAS", sectionTitleFont);
                ncHeader.setSpacingBefore(6);
                ncHeader.setSpacingAfter(4);
                doc.add(ncHeader);

                PdfPTable ncTable = new PdfPTable(5);
                ncTable.setWidthPercentage(100);
                ncTable.setWidths(new float[]{12, 10, 20, 43, 15});

                String[] ncHeaders = {"Data / Hora", "Status", "Equipamento", "Ação Corretiva Tomada / Justificativa", "Responsável"};
                for (String h : ncHeaders) {
                    PdfPCell cell = new PdfPCell(new Phrase(h, headerCellFont));
                    cell.setBackgroundColor(new Color(153, 27, 27));
                    cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                    cell.setPadding(3);
                    ncTable.addCell(cell);
                }

                for (TemperatureRecord nc : nonCompliantRecords) {
                    PdfPCell cDt = new PdfPCell(new Phrase(nc.getDate().format(DATE_FMT) + " " + nc.getTime().format(TIME_FMT), cellFont));
                    cDt.setHorizontalAlignment(Element.ALIGN_CENTER);
                    ncTable.addCell(cDt);

                    PdfPCell cSt = new PdfPCell(new Phrase(nc.getStatus(), cellAlertFont));
                    cSt.setHorizontalAlignment(Element.ALIGN_CENTER);
                    ncTable.addCell(cSt);

                    ncTable.addCell(new PdfPCell(new Phrase(nc.getLocation() != null ? nc.getLocation().getName() : "-", cellFont)));

                    String actionText = nc.getActionTaken() != null && !nc.getActionTaken().isBlank()
                        ? nc.getActionTaken()
                        : (nc.getNotes() != null ? nc.getNotes() : "Sem descrição registrada.");
                    ncTable.addCell(new PdfPCell(new Phrase(actionText, cellFont)));

                    ncTable.addCell(new PdfPCell(new Phrase(nc.getResponsible() != null ? nc.getResponsible() : "-", cellFont)));
                }

                doc.add(ncTable);
            }

            // 6. Bloco de Assinaturas e Validação Técnica
            Paragraph sigSpace = new Paragraph("\n", cellFont);
            doc.add(sigSpace);

            PdfPTable sigTable = new PdfPTable(2);
            sigTable.setWidthPercentage(100);
            sigTable.setWidths(new float[]{50, 50});
            sigTable.setKeepTogether(true);

            PdfPCell sig1 = new PdfPCell();
            sig1.setBorder(0);
            sig1.setHorizontalAlignment(Element.ALIGN_CENTER);
            sig1.addElement(new Paragraph("____________________________________________", cellFont));
            sig1.addElement(new Paragraph("Responsável Técnico / Farmacêutico (CRF / CRBM)", cellBoldFont));
            sig1.addElement(new Paragraph("Data de Validação: ____/____/________", cellFont));

            PdfPCell sig2 = new PdfPCell();
            sig2.setBorder(0);
            sig2.setHorizontalAlignment(Element.ALIGN_CENTER);
            sig2.addElement(new Paragraph("____________________________________________", cellFont));
            sig2.addElement(new Paragraph("Supervisão da Garantia da Qualidade (CQ)", cellBoldFont));
            sig2.addElement(new Paragraph("Data de Visto: ____/____/________", cellFont));

            sigTable.addCell(sig1);
            sigTable.addCell(sig2);
            doc.add(sigTable);

            // 7. Rodapé Regulatório
            Paragraph footer = new Paragraph(
                "\nDocumento emitido eletronicamente em " + LocalDate.now().format(DATE_FMT) + " conforme ANVISA RDC 978/2025 e RDC 786/2023. Rastreabilidade metrológica e integridade asseguradas pelo Sistema Biodiagnóstico.",
                footerFont
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

    private void addMetaCell(PdfPTable table, String label, String value, Font boldFont, Font normalFont) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(3);
        cell.setBorderColor(new Color(226, 232, 240));
        cell.setBackgroundColor(new Color(248, 250, 252));

        Phrase p = new Phrase();
        p.add(new Phrase(label + " ", boldFont));
        p.add(new Phrase(value, normalFont));
        cell.addElement(p);

        table.addCell(cell);
    }

    private void addKpiBox(PdfPTable table, String title, String value, Color bgColor) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(4);
        cell.setBackgroundColor(bgColor);
        cell.setBorderColor(new Color(203, 213, 225));
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);

        Font tFont = new Font(Font.HELVETICA, 6.5f, Font.BOLD, new Color(71, 85, 105));
        Font vFont = new Font(Font.HELVETICA, 9.5f, Font.BOLD, new Color(15, 23, 42));

        Paragraph pTitle = new Paragraph(title, tFont);
        pTitle.setAlignment(Element.ALIGN_CENTER);
        cell.addElement(pTitle);

        Paragraph pVal = new Paragraph(value, vFont);
        pVal.setAlignment(Element.ALIGN_CENTER);
        cell.addElement(pVal);

        table.addCell(cell);
    }
}

package com.biodiagnostico.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.biodiagnostico.config.AiProperties;
import com.biodiagnostico.dto.request.TemperatureLocationRequest;
import com.biodiagnostico.dto.request.TemperatureRecordRequest;
import com.biodiagnostico.entity.TemperatureLocation;
import com.biodiagnostico.entity.TemperatureRecord;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.exception.ResourceNotFoundException;
import com.biodiagnostico.repository.TemperatureLocationRepository;
import com.biodiagnostico.repository.TemperatureRecordRepository;
import com.biodiagnostico.repository.UserRepository;
import com.biodiagnostico.service.ai.AiModelRouter;
import com.biodiagnostico.service.ai.AiProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TemperatureServiceTest {

    private TemperatureLocationRepository locationRepository;
    private TemperatureRecordRepository recordRepository;
    private UserRepository userRepository;
    private AiProvider aiProvider;
    private AiModelRouter modelRouter;
    private ObjectMapper objectMapper;
    private TemperatureService temperatureService;

    @BeforeEach
    void setUp() {
        locationRepository = mock(TemperatureLocationRepository.class);
        recordRepository = mock(TemperatureRecordRepository.class);
        userRepository = mock(UserRepository.class);
        aiProvider = mock(AiProvider.class);
        AiProperties properties = new AiProperties();
        modelRouter = new AiModelRouter(properties);
        objectMapper = new ObjectMapper();

        temperatureService = new TemperatureService(
            locationRepository,
            recordRepository,
            userRepository,
            aiProvider,
            modelRouter,
            objectMapper
        );
    }

    @Test
    @DisplayName("evaluateStatus deve retornar CONFORME quando temperaturas e umidade estão dentro dos limites")
    void evaluateStatus_conforme() {
        TemperatureLocation loc = TemperatureLocation.builder()
            .minTempTarget(new BigDecimal("2.0"))
            .maxTempTarget(new BigDecimal("8.0"))
            .minHumidityTarget(new BigDecimal("30.0"))
            .maxHumidityTarget(new BigDecimal("70.0"))
            .build();

        String status = temperatureService.evaluateStatus(
            loc,
            new BigDecimal("3.5"),
            new BigDecimal("6.0"),
            new BigDecimal("50.0")
        );

        assertThat(status).isEqualTo("CONFORME");
    }

    @Test
    @DisplayName("evaluateStatus deve retornar NAO_CONFORME quando temperatura máxima excede o limite")
    void evaluateStatus_tempMaxExcedida_naoConforme() {
        TemperatureLocation loc = TemperatureLocation.builder()
            .minTempTarget(new BigDecimal("2.0"))
            .maxTempTarget(new BigDecimal("8.0"))
            .build();

        String status = temperatureService.evaluateStatus(
            loc,
            new BigDecimal("4.0"),
            new BigDecimal("9.2"),
            null
        );

        assertThat(status).isEqualTo("NAO_CONFORME");
    }

    @Test
    @DisplayName("evaluateStatus deve retornar NAO_CONFORME quando temperatura mínima está abaixo do limite")
    void evaluateStatus_tempMinAbaixo_naoConforme() {
        TemperatureLocation loc = TemperatureLocation.builder()
            .minTempTarget(new BigDecimal("2.0"))
            .maxTempTarget(new BigDecimal("8.0"))
            .build();

        String status = temperatureService.evaluateStatus(
            loc,
            new BigDecimal("1.2"),
            new BigDecimal("5.0"),
            null
        );

        assertThat(status).isEqualTo("NAO_CONFORME");
    }

    @Test
    @DisplayName("evaluateStatus deve retornar NAO_CONFORME quando umidade excede o limite")
    void evaluateStatus_umidadeExcedida_naoConforme() {
        TemperatureLocation loc = TemperatureLocation.builder()
            .minTempTarget(new BigDecimal("15.0"))
            .maxTempTarget(new BigDecimal("25.0"))
            .minHumidityTarget(new BigDecimal("30.0"))
            .maxHumidityTarget(new BigDecimal("70.0"))
            .build();

        String status = temperatureService.evaluateStatus(
            loc,
            new BigDecimal("20.0"),
            new BigDecimal("22.0"),
            new BigDecimal("82.0")
        );

        assertThat(status).isEqualTo("NAO_CONFORME");
    }

    @Test
    @DisplayName("createLocation deve salvar quando dados são válidos")
    void createLocation_valido() {
        TemperatureLocationRequest req = new TemperatureLocationRequest(
            "Geladeira 1", "GEL-01", "GELADEIRA", "BIOQUIMICA",
            new BigDecimal("2.0"), new BigDecimal("8.0"), null, null,
            "TERM-01", "CAL-123", LocalDate.of(2027, 1, 1), "DIARIO_1X", true, "Notas"
        );

        when(locationRepository.findByCode("GEL-01")).thenReturn(Optional.empty());
        when(locationRepository.save(any())).thenAnswer(inv -> {
            TemperatureLocation loc = inv.getArgument(0);
            loc.setId(UUID.randomUUID());
            return loc;
        });

        TemperatureLocation result = temperatureService.createLocation(req);

        assertThat(result.getCode()).isEqualTo("GEL-01");
        assertThat(result.getMinTempTarget()).isEqualByComparingTo("2.0");
        verify(locationRepository).save(any());
    }

    @Test
    @DisplayName("createLocation deve lançar exceção se código já existir")
    void createLocation_codigoDuplicado_lancaExcecao() {
        TemperatureLocationRequest req = new TemperatureLocationRequest(
            "Geladeira 1", "GEL-01", "GELADEIRA", "BIOQUIMICA",
            new BigDecimal("2.0"), new BigDecimal("8.0"), null, null,
            null, null, null, "DIARIO_1X", true, null
        );

        when(locationRepository.findByCode("GEL-01")).thenReturn(Optional.of(new TemperatureLocation()));

        assertThatThrownBy(() -> temperatureService.createLocation(req))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Já existe um ponto de monitoramento");
    }

    @Test
    @DisplayName("createRecord deve salvar e derivar status automaticamente")
    void createRecord_valido() {
        UUID locId = UUID.randomUUID();
        TemperatureLocation loc = TemperatureLocation.builder()
            .id(locId)
            .name("Geladeira 1")
            .minTempTarget(new BigDecimal("2.0"))
            .maxTempTarget(new BigDecimal("8.0"))
            .build();

        when(locationRepository.findById(locId)).thenReturn(Optional.of(loc));
        when(recordRepository.save(any())).thenAnswer(inv -> {
            TemperatureRecord r = inv.getArgument(0);
            r.setId(UUID.randomUUID());
            return r;
        });

        TemperatureRecordRequest req = new TemperatureRecordRequest(
            locId,
            LocalDate.of(2026, 8, 22),
            LocalTime.of(15, 5),
            "UNICO",
            new BigDecimal("4.5"),
            new BigDecimal("6.0"),
            new BigDecimal("3.0"),
            new BigDecimal("20.0"),
            new BigDecimal("19.5"),
            null,
            "Farmacêutico Responsável",
            null,
            "Rotina normal",
            null,
            null,
            null,
            null,
            null,
            true
        );

        TemperatureRecord result = temperatureService.createRecord(req, "admin");

        assertThat(result.getStatus()).isEqualTo("CONFORME");
        assertThat(result.getResponsible()).isEqualTo("Farmacêutico Responsável");
        verify(recordRepository).save(any());
    }

    @Test
    @DisplayName("getSummary deve computar totais, pendências e não-conformidades")
    void getSummary_computaTotais() {
        UUID locId1 = UUID.randomUUID();
        UUID locId2 = UUID.randomUUID();

        TemperatureLocation loc1 = TemperatureLocation.builder().id(locId1).name("Geladeira 1").active(true).build();
        TemperatureLocation loc2 = TemperatureLocation.builder().id(locId2).name("Freezer 1").active(true).build();

        when(locationRepository.count()).thenReturn(2L);
        when(locationRepository.findByActiveTrueOrderByNameAsc()).thenReturn(List.of(loc1, loc2));

        TemperatureRecord r1 = TemperatureRecord.builder()
            .id(UUID.randomUUID())
            .location(loc1)
            .status("CONFORME")
            .build();

        when(recordRepository.findByDateWithLocation(any())).thenReturn(List.of(r1));
        when(recordRepository.countNonCompliantBetween(any(), any())).thenReturn(0L);
        when(locationRepository.findExpiringCalibrations(any())).thenReturn(List.of());

        var summary = temperatureService.getSummary();

        assertThat(summary.totalLocations()).isEqualTo(2);
        assertThat(summary.activeLocations()).isEqualTo(2);
        assertThat(summary.recordedToday()).isEqualTo(1);
        assertThat(summary.pendingToday()).isEqualTo(1);
        assertThat(summary.nonCompliantToday()).isEqualTo(0);
    }

    @Test
    @DisplayName("processThermometerPhoto com IA deve parsear JSON de visão única")
    void processThermometerPhoto_comIa_parseiaJson() throws Exception {
        when(aiProvider.completeVisionMulti(any(), any(), any()))
            .thenReturn("""
                {
                  "time": "15:05",
                  "tempMax": 1.9,
                  "tempMin": 1.9,
                  "tempCurrent": null,
                  "humidity": null,
                  "confidence": 0.98,
                  "statusMessage": "Display lido perfeitamente",
                  "rawText": "15:05 MAX OUT 1.9 MIN OUT 1.9"
                }
                """);

        var response = temperatureService.processThermometerPhoto("abc123base64", "image/jpeg", null);

        assertThat(response.time()).isEqualTo("15:05");
        assertThat(response.tempMax()).isEqualByComparingTo("1.9");
        assertThat(response.tempMin()).isEqualByComparingTo("1.9");
        assertThat(response.confidence()).isEqualTo(0.98);
    }

    @Test
    @DisplayName("processThermometerPhoto com fotos duplas (MAX e MIN) deve parsear ambos os visores")
    void processThermometerPhoto_comFotosDuplas() throws Exception {
        when(aiProvider.completeVisionMulti(any(), any(), any()))
            .thenReturn("""
                {
                  "time": "15:37",
                  "tempMax": 6.1,
                  "tempMin": 0.2,
                  "tempMaxIn": 19.9,
                  "tempMinIn": 19.6,
                  "humidity": 97.0,
                  "confidence": 0.99,
                  "statusMessage": "OUT: Máx 6.1°C / Mín 0.2°C | IN: Máx 19.9°C / Mín 19.6°C | UR: 97%",
                  "rawText": "MAX OUT 6.1 IN 19.9 MIN OUT 0.2 IN 19.6 15:37 97%RH"
                }
                """);

        var response = temperatureService.processThermometerPhoto(
            "maxPhotoBase64",
            "image/jpeg",
            "minPhotoBase64",
            "image/jpeg",
            null
        );

        assertThat(response.time()).isEqualTo("15:37");
        assertThat(response.tempMax()).isEqualByComparingTo("6.1");
        assertThat(response.tempMin()).isEqualByComparingTo("0.2");
        assertThat(response.tempMaxIn()).isEqualByComparingTo("19.9");
        assertThat(response.tempMinIn()).isEqualByComparingTo("19.6");
        assertThat(response.tempCurrent()).isEqualByComparingTo("19.8");
        assertThat(response.humidity()).isEqualByComparingTo("97.0");
        assertThat(response.statusMessage()).contains("OUT: Máx 6.1°C / Mín 0.2°C");
        assertThat(response.confidence()).isEqualTo(0.99);
    }

    @Test
    @DisplayName("getLocations sem filtros deve chamar findAllByOrderByNameAsc")
    void getLocations_semFiltros() {
        when(locationRepository.findAllByOrderByNameAsc()).thenReturn(List.of(new TemperatureLocation()));

        List<TemperatureLocation> result = temperatureService.getLocations(null, null);

        assertThat(result).hasSize(1);
        verify(locationRepository).findAllByOrderByNameAsc();
    }

    @Test
    @DisplayName("getLocations com área e ativo deve chamar findByAreaIgnoreCaseAndActiveOrderByNameAsc")
    void getLocations_comAreaEAtivo() {
        when(locationRepository.findByAreaIgnoreCaseAndActiveOrderByNameAsc("BIOQUIMICA", true))
            .thenReturn(List.of(new TemperatureLocation()));

        List<TemperatureLocation> result = temperatureService.getLocations("BIOQUIMICA", true);

        assertThat(result).hasSize(1);
        verify(locationRepository).findByAreaIgnoreCaseAndActiveOrderByNameAsc("BIOQUIMICA", true);
    }

    @Test
    @DisplayName("getRecords sem filtros deve chamar findInPeriod")
    void getRecords_semFiltros() {
        when(recordRepository.findInPeriod(any(), any())).thenReturn(List.of(new TemperatureRecord()));

        List<TemperatureRecord> result = temperatureService.getRecords(null, 8, 2026, null, null, null);

        assertThat(result).hasSize(1);
        verify(recordRepository).findInPeriod(any(), any());
    }
}

package com.biodiagnostico.controller;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.biodiagnostico.config.SecurityConfig;
import com.biodiagnostico.dto.request.HematologyMeasurementRequest;
import com.biodiagnostico.dto.request.HematologyParameterRequest;
import com.biodiagnostico.dto.response.HematologyMeasurementResponse;
import com.biodiagnostico.dto.response.HematologyParameterResponse;
import com.biodiagnostico.entity.HematologyBioRecord;
import com.biodiagnostico.exception.GlobalExceptionHandler;
import com.biodiagnostico.exception.ResourceNotFoundException;
import com.biodiagnostico.security.JwtAuthFilter;
import com.biodiagnostico.service.HematologyQcService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(HematologyController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, HematologyControllerTest.NoOpJwtFilterConfig.class})
class HematologyControllerTest {

    private static final String TEST_JWT_SECRET = "testsecretkeythatisfarlongerthanthirtytwobytesforjwt";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private StubHematologyQcService hematologyQcService;

    @Test
    @DisplayName("deve retornar 201 com rastreabilidade do parâmetro ao registrar medição")
    void shouldReturn201WithParameterTraceabilityWhenCreatingMeasurement() throws Exception {
        hematologyQcService.createMeasurementResponse = measurementResponse("APROVADO");

        mockMvc.perform(post("/api/hematology/measurements")
                .with(user("ana").roles("ANALYST"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(validMeasurementRequest())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.parameterId").exists())
            .andExpect(jsonPath("$.parameterEquipamento").value("Sysmex XN-1000"))
            .andExpect(jsonPath("$.parameterLoteControle").value("LOTE-H01"))
            .andExpect(jsonPath("$.parameterNivelControle").value("Normal"))
            .andExpect(jsonPath("$.status").value("APROVADO"))
            .andExpect(jsonPath("$.modoUsado").value("INTERVALO"));
    }

    @Test
    @DisplayName("deve retornar 201 ao criar parâmetro de hematologia")
    void shouldReturn201WhenCreatingParameter() throws Exception {
        hematologyQcService.createParameterResponse = parameterResponse();

        mockMvc.perform(post("/api/hematology/parameters")
                .with(user("ana").roles("ANALYST"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(validParameterRequest())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.analito").value("RBC"))
            .andExpect(jsonPath("$.modo").value("INTERVALO"))
            .andExpect(jsonPath("$.isActive").value(true));
    }

    @Test
    @DisplayName("deve retornar lista de parâmetros como DTOs")
    void shouldReturnParameterListAsDtos() throws Exception {
        hematologyQcService.parameterList = List.of(parameterResponse());

        mockMvc.perform(get("/api/hematology/parameters")
                .with(user("ana").roles("ANALYST")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].analito").value("RBC"))
            .andExpect(jsonPath("$[0].equipamento").value("Sysmex XN-1000"));
    }

    @Test
    @DisplayName("deve retornar lista de medições com rastreabilidade")
    void shouldReturnMeasurementListWithTraceability() throws Exception {
        hematologyQcService.measurementList = List.of(measurementResponse("APROVADO"));

        mockMvc.perform(get("/api/hematology/measurements")
                .with(user("ana").roles("ANALYST")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].parameterId").exists())
            .andExpect(jsonPath("$[0].parameterEquipamento").value("Sysmex XN-1000"));
    }

    @Test
    @DisplayName("deve exigir autenticação para registrar medição")
    void shouldRequireAuthenticationForMeasurement() throws Exception {
        mockMvc.perform(post("/api/hematology/measurements")
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(validMeasurementRequest())))
            .andExpect(status().isUnauthorized());
    }

    @TestConfiguration
    static class NoOpJwtFilterConfig {
        @Bean
        StubHematologyQcService stubHematologyQcService() {
            return new StubHematologyQcService();
        }

        @Bean
        com.biodiagnostico.security.JwtTokenProvider jwtTokenProvider() {
            return new com.biodiagnostico.security.JwtTokenProvider(TEST_JWT_SECRET, 900_000, 604_800_000);
        }

        @Bean
        JwtAuthFilter jwtAuthFilter(com.biodiagnostico.security.JwtTokenProvider jwtTokenProvider) {
            return new JwtAuthFilter(jwtTokenProvider);
        }
    }

    static class StubHematologyQcService extends HematologyQcService {
        private HematologyMeasurementResponse createMeasurementResponse;
        private HematologyParameterResponse createParameterResponse;
        private List<HematologyParameterResponse> parameterList = List.of();
        private List<HematologyMeasurementResponse> measurementList = List.of();

        StubHematologyQcService() {
            super(null, null, null);
        }

        @Override
        public HematologyMeasurementResponse createMeasurement(
            com.biodiagnostico.dto.request.HematologyMeasurementRequest request
        ) {
            return createMeasurementResponse;
        }

        @Override
        public HematologyParameterResponse createParameter(
            com.biodiagnostico.dto.request.HematologyParameterRequest request
        ) {
            return createParameterResponse;
        }

        @Override
        public List<HematologyParameterResponse> getParameters(String analito) {
            return parameterList;
        }

        @Override
        public List<HematologyMeasurementResponse> getMeasurements(UUID parameterId) {
            return measurementList;
        }

        @Override
        public List<HematologyBioRecord> getBioRecords() {
            return List.of();
        }
    }

    private HematologyMeasurementRequest validMeasurementRequest() {
        return new HematologyMeasurementRequest(
            UUID.randomUUID(),
            LocalDate.of(2026, 4, 4),
            "RBC",
            4.5,
            "Controle nominal"
        );
    }

    private HematologyParameterRequest validParameterRequest() {
        return new HematologyParameterRequest(
            "RBC", "Sysmex XN-1000", "LOTE-H01", "Normal", "INTERVALO",
            4.5, 4.0, 5.0, 0.0
        );
    }

    private HematologyMeasurementResponse measurementResponse(String status) {
        return new HematologyMeasurementResponse(
            UUID.randomUUID(),
            UUID.randomUUID(),
            "Sysmex XN-1000",
            "LOTE-H01",
            "Normal",
            LocalDate.of(2026, 4, 4),
            "RBC",
            4.5,
            "INTERVALO",
            4.0,
            5.0,
            status,
            "Controle nominal",
            Instant.now()
        );
    }

    private HematologyParameterResponse parameterResponse() {
        return new HematologyParameterResponse(
            UUID.randomUUID(),
            "RBC",
            "Sysmex XN-1000",
            "LOTE-H01",
            "Normal",
            "INTERVALO",
            4.5,
            4.0,
            5.0,
            0.0,
            true,
            Instant.now(),
            Instant.now()
        );
    }
}

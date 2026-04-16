package com.biodiagnostico.controller;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.biodiagnostico.config.SecurityConfig;
import com.biodiagnostico.dto.request.ReagentLotRequest;
import com.biodiagnostico.dto.request.StockMovementRequest;
import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.entity.StockMovement;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.exception.GlobalExceptionHandler;
import com.biodiagnostico.security.AccessTokenBlacklistService;
import com.biodiagnostico.security.JwtAuthFilter;
import com.biodiagnostico.service.ReagentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ReagentController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, ReagentControllerTest.TestConfig.class})
class ReagentControllerTest {

    private static final String TEST_JWT_SECRET = "testsecretkeythatisfarlongerthanthirtytwobytesforjwt";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private StubReagentService reagentService;

    @BeforeEach
    void resetStub() {
        reagentService.createLotResponse = null;
        reagentService.createMovementResponse = null;
        reagentService.createMovementException = null;
        reagentService.byLotNumberResponse = List.of();
    }

    @Test
    @DisplayName("createLot deve retornar 201 com ReagentLotResponse")
    void createLot_deveRetornarReagentLotResponse() throws Exception {
        ReagentLot lot = buildLot(80D);
        reagentService.createLotResponse = lot;

        String body = objectMapper.writeValueAsString(
            new ReagentLotRequest("ALT", "L123", "Bio", "Bioquímica",
                LocalDate.now().plusDays(60), 100D, "frascos", 80D, 2D, "2-8C",
                LocalDate.now(), null, 7, "ativo", null, null, null, null));

        mockMvc.perform(post("/api/reagents")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("ALT"))
            .andExpect(jsonPath("$.lotNumber").value("L123"));
    }

    @Test
    @DisplayName("createMovement deve retornar 201 com StockMovementResponse")
    void createMovement_deveRetornarStockMovementResponse() throws Exception {
        StockMovement movement = StockMovement.builder()
            .id(UUID.randomUUID())
            .type("ENTRADA")
            .quantity(20D)
            .responsible("Ana")
            .notes("")
            .build();
        reagentService.createMovementResponse = movement;

        UUID lotId = UUID.randomUUID();
        String body = objectMapper.writeValueAsString(
            new StockMovementRequest("ENTRADA", 20D, "Ana", "", null));

        mockMvc.perform(post("/api/reagents/" + lotId + "/movements")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.type").value("ENTRADA"))
            .andExpect(jsonPath("$.quantity").value(20D));
    }

    @Test
    @DisplayName("saída com estoque insuficiente deve retornar 400")
    void saidaComEstoqueInsuficiente_deveRetornar400() throws Exception {
        reagentService.createMovementException =
            new BusinessException("Estoque insuficiente para esta saída. Estoque atual: 10.0");

        UUID lotId = UUID.randomUUID();
        String body = objectMapper.writeValueAsString(
            new StockMovementRequest("SAIDA", 50D, "Ana", "", null));

        mockMvc.perform(post("/api/reagents/" + lotId + "/movements")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Estoque insuficiente para esta saída. Estoque atual: 10.0"));
    }

    @Test
    @DisplayName("getByLotNumber deve retornar lista")
    void getByLotNumber_deveRetornarLista() throws Exception {
        ReagentLot lot1 = buildLot(100D);
        ReagentLot lot2 = buildLot(50D);
        lot2.setManufacturer("OutroFab");
        reagentService.byLotNumberResponse = List.of(lot1, lot2);

        mockMvc.perform(get("/api/reagents/by-lot-number")
                .param("lotNumber", "L123")
                .with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].lotNumber").value("L123"));
    }

    @TestConfiguration
    static class TestConfig {
        @Bean
        StubReagentService stubReagentService() {
            return new StubReagentService();
        }

        @Bean
        io.micrometer.core.instrument.MeterRegistry meterRegistry() {
            return new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
        }

        @Bean
        com.biodiagnostico.security.JwtTokenProvider jwtTokenProvider() {
            return new com.biodiagnostico.security.JwtTokenProvider(TEST_JWT_SECRET, "test-issuer", 900_000, 604_800_000);
        }

        @Bean
        AccessTokenBlacklistService accessTokenBlacklistService() {
            return new AccessTokenBlacklistService();
        }

        @Bean
        JwtAuthFilter jwtAuthFilter(
            com.biodiagnostico.security.JwtTokenProvider jwtTokenProvider,
            AccessTokenBlacklistService accessTokenBlacklistService
        ) {
            return new JwtAuthFilter(jwtTokenProvider, accessTokenBlacklistService);
        }
    }

    static class StubReagentService extends ReagentService {
        ReagentLot createLotResponse;
        StockMovement createMovementResponse;
        RuntimeException createMovementException;
        List<ReagentLot> byLotNumberResponse = List.of();

        StubReagentService() {
            super(null, null, null);
        }

        @Override
        public ReagentLot createLot(ReagentLotRequest request) {
            return createLotResponse;
        }

        @Override
        public StockMovement createMovement(UUID lotId, StockMovementRequest request) {
            if (createMovementException != null) {
                throw createMovementException;
            }
            return createMovementResponse;
        }

        @Override
        public List<ReagentLot> getByLotNumber(String lotNumber) {
            return byLotNumberResponse;
        }
    }

    private ReagentLot buildLot(double stock) {
        return ReagentLot.builder()
            .id(UUID.randomUUID())
            .name("ALT")
            .lotNumber("L123")
            .manufacturer("Bio")
            .category("Bioquímica")
            .quantityValue(100D)
            .currentStock(stock)
            .estimatedConsumption(2D)
            .stockUnit("frascos")
            .status("ativo")
            .alertThresholdDays(7)
            .build();
    }
}

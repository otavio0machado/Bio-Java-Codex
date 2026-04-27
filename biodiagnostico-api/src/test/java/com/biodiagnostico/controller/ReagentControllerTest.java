package com.biodiagnostico.controller;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.biodiagnostico.config.SecurityConfig;
import com.biodiagnostico.dto.request.ReagentLotRequest;
import com.biodiagnostico.dto.request.StockMovementRequest;
import com.biodiagnostico.dto.response.ReagentLabelSummary;
import com.biodiagnostico.dto.response.ReagentTagSummary;
import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.entity.ReagentStatus;
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
        reagentService.deletedLotId = null;
        reagentService.labelSummaries = List.of();
        reagentService.tagSummaries = List.of();
        reagentService.getLotsResponse = null;
        reagentService.getLotsException = null;
    }

    private static ReagentLotRequest sampleRequest() {
        return new ReagentLotRequest(
            "ALT", "L123", "Bio", "Bioquímica",
            80D, "em_estoque",
            LocalDate.now().plusDays(60), "Geladeira 2", "2-8°C",
            null, null, null
        );
    }

    @Test
    @DisplayName("POST /api/reagents com 9 obrigatorios cria com 201")
    void createLot_deveRetornar201() throws Exception {
        ReagentLot lot = buildLot(80D);
        reagentService.createLotResponse = lot;

        String body = objectMapper.writeValueAsString(sampleRequest());

        mockMvc.perform(post("/api/reagents")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.label").value("ALT"))
            .andExpect(jsonPath("$.lotNumber").value("L123"))
            .andExpect(jsonPath("$.canReceiveEntry").value(true))
            .andExpect(jsonPath("$.allowedMovementTypes[0]").value("ENTRADA"));
    }

    @Test
    @DisplayName("POST /api/reagents sem location retorna 400")
    void createLot_semLocation_deveRetornar400() throws Exception {
        // location vazio viola @NotBlank
        ReagentLotRequest req = new ReagentLotRequest(
            "ALT", "L123", "Bio", "Bioquímica",
            80D, "em_estoque",
            LocalDate.now().plusDays(60), "", "2-8°C",
            null, null, null
        );

        mockMvc.perform(post("/api/reagents")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/reagents com category fora de lista retorna 400")
    void createLot_categoryInvalida_deveRetornar400() throws Exception {
        reagentService.createLotException =
            new BusinessException("Categoria invalida. Valores aceitos: ...");
        ReagentLotRequest req = new ReagentLotRequest(
            "ALT", "L123", "Bio", "INEXISTENTE",
            80D, "em_estoque",
            LocalDate.now().plusDays(60), "Geladeira 2", "2-8°C",
            null, null, null
        );

        mockMvc.perform(post("/api/reagents")
                .with(user("ana").roles("FUNCIONARIO"))
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Categoria invalida. Valores aceitos: ..."));
    }

    @Test
    @DisplayName("GET /api/reagents?status=ativo retorna 400 (status legado)")
    void getLots_statusLegado_deveRetornar400() throws Exception {
        reagentService.getLotsException =
            new BusinessException("Status legado nao suportado. Use: em_estoque, em_uso, fora_de_estoque, vencido");

        mockMvc.perform(get("/api/reagents")
                .param("status", "ativo")
                .with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(
                org.hamcrest.Matchers.containsString("Status legado nao suportado")));
    }

    @Test
    @DisplayName("GET /api/reagents?status=em_estoque retorna 200")
    void getLots_statusNovo_deveRetornar200() throws Exception {
        reagentService.getLotsResponse = List.of();

        mockMvc.perform(get("/api/reagents")
                .param("status", "em_estoque")
                .with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk());
    }

    @Test
    @DisplayName("GET /api/reagents/labels retorna 200 com shape ReagentLabelSummary")
    void getLabels_deveRetornarShapeNovo() throws Exception {
        reagentService.labelSummaries = List.of(
            new ReagentLabelSummary("Glicose HK", 12, 5, 3, 2, 2)
        );

        mockMvc.perform(get("/api/reagents/labels")
                .with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].label").value("Glicose HK"))
            .andExpect(jsonPath("$[0].total").value(12))
            .andExpect(jsonPath("$[0].emEstoque").value(5))
            .andExpect(jsonPath("$[0].emUso").value(3))
            .andExpect(jsonPath("$[0].foraDeEstoque").value(2))
            .andExpect(jsonPath("$[0].vencidos").value(2));
    }

    @Test
    @DisplayName("GET /api/reagents/tags retorna shape antigo + header Deprecation")
    void getTags_deveRetornarShapeAntigoComDeprecation() throws Exception {
        reagentService.tagSummaries = List.of(
            new ReagentTagSummary("Glicose HK", 12, 5, 3, 2, 2)
        );

        mockMvc.perform(get("/api/reagents/tags")
                .with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(header().string("Deprecation", "true"))
            .andExpect(header().string("Link",
                "</api/reagents/labels>; rel=\"successor-version\""))
            .andExpect(jsonPath("$[0].name").value("Glicose HK"))
            .andExpect(jsonPath("$[0].ativos").value(5))
            .andExpect(jsonPath("$[0].emUso").value(3))
            .andExpect(jsonPath("$[0].inativos").value(2))
            .andExpect(jsonPath("$[0].vencidos").value(2));
    }

    @Test
    @DisplayName("CSV header bate com decisao 1.5")
    void exportCsv_header_canonico() throws Exception {
        reagentService.getLotsResponse = List.of();

        var result = mockMvc.perform(get("/api/reagents/export/csv")
                .with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(content().contentType("text/csv; charset=UTF-8"))
            .andReturn();

        String csv = result.getResponse().getContentAsString();
        // Primeira linha exata.
        String firstLine = csv.split("\n")[0].trim();
        org.assertj.core.api.Assertions.assertThat(firstLine)
            .isEqualTo("Etiqueta,Lote,Fabricante,Categoria,Validade,Dias Restantes,Estoque Atual,Status,Localizacao,Temperatura");
    }

    @Test
    @DisplayName("createMovement deve retornar 201 com StockMovementResponse")
    void createMovement_deveRetornar201() throws Exception {
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
    @DisplayName("SAIDA com estoque insuficiente retorna 400")
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

    @Test
    @DisplayName("deleteLot deve retornar 204")
    void deleteLot_deveRetornar204() throws Exception {
        UUID lotId = UUID.randomUUID();

        mockMvc.perform(delete("/api/reagents/" + lotId)
                .with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isNoContent());

        org.assertj.core.api.Assertions.assertThat(reagentService.deletedLotId).isEqualTo(lotId);
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
        RuntimeException createLotException;
        StockMovement createMovementResponse;
        RuntimeException createMovementException;
        List<ReagentLot> byLotNumberResponse = List.of();
        UUID deletedLotId;
        List<ReagentLabelSummary> labelSummaries = List.of();
        List<ReagentTagSummary> tagSummaries = List.of();
        java.util.List<com.biodiagnostico.dto.response.ReagentLotResponse> getLotsResponse;
        RuntimeException getLotsException;

        StubReagentService() {
            super(null, null, null, null);
        }

        @Override
        public ReagentLot createLot(ReagentLotRequest request) {
            if (createLotException != null) {
                throw createLotException;
            }
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

        @Override
        public void deleteLot(UUID id) {
            deletedLotId = id;
        }

        @Override
        public java.util.List<com.biodiagnostico.dto.response.ReagentLotResponse> getLots(String category, String status) {
            if (getLotsException != null) {
                throw getLotsException;
            }
            return getLotsResponse == null ? List.of() : getLotsResponse;
        }

        @Override
        public List<ReagentLabelSummary> getLabelSummaries() {
            return labelSummaries;
        }

        @Override
        public List<ReagentTagSummary> getTagSummaries() {
            return tagSummaries;
        }
    }

    private ReagentLot buildLot(double stock) {
        return ReagentLot.builder()
            .id(UUID.randomUUID())
            .name("ALT")
            .lotNumber("L123")
            .manufacturer("Bio")
            .category("Bioquímica")
            .currentStock(stock)
            .expiryDate(LocalDate.now().plusDays(60))
            .status(ReagentStatus.EM_ESTOQUE)
            .build();
    }
}

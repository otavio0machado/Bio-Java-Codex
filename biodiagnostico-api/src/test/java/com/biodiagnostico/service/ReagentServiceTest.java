package com.biodiagnostico.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.biodiagnostico.dto.request.ReagentLotRequest;
import com.biodiagnostico.dto.request.StockMovementRequest;
import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.entity.StockMovement;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.repository.QcRecordRepository;
import com.biodiagnostico.repository.ReagentLotRepository;
import com.biodiagnostico.repository.StockMovementRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

@ExtendWith(MockitoExtension.class)
class ReagentServiceTest {

    private ReagentService reagentService;

    @Mock
    private ReagentLotRepository reagentLotRepository;

    @Mock
    private StockMovementRepository stockMovementRepository;

    @Mock
    private QcRecordRepository qcRecordRepository;

    /**
     * Fake capturador de chamadas a AuditService. Usamos um fake ao inves de
     * Mockito.mock(AuditService.class) porque o mock-maker inline falha em Java
     * 25 nesta classe concreta. O padrao do projeto (ver QcServiceTest,
     * AuthServiceTest) ja instancia AuditService real com nulls — aqui
     * estendemos para gravar as invocacoes em memoria sem tocar repositorios.
     */
    private RecordingAuditService auditService;

    @BeforeEach
    void setUp() {
        auditService = new RecordingAuditService();
        reagentService = new ReagentService(
            reagentLotRepository, stockMovementRepository, qcRecordRepository, auditService);
    }

    private static final class RecordingAuditService extends AuditService {
        record Call(String action, String entityType, UUID entityId, Map<String, Object> details) {}

        private final List<Call> calls = new ArrayList<>();

        RecordingAuditService() {
            super(null, null, new ObjectMapper());
        }

        @Override
        public void log(String action, String entityType, UUID entityId, Map<String, Object> details) {
            calls.add(new Call(action, entityType, entityId, details));
        }

        @Override
        public void log(String action, String entityType, UUID entityId) {
            log(action, entityType, entityId, null);
        }

        List<Call> callsFor(String action) {
            return calls.stream().filter(c -> c.action().equals(action)).toList();
        }
    }

    @Test
    @DisplayName("deve criar lote com sucesso")
    void shouldCreateLotSuccessfully() {
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(invocation -> invocation.getArgument(0));
        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "L123", "Bio", "Bioquímica", LocalDate.now().plusDays(60), 100D,
            "frascos", 80D, 2D, "2-8C", LocalDate.now(), null, 7, "ativo",
            null, null, null, null
        );

        ReagentLot lot = reagentService.createLot(request);

        assertThat(lot.getName()).isEqualTo("ALT");
    }

    @Test
    @DisplayName("deve aumentar estoque em movimentação de entrada")
    void shouldUpdateCurrentStockOnEntradaMovement() {
        ReagentLot lot = lot(100D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(invocation -> invocation.getArgument(0));

        reagentService.createMovement(lot.getId(), new StockMovementRequest("ENTRADA", 20D, "Ana", "", null));

        assertThat(lot.getCurrentStock()).isEqualTo(120D);
    }

    @Test
    @DisplayName("deve diminuir estoque em movimentação de saída")
    void shouldDecreaseCurrentStockOnSaidaMovement() {
        ReagentLot lot = lot(100D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(invocation -> invocation.getArgument(0));

        reagentService.createMovement(lot.getId(), new StockMovementRequest("SAIDA", 15D, "Ana", "", null));

        assertThat(lot.getCurrentStock()).isEqualTo(85D);
    }

    @Test
    @DisplayName("deve definir estoque em movimentação de ajuste")
    void shouldSetStockOnAjusteMovement() {
        ReagentLot lot = lot(100D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(invocation -> invocation.getArgument(0));

        reagentService.createMovement(lot.getId(), new StockMovementRequest("AJUSTE", 55D, "Ana", "", "CONTAGEM_FISICA"));

        assertThat(lot.getCurrentStock()).isEqualTo(55D);
    }

    @Test
    @DisplayName("deve calcular dias restantes corretamente")
    void shouldCalculateDaysLeftCorrectly() {
        ReagentLot lot = lot(100D);
        lot.setExpiryDate(LocalDate.now().plusDays(10));
        when(reagentLotRepository.findByFilters(isNull(), isNull())).thenReturn(List.of(lot));

        var result = reagentService.getLots(null, null);

        assertThat(result.getFirst().daysLeft()).isBetween(9L, 10L);
    }

    @Test
    @DisplayName("deve buscar lotes vencendo")
    void shouldFindExpiringLots() {
        when(reagentLotRepository.findExpiringLots(any(), any())).thenReturn(List.of(lot(100D)));

        var result = reagentService.getExpiringLots(30);

        assertThat(result).hasSize(1);
    }

    @Test
    @DisplayName("saida com estoque insuficiente deve lançar exception")
    void saidaComEstoqueInsuficiente_deveLancarException() {
        ReagentLot lot = lot(10D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));

        assertThatThrownBy(() ->
            reagentService.createMovement(lot.getId(), new StockMovementRequest("SAIDA", 20D, "Ana", "", null))
        )
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Estoque insuficiente");
    }

    // Validação de quantidade negativa agora é feita por @PositiveOrZero no DTO (Bean Validation).
    // Teste correspondente movido para ReagentControllerTest (camada de integração HTTP).

    @Test
    @DisplayName("getLots deve retornar lotes sem alterar status (auto-vencimento delegado ao scheduler)")
    void getLots_naoDeveAlterarStatus() {
        ReagentLot lot = lot(100D);
        lot.setExpiryDate(LocalDate.now().minusDays(1));
        lot.setStatus("ativo");
        when(reagentLotRepository.findByFilters(isNull(), isNull())).thenReturn(List.of(lot));

        var result = reagentService.getLots(null, null);

        assertThat(lot.getStatus()).isEqualTo("ativo");
        verify(reagentLotRepository, never()).save(any());
        assertThat(result).hasSize(1);
    }

    @Test
    @DisplayName("getByLotNumber deve retornar lotes com mesmo número")
    void getByLotNumber_deveRetornarLotesComMesmoNumero() {
        ReagentLot lot1 = lot(100D);
        ReagentLot lot2 = lot(50D);
        lot2.setManufacturer("OutroFab");
        when(reagentLotRepository.findByLotNumberIgnoreCase("L123")).thenReturn(List.of(lot1, lot2));

        var result = reagentService.getByLotNumber("L123");

        assertThat(result).hasSize(2);
    }

    @Test
    @DisplayName("createLot com duplicata deve lançar exception")
    void createLot_comDuplicata_deveLancarException() {
        when(reagentLotRepository.save(any(ReagentLot.class)))
            .thenThrow(new DataIntegrityViolationException("unique constraint"));

        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "L123", "Bio", "Bioquímica", LocalDate.now().plusDays(60), 100D,
            "frascos", 80D, 2D, "2-8C", LocalDate.now(), null, 7, "ativo",
            null, null, null, null
        );

        assertThatThrownBy(() -> reagentService.createLot(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Já existe um lote com este número e fabricante");
    }

    @Test
    @DisplayName("createLot com pre-check de duplicata nao deve chamar save")
    void createLot_comPreCheckDuplicata_naoDeveChamarSave() {
        // Pre-check: quando findByLotNumberAndManufacturer ja retorna um lote
        // existente, a BusinessException deve ser lancada antes de qualquer save,
        // evitando o SQL ERROR "duplicate key" no log do PostgreSQL.
        when(reagentLotRepository.findByLotNumberAndManufacturer("L123", "Bio"))
            .thenReturn(List.of(lot(50D)));

        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "L123", "Bio", "Bioquímica", LocalDate.now().plusDays(60), 100D,
            "frascos", 80D, 2D, "2-8C", LocalDate.now(), null, 7, "ativo",
            null, null, null, null
        );

        assertThatThrownBy(() -> reagentService.createLot(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Já existe um lote com este número e fabricante");
        verify(reagentLotRepository, never()).save(any(ReagentLot.class));
    }

    @Test
    @DisplayName("filtragem por category e status deve usar repository")
    void filtragemPorCategoryEStatus_deveUsarRepository() {
        ReagentLot lot = lot(100D);
        lot.setCategory("Bioquímica");
        lot.setExpiryDate(LocalDate.now().plusDays(30));
        when(reagentLotRepository.findByFilters(eq("Bioquímica"), eq("ativo"))).thenReturn(List.of(lot));

        var result = reagentService.getLots("Bioquímica", "ativo");

        assertThat(result).hasSize(1);
        verify(reagentLotRepository).findByFilters("Bioquímica", "ativo");
        verify(reagentLotRepository, never()).findAllByOrderByCreatedAtDesc();
    }

    @Test
    @DisplayName("deleteMovement ENTRADA com estoque insuficiente deve lançar exception")
    void deleteMovementEntrada_comEstoqueInsuficiente_deveLancarException() {
        // Lote começa com 50, ENTRADA +50 -> 100, SAIDA -80 -> 20
        // Tentar deletar a ENTRADA (reverter -50) resultaria em 20 - 50 = -30 -> deve bloquear
        ReagentLot lot = lot(20D);
        StockMovement entradaMovement = StockMovement.builder()
            .id(UUID.randomUUID())
            .reagentLot(lot)
            .type("ENTRADA")
            .quantity(50D)
            .responsible("Ana")
            .notes("")
            .build();
        when(stockMovementRepository.findById(entradaMovement.getId()))
            .thenReturn(Optional.of(entradaMovement));

        assertThatThrownBy(() -> reagentService.deleteMovement(entradaMovement.getId()))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Não é possível excluir esta entrada");
    }

    @Test
    @DisplayName("deleteMovement SAIDA deve restaurar estoque")
    void deleteMovementSaida_deveRestaurarEstoque() {
        // Lote com estoque 70 (após SAIDA de 30 de um original 100)
        // Deletar a SAIDA deve reverter: 70 + 30 = 100
        ReagentLot lot = lot(70D);
        StockMovement saidaMovement = StockMovement.builder()
            .id(UUID.randomUUID())
            .reagentLot(lot)
            .type("SAIDA")
            .quantity(30D)
            .responsible("Ana")
            .notes("")
            .build();
        when(stockMovementRepository.findById(saidaMovement.getId()))
            .thenReturn(Optional.of(saidaMovement));
        when(reagentLotRepository.save(any(ReagentLot.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        reagentService.deleteMovement(saidaMovement.getId());

        assertThat(lot.getCurrentStock()).isEqualTo(100D);
        verify(stockMovementRepository).delete(saidaMovement);
    }

    @Test
    @DisplayName("saída que iguala zero deve permitir")
    void saidaQueIgualaZero_devePermitir() {
        ReagentLot lot = lot(50D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(invocation -> invocation.getArgument(0));

        StockMovement movement = reagentService.createMovement(
            lot.getId(), new StockMovementRequest("SAIDA", 50D, "Ana", "", "VENCIMENTO"));

        assertThat(lot.getCurrentStock()).isEqualTo(0D);
        assertThat(movement.getQuantity()).isEqualTo(50D);
    }

    @Test
    @DisplayName("ajuste para zero deve permitir")
    void ajusteParaZero_devePermitir() {
        ReagentLot lot = lot(80D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(invocation -> invocation.getArgument(0));

        StockMovement movement = reagentService.createMovement(
            lot.getId(), new StockMovementRequest("AJUSTE", 0D, "Ana", "Zerando estoque", "CORRECAO"));

        assertThat(lot.getCurrentStock()).isEqualTo(0D);
        assertThat(movement.getNotes()).isEqualTo("Zerando estoque");
        assertThat(movement.getPreviousStock()).isEqualTo(80D);
    }

    @Test
    @DisplayName("updateLot com duplicata deve lançar exception")
    void updateLotComDuplicata_deveLancarException() {
        ReagentLot lot = lot(100D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class)))
            .thenThrow(new DataIntegrityViolationException("unique constraint"));

        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "L999", "OutroFab", "Bioquímica", LocalDate.now().plusDays(60), 100D,
            "frascos", 80D, 2D, "2-8C", LocalDate.now(), null, 7, "ativo",
            null, null, null, null
        );

        assertThatThrownBy(() -> reagentService.updateLot(lot.getId(), request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Já existe um lote com este número e fabricante");
    }

    // ===== Fase 2: contrato e rastreabilidade =====

    @Test
    @DisplayName("AJUSTE sem motivo deve falhar")
    void ajusteSemMotivo_deveFalhar() {
        ReagentLot lot = lot(50D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));

        assertThatThrownBy(() ->
            reagentService.createMovement(lot.getId(), new StockMovementRequest("AJUSTE", 30D, "Ana", "", null))
        )
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("AJUSTE exige um motivo");
    }

    @Test
    @DisplayName("AJUSTE com motivo invalido deve falhar")
    void ajusteMotivoInvalido_deveFalhar() {
        ReagentLot lot = lot(50D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));

        assertThatThrownBy(() ->
            reagentService.createMovement(lot.getId(), new StockMovementRequest("AJUSTE", 30D, "Ana", "", "FANTASIA"))
        )
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Motivo de movimentação inválido");
    }

    @Test
    @DisplayName("SAIDA que zera estoque sem motivo deve falhar")
    void saidaZerandoSemMotivo_deveFalhar() {
        ReagentLot lot = lot(40D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));

        assertThatThrownBy(() ->
            reagentService.createMovement(lot.getId(), new StockMovementRequest("SAIDA", 40D, "Ana", "", null))
        )
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Saída que zera o estoque exige um motivo");
    }

    @Test
    @DisplayName("ENTRADA grava previousStock do estoque anterior")
    void entradaGravaPreviousStock() {
        ReagentLot lot = lot(60D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        StockMovement movement = reagentService.createMovement(
            lot.getId(), new StockMovementRequest("ENTRADA", 10D, "Ana", "", null));

        assertThat(movement.getPreviousStock()).isEqualTo(60D);
        assertThat(lot.getCurrentStock()).isEqualTo(70D);
    }

    @Test
    @DisplayName("SAIDA grava previousStock do estoque anterior")
    void saidaGravaPreviousStock() {
        ReagentLot lot = lot(60D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        StockMovement movement = reagentService.createMovement(
            lot.getId(), new StockMovementRequest("SAIDA", 10D, "Ana", "", null));

        assertThat(movement.getPreviousStock()).isEqualTo(60D);
        assertThat(lot.getCurrentStock()).isEqualTo(50D);
    }

    @Test
    @DisplayName("createLot com status invalido deve falhar")
    void createLotStatusInvalido_deveFalhar() {
        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "L123", "Bio", "Bioquímica", LocalDate.now().plusDays(60), 100D,
            "frascos", 80D, 2D, "2-8C", LocalDate.now(), null, 7, "MAGICO",
            null, null, null, null
        );

        assertThatThrownBy(() -> reagentService.createLot(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Status de lote inválido");
    }

    @Test
    @DisplayName("createLot com expiryDate anterior a startDate deve falhar")
    void createLotDatasInvertidas_deveFalhar() {
        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "L123", "Bio", "Bioquímica",
            LocalDate.now().minusDays(5), // expiry no passado
            100D, "frascos", 80D, 2D, "2-8C",
            LocalDate.now(), // start hoje (depois do expiry)
            null, 7, "ativo",
            null, null, null, null
        );

        assertThatThrownBy(() -> reagentService.createLot(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("não pode ser anterior");
    }

    @Test
    @DisplayName("updateLot reverifica unicidade de (lotNumber, manufacturer) antes de salvar")
    void updateLotReverificaUnicidade_antesDoSave() {
        ReagentLot current = lot(100D);
        current.setManufacturer("Bio");
        ReagentLot otherConflicting = ReagentLot.builder()
            .id(UUID.randomUUID())
            .name("OUTRO")
            .lotNumber("LCOLIDE")
            .manufacturer("Bio")
            .currentStock(0D)
            .status("ativo")
            .build();
        when(reagentLotRepository.findById(current.getId())).thenReturn(Optional.of(current));
        when(reagentLotRepository.findByLotNumberAndManufacturer("LCOLIDE", "Bio"))
            .thenReturn(List.of(otherConflicting));

        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "LCOLIDE", "Bio", "Bioquímica", LocalDate.now().plusDays(60), 100D,
            "frascos", 80D, 2D, "2-8C", LocalDate.now(), null, 7, "ativo",
            null, null, null, null
        );

        assertThatThrownBy(() -> reagentService.updateLot(current.getId(), request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Já existe um lote com este número e fabricante");
        verify(reagentLotRepository, never()).save(any());
    }

    // ===== Fase 3: rastreabilidade forte =====

    @Test
    @DisplayName("createLot propaga location/supplier/receivedDate/openedDate para a entity")
    void createLotPropagaCamposRastreabilidade() {
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "L999", "Bio", "Bioquímica", LocalDate.now().plusDays(30), 100D,
            "frascos", 80D, 2D, "2-8C", LocalDate.now(), null, 7, "ativo",
            "Geladeira 2", "ForneceX", LocalDate.now().minusDays(5), LocalDate.now().minusDays(2)
        );

        ReagentLot lot = reagentService.createLot(request);

        assertThat(lot.getLocation()).isEqualTo("Geladeira 2");
        assertThat(lot.getSupplier()).isEqualTo("ForneceX");
        assertThat(lot.getReceivedDate()).isEqualTo(LocalDate.now().minusDays(5));
        assertThat(lot.getOpenedDate()).isEqualTo(LocalDate.now().minusDays(2));
    }

    @Test
    @DisplayName("getLots marca usedInQcRecently quando lotNumber aparece em CQ dos ultimos 30 dias")
    void getLotsMarcaUsedInQcRecently() {
        ReagentLot usedLot = lot(100D);
        usedLot.setLotNumber("L-ACTIVE");
        ReagentLot unusedLot = lot(100D);
        unusedLot.setLotNumber("L-INATIVO");
        when(reagentLotRepository.findByFilters(isNull(), isNull())).thenReturn(List.of(usedLot, unusedLot));
        when(qcRecordRepository.findActiveLotNumbersSince(any(), any()))
            .thenReturn(List.of("l-active"));

        var result = reagentService.getLots(null, null);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).usedInQcRecently()).isTrue();
        assertThat(result.get(1).usedInQcRecently()).isFalse();
    }

    @Test
    @DisplayName("getLots nao dispara query em CQ quando nao ha lotes com lotNumber")
    void getLotsSemLotNumbers_naoConsulta() {
        when(reagentLotRepository.findByFilters(isNull(), isNull())).thenReturn(List.of());

        var result = reagentService.getLots(null, null);

        assertThat(result).isEmpty();
        verify(qcRecordRepository, never()).findActiveLotNumbersSince(any(), any());
    }

    @Test
    @DisplayName("getLots tolera retorno vazio do repo de CQ sem quebrar")
    void getLotsToleraCqVazio() {
        ReagentLot l = lot(100D);
        when(reagentLotRepository.findByFilters(isNull(), isNull())).thenReturn(List.of(l));
        when(qcRecordRepository.findActiveLotNumbersSince(any(), any()))
            .thenReturn(Collections.emptyList());

        var result = reagentService.getLots(null, null);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().usedInQcRecently()).isFalse();
    }

    @Test
    @DisplayName("P0-1: lotNumber em colisao (fabricantes diferentes) NAO marca usedInQcRecently")
    void usedInQcRecentlyConservadorQuandoColide() {
        // Mesmo lotNumber "L-DUO" em dois lotes com fabricantes distintos.
        ReagentLot a = lot(100D);
        a.setLotNumber("L-DUO");
        a.setManufacturer("FabA");
        ReagentLot b = lot(100D);
        b.setLotNumber("L-DUO");
        b.setManufacturer("FabB");
        when(reagentLotRepository.findByFilters(isNull(), isNull())).thenReturn(List.of(a, b));
        when(qcRecordRepository.findActiveLotNumbersSince(any(), any()))
            .thenReturn(List.of("l-duo"));

        var result = reagentService.getLots(null, null);

        // Conservador: ambos ficam false para nao gerar falso positivo
        assertThat(result).hasSize(2);
        assertThat(result.get(0).usedInQcRecently()).isFalse();
        assertThat(result.get(1).usedInQcRecently()).isFalse();
    }

    // ===== Derivacao automatica de status (vencido vs inativo) =====

    @Test
    @DisplayName("SAIDA que zera estoque em lote vencido com validade passada deve virar inativo")
    void saidaZerandoEstoque_emLoteVencido_deveTornarInativo() {
        ReagentLot lot = lot(10D);
        lot.setStatus("vencido");
        lot.setExpiryDate(LocalDate.now().minusDays(5));
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        reagentService.createMovement(
            lot.getId(), new StockMovementRequest("SAIDA", 10D, "Ana", "", "VENCIMENTO"));

        assertThat(lot.getCurrentStock()).isEqualTo(0D);
        assertThat(lot.getStatus()).isEqualTo("inativo");
    }

    @Test
    @DisplayName("ENTRADA em lote inativo deve lancar BusinessException")
    void entradaEmLoteInativo_deveLancarException() {
        ReagentLot lot = lot(0D);
        lot.setStatus("inativo");
        lot.setExpiryDate(LocalDate.now().minusDays(30));
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));

        assertThatThrownBy(() ->
            reagentService.createMovement(
                lot.getId(), new StockMovementRequest("ENTRADA", 10D, "Ana", "", null))
        )
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Lote inativo não aceita nova entrada");
        verify(reagentLotRepository, never()).save(any());
    }

    @Test
    @DisplayName("AJUSTE em lote inativo que resulta em estoque > 0 com validade passada deve virar vencido")
    void ajusteEmLoteInativo_queElevaEstoque_deveVirarVencido() {
        ReagentLot lot = lot(0D);
        lot.setStatus("inativo");
        lot.setExpiryDate(LocalDate.now().minusDays(30));
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        reagentService.createMovement(
            lot.getId(), new StockMovementRequest("AJUSTE", 5D, "Ana", "Recontagem fisica", "CORRECAO"));

        assertThat(lot.getCurrentStock()).isEqualTo(5D);
        assertThat(lot.getStatus()).isEqualTo("vencido");
    }

    @Test
    @DisplayName("createLot com expiryDate passada e estoque 0 deve entrar como inativo")
    void createLot_comValidadePassadaEEstoqueZero_deveEntrarComoInativo() {
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "L-PAST-0", "Bio", "Bioquímica",
            LocalDate.now().minusDays(5), 100D, "frascos", 0D, 2D, "2-8C",
            null, null, 7, "ativo",
            null, null, null, null
        );

        ReagentLot lot = reagentService.createLot(request);

        assertThat(lot.getStatus()).isEqualTo("inativo");
    }

    @Test
    @DisplayName("createLot com expiryDate passada e estoque > 0 deve entrar como vencido")
    void createLot_comValidadePassadaEEstoquePositivo_deveEntrarComoVencido() {
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "L-PAST-1", "Bio", "Bioquímica",
            LocalDate.now().minusDays(5), 100D, "frascos", 10D, 2D, "2-8C",
            null, null, 7, "ativo",
            null, null, null, null
        );

        ReagentLot lot = reagentService.createLot(request);

        assertThat(lot.getStatus()).isEqualTo("vencido");
    }

    @Test
    @DisplayName("updateLot editando expiryDate para passada em lote com estoque > 0 deve virar vencido")
    void updateLot_setValidadeParaPassada_comEstoque_deveVirarVencido() {
        ReagentLot lot = lot(25D);
        lot.setStatus("ativo");
        lot.setExpiryDate(LocalDate.now().plusDays(30));
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));

        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "L123", "Bio", "Bioquímica",
            LocalDate.now().minusDays(1), // expiry passa para ontem
            100D, "frascos", 25D, 2D, "2-8C",
            null, null, 7, "ativo",
            null, null, null, null
        );

        ReagentLot updated = reagentService.updateLot(lot.getId(), request);

        assertThat(updated.getStatus()).isEqualTo("vencido");
    }

    @Test
    @DisplayName("updateLot em lote quarentena com validade passada deve permanecer quarentena")
    void updateLot_loteQuarentena_comValidadePassada_devePermanecerQuarentena() {
        ReagentLot lot = lot(10D);
        lot.setStatus("quarentena");
        lot.setExpiryDate(LocalDate.now().plusDays(30));
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));

        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "L123", "Bio", "Bioquímica",
            LocalDate.now().minusDays(10), // validade agora passada
            100D, "frascos", 10D, 2D, "2-8C",
            null, null, 7, "quarentena", // admin mantem quarentena explicitamente
            null, null, null, null
        );

        ReagentLot updated = reagentService.updateLot(lot.getId(), request);

        assertThat(updated.getStatus()).isEqualTo("quarentena");
    }

    @Test
    @DisplayName("SAIDA que zera estoque em lote quarentena com validade passada deve permanecer quarentena")
    void saidaZerando_emLoteQuarentena_comValidadePassada_devePermanecerQuarentena() {
        ReagentLot lot = lot(10D);
        lot.setStatus("quarentena");
        lot.setExpiryDate(LocalDate.now().minusDays(2));
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        reagentService.createMovement(
            lot.getId(), new StockMovementRequest("SAIDA", 10D, "Ana", "", "VENCIMENTO"));

        assertThat(lot.getCurrentStock()).isEqualTo(0D);
        assertThat(lot.getStatus()).isEqualTo("quarentena");
    }

    // ===== Auditoria de transicoes automaticas (ANVISA RDC 302 / ISO 15189) =====

    @Test
    @DisplayName("createLot com validade passada e estoque 0 registra audit log trigger=createLot")
    void createLot_validadePassadaEstoqueZero_gravaAuditLog() {
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "L-AUDIT-0", "Bio", "Bioquímica",
            LocalDate.now().minusDays(5), 100D, "frascos", 0D, 2D, "2-8C",
            null, null, 7, "ativo",
            null, null, null, null
        );

        ReagentLot lot = reagentService.createLot(request);

        assertThat(lot.getStatus()).isEqualTo("inativo");
        List<RecordingAuditService.Call> derived = auditService.callsFor(
            ReagentService.AUDIT_ACTION_STATUS_DERIVED);
        assertThat(derived).hasSize(1);
        RecordingAuditService.Call call = derived.getFirst();
        assertThat(call.entityType()).isEqualTo("ReagentLot");
        assertThat(call.details())
            .containsEntry("trigger", ReagentService.AUDIT_TRIGGER_CREATE_LOT)
            .containsEntry("to", "inativo")
            // from vem do default do builder (ativo) porque resolveStatus aplicou antes de derivar.
            .containsEntry("from", "ativo");
    }

    @Test
    @DisplayName("updateLot mudando expiryDate para passada registra audit log trigger=updateLot")
    void updateLot_mudandoExpiry_gravaAuditLog() {
        ReagentLot lot = lot(25D);
        lot.setStatus("ativo");
        lot.setExpiryDate(LocalDate.now().plusDays(30));
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));

        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "L123", "Bio", "Bioquímica",
            LocalDate.now().minusDays(1), 100D, "frascos", 25D, 2D, "2-8C",
            null, null, 7, "ativo",
            null, null, null, null
        );

        reagentService.updateLot(lot.getId(), request);

        List<RecordingAuditService.Call> derived = auditService.callsFor(
            ReagentService.AUDIT_ACTION_STATUS_DERIVED);
        assertThat(derived).hasSize(1);
        RecordingAuditService.Call call = derived.getFirst();
        assertThat(call.entityId()).isEqualTo(lot.getId());
        assertThat(call.details())
            .containsEntry("trigger", ReagentService.AUDIT_TRIGGER_UPDATE_LOT)
            .containsEntry("from", "ativo")
            .containsEntry("to", "vencido");
    }

    @Test
    @DisplayName("SAIDA que zera estoque em lote vencido registra audit log trigger=movement")
    void createMovement_saidaZerandoVencido_gravaAuditLog() {
        ReagentLot lot = lot(10D);
        lot.setStatus("vencido");
        lot.setExpiryDate(LocalDate.now().minusDays(5));
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        reagentService.createMovement(
            lot.getId(), new StockMovementRequest("SAIDA", 10D, "Ana", "", "VENCIMENTO"));

        List<RecordingAuditService.Call> derived = auditService.callsFor(
            ReagentService.AUDIT_ACTION_STATUS_DERIVED);
        assertThat(derived).hasSize(1);
        RecordingAuditService.Call call = derived.getFirst();
        assertThat(call.entityId()).isEqualTo(lot.getId());
        assertThat(call.details())
            .containsEntry("trigger", ReagentService.AUDIT_TRIGGER_MOVEMENT)
            .containsEntry("from", "vencido")
            .containsEntry("to", "inativo");
    }

    @Test
    @DisplayName("ENTRADA em lote inativo registra audit log REAGENT_MOVEMENT_BLOCKED")
    void createMovement_entradaEmInativo_gravaAuditBlocked() {
        ReagentLot lot = lot(0D);
        lot.setStatus("inativo");
        lot.setExpiryDate(LocalDate.now().minusDays(30));
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));

        assertThatThrownBy(() ->
            reagentService.createMovement(
                lot.getId(), new StockMovementRequest("ENTRADA", 10D, "Ana", "", null))
        )
            .isInstanceOf(BusinessException.class);

        List<RecordingAuditService.Call> blocked = auditService.callsFor(
            ReagentService.AUDIT_ACTION_MOVEMENT_BLOCKED);
        assertThat(blocked).hasSize(1);
        RecordingAuditService.Call call = blocked.getFirst();
        assertThat(call.entityId()).isEqualTo(lot.getId());
        assertThat(call.details())
            .containsEntry("reason", "lote_inativo")
            .containsEntry("movementType", "ENTRADA");
        // Nenhum log de REAGENT_STATUS_DERIVED neste fluxo — nao ha transicao.
        assertThat(auditService.callsFor(ReagentService.AUDIT_ACTION_STATUS_DERIVED)).isEmpty();
    }

    @Test
    @DisplayName("Lote quarentena com validade passada nao gera audit log (preservacao)")
    void updateLot_quarentena_comValidadePassada_naoGeraAuditLog() {
        ReagentLot lot = lot(10D);
        lot.setStatus("quarentena");
        lot.setExpiryDate(LocalDate.now().plusDays(30));
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));

        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "L123", "Bio", "Bioquímica",
            LocalDate.now().minusDays(10), 100D, "frascos", 10D, 2D, "2-8C",
            null, null, 7, "quarentena",
            null, null, null, null
        );

        reagentService.updateLot(lot.getId(), request);

        // Quarentena e preservacao manual — nao deve haver chamada de audit para
        // REAGENT_STATUS_DERIVED porque nao houve transicao.
        assertThat(auditService.callsFor(ReagentService.AUDIT_ACTION_STATUS_DERIVED)).isEmpty();
    }

    @Test
    @DisplayName("No-op (derivado = atual) nao gera audit log")
    void updateLot_semTransicao_naoGeraAuditLog() {
        ReagentLot lot = lot(50D);
        lot.setStatus("ativo");
        lot.setExpiryDate(LocalDate.now().plusDays(60));
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));

        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "L123", "Bio", "Bioquímica",
            LocalDate.now().plusDays(90), // validade ainda futura
            100D, "frascos", 50D, 2D, "2-8C",
            null, null, 7, "ativo",
            null, null, null, null
        );

        reagentService.updateLot(lot.getId(), request);

        assertThat(auditService.callsFor(ReagentService.AUDIT_ACTION_STATUS_DERIVED)).isEmpty();
    }

    private ReagentLot lot(double stock) {
        return ReagentLot.builder()
            .id(UUID.randomUUID())
            .name("ALT")
            .lotNumber("L123")
            .quantityValue(100D)
            .currentStock(stock)
            .estimatedConsumption(2D)
            .stockUnit("frascos")
            .status("ativo")
            .build();
    }
}

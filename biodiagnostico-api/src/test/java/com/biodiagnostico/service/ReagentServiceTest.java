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
import com.biodiagnostico.repository.ReagentLotRepository;
import com.biodiagnostico.repository.StockMovementRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

@ExtendWith(MockitoExtension.class)
class ReagentServiceTest {

    @InjectMocks
    private ReagentService reagentService;

    @Mock
    private ReagentLotRepository reagentLotRepository;

    @Mock
    private StockMovementRepository stockMovementRepository;

    @Test
    @DisplayName("deve criar lote com sucesso")
    void shouldCreateLotSuccessfully() {
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(invocation -> invocation.getArgument(0));
        ReagentLotRequest request = new ReagentLotRequest(
            "ALT", "L123", "Bio", "Bioquímica", LocalDate.now().plusDays(60), 100D,
            "frascos", 80D, 2D, "2-8C", LocalDate.now(), null, 7, "ativo"
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

        reagentService.createMovement(lot.getId(), new StockMovementRequest("ENTRADA", 20D, "Ana", ""));

        assertThat(lot.getCurrentStock()).isEqualTo(120D);
    }

    @Test
    @DisplayName("deve diminuir estoque em movimentação de saída")
    void shouldDecreaseCurrentStockOnSaidaMovement() {
        ReagentLot lot = lot(100D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(invocation -> invocation.getArgument(0));

        reagentService.createMovement(lot.getId(), new StockMovementRequest("SAIDA", 15D, "Ana", ""));

        assertThat(lot.getCurrentStock()).isEqualTo(85D);
    }

    @Test
    @DisplayName("deve definir estoque em movimentação de ajuste")
    void shouldSetStockOnAjusteMovement() {
        ReagentLot lot = lot(100D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(invocation -> invocation.getArgument(0));

        reagentService.createMovement(lot.getId(), new StockMovementRequest("AJUSTE", 55D, "Ana", ""));

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
            reagentService.createMovement(lot.getId(), new StockMovementRequest("SAIDA", 20D, "Ana", ""))
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
            "frascos", 80D, 2D, "2-8C", LocalDate.now(), null, 7, "ativo"
        );

        assertThatThrownBy(() -> reagentService.createLot(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Já existe um lote com este número e fabricante");
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
            lot.getId(), new StockMovementRequest("SAIDA", 50D, "Ana", ""));

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
            lot.getId(), new StockMovementRequest("AJUSTE", 0D, "Ana", "Zerando estoque"));

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
            "frascos", 80D, 2D, "2-8C", LocalDate.now(), null, 7, "ativo"
        );

        assertThatThrownBy(() -> reagentService.updateLot(lot.getId(), request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Já existe um lote com este número e fabricante");
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

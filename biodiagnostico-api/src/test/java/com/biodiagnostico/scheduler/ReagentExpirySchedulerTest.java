package com.biodiagnostico.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.entity.ReagentStatus;
import com.biodiagnostico.repository.QcRecordRepository;
import com.biodiagnostico.repository.ReagentLotRepository;
import com.biodiagnostico.repository.StockMovementRepository;
import com.biodiagnostico.service.AuditService;
import com.biodiagnostico.service.ReagentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Testa {@link ReagentExpiryScheduler#markExpiredLots()} apos refator-v2.
 *
 * <p>Usa um {@link ReagentService} real (nao mock) para exercitar
 * {@code deriveStatus} e {@code applyDerivedStatusFromScheduler} de ponta a ponta.</p>
 */
@ExtendWith(MockitoExtension.class)
class ReagentExpirySchedulerTest {

    @Mock
    private ReagentLotRepository reagentLotRepository;

    @Mock
    private StockMovementRepository stockMovementRepository;

    @Mock
    private QcRecordRepository qcRecordRepository;

    private RecordingAuditService auditService;
    private ReagentService reagentService;
    private ReagentExpiryScheduler scheduler;

    @BeforeEach
    void setUp() {
        auditService = new RecordingAuditService();
        reagentService = new ReagentService(
            reagentLotRepository, stockMovementRepository, qcRecordRepository, auditService);
        scheduler = new ReagentExpiryScheduler(reagentLotRepository, reagentService);
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
    @DisplayName("lote em_estoque + validade passada + estoque > 0 vira vencido")
    void emEstoque_comValidadePassadaEEstoque_deveVirarVencido() {
        ReagentLot lot = lotBuilder(ReagentStatus.EM_ESTOQUE, LocalDate.now().minusDays(3), 15D);
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of(lot));

        scheduler.markExpiredLots();

        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.VENCIDO);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ReagentLot>> captor = ArgumentCaptor.forClass(List.class);
        verify(reagentLotRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).containsExactly(lot);
    }

    @Test
    @DisplayName("lote em_estoque + validade passada + estoque 0 vira vencido (refator-v2: vencido absorve antigo inativo)")
    void emEstoque_comValidadePassadaSemEstoque_deveVirarVencido() {
        ReagentLot lot = lotBuilder(ReagentStatus.EM_ESTOQUE, LocalDate.now().minusDays(3), 0D);
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of(lot));

        scheduler.markExpiredLots();

        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.VENCIDO);
        verify(reagentLotRepository).saveAll(List.of(lot));
    }

    @Test
    @DisplayName("lote fora_de_estoque com validade passada vira vencido (validade e regra mais forte)")
    void foraDeEstoque_comValidadePassada_viraVencido() {
        ReagentLot lot = lotBuilder(ReagentStatus.FORA_DE_ESTOQUE, LocalDate.now().minusDays(10), 0D);
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of(lot));

        scheduler.markExpiredLots();

        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.VENCIDO);
        verify(reagentLotRepository).saveAll(List.of(lot));
    }

    @Test
    @DisplayName("lote em_estoque com validade futura nao deve ser tocado (filtrado pelo repository)")
    void emEstoqueComValidadeFutura_naoDeveSerTocado() {
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of());

        scheduler.markExpiredLots();

        verify(reagentLotRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("candidatos vazios nao geram saveAll")
    void semCandidatos_naoChamaSaveAll() {
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of());

        scheduler.markExpiredLots();

        verify(reagentLotRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("scheduler grava audit log REAGENT_STATUS_DERIVED trigger=scheduler para cada reclassificacao")
    void scheduler_gravaAuditLogPorLoteReclassificado() {
        ReagentLot emEstoqueComEstoque = lotBuilder(ReagentStatus.EM_ESTOQUE, LocalDate.now().minusDays(2), 10D);
        ReagentLot emEstoqueSemEstoque = lotBuilder(ReagentStatus.EM_ESTOQUE, LocalDate.now().minusDays(2), 0D);
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of(emEstoqueComEstoque, emEstoqueSemEstoque));

        scheduler.markExpiredLots();

        List<RecordingAuditService.Call> derived = auditService.callsFor(
            ReagentService.AUDIT_ACTION_STATUS_DERIVED);
        assertThat(derived).hasSize(2);
        assertThat(derived).extracting(RecordingAuditService.Call::entityId)
            .containsExactly(emEstoqueComEstoque.getId(), emEstoqueSemEstoque.getId());
        assertThat(derived).allSatisfy(call -> {
            assertThat(call.entityType()).isEqualTo("ReagentLot");
            assertThat(call.details())
                .containsEntry("trigger", ReagentService.AUDIT_TRIGGER_SCHEDULER)
                .containsEntry("from", ReagentStatus.EM_ESTOQUE);
        });
        // Refator-v2: ambos viram VENCIDO porque expiry < today (regra mais forte).
        assertThat(derived.get(0).details()).containsEntry("to", ReagentStatus.VENCIDO);
        assertThat(derived.get(1).details()).containsEntry("to", ReagentStatus.VENCIDO);
    }

    @Test
    @DisplayName("scheduler nao grava audit quando nao ha transicao")
    void scheduler_semTransicao_naoGeraAudit() {
        ReagentLot lot = lotBuilder(ReagentStatus.VENCIDO, LocalDate.now().minusDays(3), 20D);
        // Mesmo que o repository devolva o lote por defesa, applyDerivedStatusFromScheduler
        // ve status=vencido + expiry passada = derivado=vencido = no-op.
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of(lot));

        scheduler.markExpiredLots();

        assertThat(auditService.callsFor(ReagentService.AUDIT_ACTION_STATUS_DERIVED)).isEmpty();
    }

    @Test
    @DisplayName("lote vencido ja correto nao gera save")
    void vencidoComEstoque_jaEstaCorreto_naoDeveSalvarNovamente() {
        ReagentLot lot = lotBuilder(ReagentStatus.VENCIDO, LocalDate.now().minusDays(3), 20D);
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of(lot));

        scheduler.markExpiredLots();

        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.VENCIDO);
        verify(reagentLotRepository, never()).saveAll(any());
    }

    private ReagentLot lotBuilder(String status, LocalDate expiryDate, double stock) {
        return ReagentLot.builder()
            .id(UUID.randomUUID())
            .name("ALT")
            .lotNumber("L-" + UUID.randomUUID())
            .manufacturer("Bio")
            .currentStock(stock)
            .status(status)
            .expiryDate(expiryDate)
            .build();
    }
}

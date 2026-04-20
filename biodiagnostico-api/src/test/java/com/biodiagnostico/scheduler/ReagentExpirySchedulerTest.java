package com.biodiagnostico.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.biodiagnostico.entity.ReagentLot;
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
 * Testa {@link ReagentExpiryScheduler#markExpiredLots()} cobrindo a regra de
 * derivacao de status: vencido (tem estoque) vs inativo (zerou) vs quarentena
 * (preserva estado manual).
 *
 * Observacao sobre design: usamos um {@link ReagentService} real (nao mock) para
 * exercitar {@code deriveStatus} de ponta a ponta. Os repositorios de dependencia
 * sao mockados, pois o que importa aqui e o comportamento do scheduler e da regra
 * de derivacao combinados.
 */
@ExtendWith(MockitoExtension.class)
class ReagentExpirySchedulerTest {

    @Mock
    private ReagentLotRepository reagentLotRepository;

    @Mock
    private StockMovementRepository stockMovementRepository;

    @Mock
    private QcRecordRepository qcRecordRepository;

    /**
     * Fake de AuditService que grava chamadas. Mesma motivacao do
     * RecordingAuditService em ReagentServiceTest: o mock-maker inline do
     * Mockito nao consegue instrumentar AuditService em Java 25.
     */
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
    @DisplayName("lote ativo + validade passada + estoque > 0 vira vencido")
    void ativoComValidadePassadaEEstoque_deveVirarVencido() {
        ReagentLot lot = lotBuilder("ativo", LocalDate.now().minusDays(3), 15D);
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of(lot));

        scheduler.markExpiredLots();

        assertThat(lot.getStatus()).isEqualTo("vencido");
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ReagentLot>> captor = ArgumentCaptor.forClass(List.class);
        verify(reagentLotRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).containsExactly(lot);
    }

    @Test
    @DisplayName("lote ativo + validade passada + estoque 0 vira inativo")
    void ativoComValidadePassadaSemEstoque_deveVirarInativo() {
        ReagentLot lot = lotBuilder("ativo", LocalDate.now().minusDays(3), 0D);
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of(lot));

        scheduler.markExpiredLots();

        assertThat(lot.getStatus()).isEqualTo("inativo");
        verify(reagentLotRepository).saveAll(List.of(lot));
    }

    @Test
    @DisplayName("lote vencido + estoque 0 deve migrar para inativo")
    void vencidoSemEstoque_deveMigrarParaInativo() {
        ReagentLot lot = lotBuilder("vencido", LocalDate.now().minusDays(10), 0D);
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of(lot));

        scheduler.markExpiredLots();

        assertThat(lot.getStatus()).isEqualTo("inativo");
        verify(reagentLotRepository).saveAll(List.of(lot));
    }

    @Test
    @DisplayName("lote quarentena + validade passada deve permanecer quarentena (nao volta do repo)")
    void quarentenaComValidadePassada_deveSerFiltrada() {
        // A query ja filtra quarentena, entao o scheduler nem ve o lote.
        // Simulamos: findExpiredNeedingReclassification retorna vazio quando so ha quarentena.
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of());

        scheduler.markExpiredLots();

        verify(reagentLotRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("lote quarentena passado pelo resolver (defesa em profundidade) preserva quarentena")
    void quarentenaPassadaPeloResolver_preservaQuarentena() {
        // Cenario teorico: mesmo se algum lote 'quarentena' chegar ao loop (ex: race
        // com UPDATE concorrente), o resolver preserva o valor. Este teste prova a
        // defesa em profundidade mesmo que a query ja filtre.
        ReagentLot lot = lotBuilder("quarentena", LocalDate.now().minusDays(2), 0D);
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of(lot));

        scheduler.markExpiredLots();

        assertThat(lot.getStatus()).isEqualTo("quarentena");
        // Nenhuma alteracao foi feita → saveAll nao e chamado.
        verify(reagentLotRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("lote inativo com validade passada deve permanecer inativo (idempotencia)")
    void inativoComValidadePassada_devePermanecerInativo() {
        // A query ja filtra 'inativo'. O scheduler nao recebe o lote.
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of());

        scheduler.markExpiredLots();

        verify(reagentLotRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("lote ativo com validade futura nao deve ser tocado")
    void ativoComValidadeFutura_naoDeveSerTocado() {
        // A query filtra por expiryDate < today, entao lotes com validade futura nao aparecem.
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of());

        scheduler.markExpiredLots();

        verify(reagentLotRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("candidatos vazios nao geram chamada a saveAll")
    void semCandidatos_naoChamaSaveAll() {
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of());

        scheduler.markExpiredLots();

        verify(reagentLotRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("scheduler grava audit log REAGENT_STATUS_DERIVED trigger=scheduler para cada reclassificacao")
    void scheduler_gravaAuditLogPorLoteReclassificado() {
        ReagentLot ativoComEstoque = lotBuilder("ativo", LocalDate.now().minusDays(2), 10D);
        ReagentLot ativoSemEstoque = lotBuilder("ativo", LocalDate.now().minusDays(2), 0D);
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of(ativoComEstoque, ativoSemEstoque));

        scheduler.markExpiredLots();

        List<RecordingAuditService.Call> derived = auditService.callsFor(
            ReagentService.AUDIT_ACTION_STATUS_DERIVED);
        assertThat(derived).hasSize(2);
        assertThat(derived).extracting(RecordingAuditService.Call::entityId)
            .containsExactly(ativoComEstoque.getId(), ativoSemEstoque.getId());
        assertThat(derived).allSatisfy(call -> {
            assertThat(call.entityType()).isEqualTo("ReagentLot");
            assertThat(call.details())
                .containsEntry("trigger", ReagentService.AUDIT_TRIGGER_SCHEDULER)
                .containsEntry("from", "ativo");
        });
        assertThat(derived.get(0).details()).containsEntry("to", "vencido");
        assertThat(derived.get(1).details()).containsEntry("to", "inativo");
    }

    @Test
    @DisplayName("scheduler nao grava audit log quando nao ha transicao efetiva")
    void scheduler_semTransicao_naoGeraAuditLog() {
        ReagentLot lot = lotBuilder("vencido", LocalDate.now().minusDays(3), 20D);
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of(lot));

        scheduler.markExpiredLots();

        assertThat(auditService.callsFor(ReagentService.AUDIT_ACTION_STATUS_DERIVED)).isEmpty();
    }

    @Test
    @DisplayName("scheduler nao grava audit log para lote em quarentena (defesa em profundidade)")
    void scheduler_quarentena_naoGeraAuditLog() {
        ReagentLot lot = lotBuilder("quarentena", LocalDate.now().minusDays(2), 0D);
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of(lot));

        scheduler.markExpiredLots();

        assertThat(auditService.callsFor(ReagentService.AUDIT_ACTION_STATUS_DERIVED)).isEmpty();
    }

    @Test
    @DisplayName("lote vencido ja correto (tem estoque) nao gera save")
    void vencidoComEstoque_jaEstaCorreto_naoDeveSalvarNovamente() {
        // Se a query por seguranca trouxer o lote mas o status ja for o derivado,
        // o scheduler nao deve emitir UPDATE desnecessario.
        ReagentLot lot = lotBuilder("vencido", LocalDate.now().minusDays(3), 20D);
        when(reagentLotRepository.findExpiredNeedingReclassification(any()))
            .thenReturn(List.of(lot));

        scheduler.markExpiredLots();

        assertThat(lot.getStatus()).isEqualTo("vencido");
        verify(reagentLotRepository, never()).saveAll(any());
    }

    private ReagentLot lotBuilder(String status, LocalDate expiryDate, double stock) {
        return ReagentLot.builder()
            .id(UUID.randomUUID())
            .name("ALT")
            .lotNumber("L-" + UUID.randomUUID())
            .quantityValue(100D)
            .currentStock(stock)
            .estimatedConsumption(2D)
            .stockUnit("frascos")
            .status(status)
            .expiryDate(expiryDate)
            .build();
    }
}

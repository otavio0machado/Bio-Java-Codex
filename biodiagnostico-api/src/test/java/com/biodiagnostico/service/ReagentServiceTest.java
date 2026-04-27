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
import com.biodiagnostico.entity.ReagentStatus;
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

/**
 * Bateria do refator-reagentes-v2 (PR-1). Cobre:
 *  - Regra ternaria de {@code deriveStatus}
 *  - Forcing rule de cadastro vencido
 *  - Backfill administrativo de {@code openedDate} em UPDATE com action distinta
 *  - Bloqueio de ENTRADA em {@code vencido} (decisao 1.8)
 *  - ENTRADA em {@code fora_de_estoque} retornando a {@code em_uso} (decisao 5.6)
 *  - Auditoria com triggers {@code createLot/updateLot/movement}
 */
@ExtendWith(MockitoExtension.class)
class ReagentServiceTest {

    private ReagentService reagentService;

    @Mock
    private ReagentLotRepository reagentLotRepository;

    @Mock
    private StockMovementRepository stockMovementRepository;

    @Mock
    private QcRecordRepository qcRecordRepository;

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

    // ===== Helpers =====

    private ReagentLotRequest defaultRequest(String status) {
        return new ReagentLotRequest(
            "ALT", "L123", "Bio", "Bioquímica",
            80D, status,
            LocalDate.now().plusDays(60), "Geladeira 2", "2-8°C",
            null, null, null
        );
    }

    private ReagentLotRequest fullRequest(
        String label, String lotNumber, String manufacturer, String category,
        Double currentStock, String status, LocalDate expiry,
        String location, String temp,
        String supplier, LocalDate received, LocalDate opened
    ) {
        return new ReagentLotRequest(
            label, lotNumber, manufacturer, category,
            currentStock, status, expiry, location, temp,
            supplier, received, opened
        );
    }

    private ReagentLot lot(double stock) {
        return ReagentLot.builder()
            .id(UUID.randomUUID())
            .name("ALT")
            .lotNumber("L123")
            .manufacturer("Bio")
            .currentStock(stock)
            .expiryDate(LocalDate.now().plusDays(60))
            .status(ReagentStatus.EM_ESTOQUE)
            .build();
    }

    // ===== createLot =====

    @Test
    @DisplayName("createLot cria com sucesso quando dados validos")
    void shouldCreateLotSuccessfully() {
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));

        ReagentLot lot = reagentService.createLot(defaultRequest("em_estoque"));

        assertThat(lot.getName()).isEqualTo("ALT");
        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.EM_ESTOQUE);
    }

    @Test
    @DisplayName("createLot com expiryDate < hoje forca status=vencido (audit ressalva 3.5)")
    void createLot_expiryPassada_forcaVencido() {
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));

        ReagentLotRequest req = fullRequest(
            "ALT", "L-VENC", "Bio", "Bioquímica",
            10D, "em_estoque",
            LocalDate.now().minusDays(5),
            "Geladeira 2", "2-8°C",
            null, null, null
        );

        ReagentLot lot = reagentService.createLot(req);

        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.VENCIDO);
        // Audit: from='em_estoque' (status do builder antes da forcing rule), to='vencido'.
        List<RecordingAuditService.Call> derived = auditService.callsFor(
            ReagentService.AUDIT_ACTION_STATUS_DERIVED);
        // Forcing rule ja setou para vencido; applyDerivedStatus e no-op (em_estoque -> vencido
        // apenas via forcing); audit emite 1 entry com from='em_estoque' to='vencido' apenas
        // se o status reverter via deriveStatus. No nosso fluxo: forcing seta vencido e
        // applyDerivedStatus chega com status=vencido + expiry passada -> derivado=vencido =
        // no-op, sem audit. Verificamos que NAO tem audit nesse caso especifico.
        assertThat(derived).isEmpty();
    }

    @Test
    @DisplayName("createLot com status=em_uso e openedDate=null grava openedDate=hoje")
    void createLot_emUso_semOpenedDate_setaToday() {
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));

        ReagentLotRequest req = fullRequest(
            "ALT", "L-USO", "Bio", "Bioquímica",
            5D, "em_uso",
            LocalDate.now().plusDays(30),
            "Geladeira 2", "2-8°C",
            null, null, null
        );

        ReagentLot lot = reagentService.createLot(req);

        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.EM_USO);
        assertThat(lot.getOpenedDate()).isEqualTo(LocalDate.now());
    }

    @Test
    @DisplayName("createLot com (lotNumber, manufacturer) ja existente deve falhar")
    void createLot_comDuplicata_deveLancarException() {
        when(reagentLotRepository.save(any(ReagentLot.class)))
            .thenThrow(new DataIntegrityViolationException("unique constraint"));

        assertThatThrownBy(() -> reagentService.createLot(defaultRequest("em_estoque")))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Já existe um lote com este número e fabricante");
    }

    @Test
    @DisplayName("createLot com pre-check de duplicata nao chama save")
    void createLot_comPreCheckDuplicata_naoChamaSave() {
        when(reagentLotRepository.findByLotNumberAndManufacturer("L123", "Bio"))
            .thenReturn(List.of(lot(5D)));

        assertThatThrownBy(() -> reagentService.createLot(defaultRequest("em_estoque")))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Já existe um lote com este número e fabricante");
        verify(reagentLotRepository, never()).save(any(ReagentLot.class));
    }

    @Test
    @DisplayName("createLot com status legado deve ser rejeitado")
    void createLot_statusLegado_deveFalhar() {
        ReagentLotRequest req = defaultRequest("ativo"); // legado
        assertThatThrownBy(() -> reagentService.createLot(req))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Status de lote inválido");
    }

    @Test
    @DisplayName("createLot com category fora de lista deve falhar")
    void createLot_categoryInvalida_deveFalhar() {
        ReagentLotRequest req = fullRequest(
            "ALT", "L123", "Bio", "INEXISTENTE",
            80D, "em_estoque",
            LocalDate.now().plusDays(30),
            "Geladeira 2", "2-8°C",
            null, null, null
        );
        assertThatThrownBy(() -> reagentService.createLot(req))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Categoria invalida");
    }

    @Test
    @DisplayName("createLot com storageTemp fora de lista deve falhar")
    void createLot_tempInvalida_deveFalhar() {
        ReagentLotRequest req = fullRequest(
            "ALT", "L123", "Bio", "Bioquímica",
            80D, "em_estoque",
            LocalDate.now().plusDays(30),
            "Geladeira 2", "QUENTE",
            null, null, null
        );
        assertThatThrownBy(() -> reagentService.createLot(req))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Temperatura de armazenamento invalida");
    }

    @Test
    @DisplayName("createLot com receivedDate posterior a expiryDate deve falhar")
    void createLot_receivedAposExpiry_deveFalhar() {
        ReagentLotRequest req = fullRequest(
            "ALT", "L123", "Bio", "Bioquímica",
            80D, "em_estoque",
            LocalDate.now().plusDays(10),
            "Geladeira 2", "2-8°C",
            null, LocalDate.now().plusDays(20), null
        );
        assertThatThrownBy(() -> reagentService.createLot(req))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("recebimento não pode ser posterior à data de validade");
    }

    // ===== updateLot =====

    @Test
    @DisplayName("updateLot mudando status para em_uso com openedDate=null grava audit BACKFILLED")
    void updateLot_emUso_backfillOpenedDate_emiteAuditDistinto() {
        ReagentLot lot = lot(50D);
        lot.setStatus(ReagentStatus.EM_ESTOQUE);
        lot.setOpenedDate(null);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));

        ReagentLotRequest req = fullRequest(
            "ALT", "L123", "Bio", "Bioquímica",
            50D, "em_uso",
            LocalDate.now().plusDays(30),
            "Geladeira 2", "2-8°C",
            null, null, null
        );

        reagentService.updateLot(lot.getId(), req);

        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.EM_USO);
        assertThat(lot.getOpenedDate()).isEqualTo(LocalDate.now());

        // Audit BACKFILLED distinto.
        List<RecordingAuditService.Call> backfilled = auditService.callsFor(
            ReagentService.AUDIT_ACTION_OPENED_DATE_BACKFILLED);
        assertThat(backfilled).hasSize(1);
        RecordingAuditService.Call call = backfilled.getFirst();
        assertThat(call.entityId()).isEqualTo(lot.getId());
        assertThat(call.details())
            .containsEntry("trigger", ReagentService.AUDIT_TRIGGER_UPDATE_LOT)
            .containsEntry("toStatus", ReagentStatus.EM_USO);
    }

    @Test
    @DisplayName("updateLot mantendo em_uso com openedDate ja setada nao grava BACKFILLED (idempotencia)")
    void updateLot_emUsoComOpenedSetada_naoEmiteBackfilled() {
        ReagentLot lot = lot(50D);
        lot.setStatus(ReagentStatus.EM_USO);
        lot.setOpenedDate(LocalDate.now().minusDays(5));
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));

        ReagentLotRequest req = fullRequest(
            "ALT", "L123", "Bio", "Bioquímica",
            50D, "em_uso",
            LocalDate.now().plusDays(30),
            "Geladeira 2", "2-8°C",
            null, null, LocalDate.now().minusDays(5)
        );

        reagentService.updateLot(lot.getId(), req);

        assertThat(auditService.callsFor(ReagentService.AUDIT_ACTION_OPENED_DATE_BACKFILLED)).isEmpty();
    }

    @Test
    @DisplayName("updateLot mudando para em_estoque preserva openedDate (decisao 1.7 reciproca)")
    void updateLot_naoApagaOpenedDate() {
        ReagentLot lot = lot(50D);
        lot.setStatus(ReagentStatus.EM_USO);
        lot.setOpenedDate(LocalDate.now().minusDays(3));
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));

        ReagentLotRequest req = fullRequest(
            "ALT", "L123", "Bio", "Bioquímica",
            50D, "em_estoque",
            LocalDate.now().plusDays(30),
            "Geladeira 2", "2-8°C",
            null, null, null
        );

        reagentService.updateLot(lot.getId(), req);

        // openedDate preservado pelo service (request.openedDate=null nao apaga).
        assertThat(lot.getOpenedDate()).isEqualTo(LocalDate.now().minusDays(3));
    }

    @Test
    @DisplayName("updateLot com expiryDate passada forca vencido")
    void updateLot_setValidadePassada_deveVirarVencido() {
        ReagentLot lot = lot(25D);
        lot.setStatus(ReagentStatus.EM_ESTOQUE);
        lot.setExpiryDate(LocalDate.now().plusDays(30));
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));

        ReagentLotRequest req = fullRequest(
            "ALT", "L123", "Bio", "Bioquímica",
            25D, "em_estoque",
            LocalDate.now().minusDays(1),
            "Geladeira 2", "2-8°C",
            null, null, null
        );

        ReagentLot updated = reagentService.updateLot(lot.getId(), req);

        assertThat(updated.getStatus()).isEqualTo(ReagentStatus.VENCIDO);
    }

    @Test
    @DisplayName("updateLot com duplicata deve lançar exception")
    void updateLot_comDuplicata_deveLancarException() {
        ReagentLot lot = lot(50D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class)))
            .thenThrow(new DataIntegrityViolationException("unique constraint"));

        assertThatThrownBy(() -> reagentService.updateLot(lot.getId(), defaultRequest("em_estoque")))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Já existe um lote com este número e fabricante");
    }

    @Test
    @DisplayName("updateLot reverifica unicidade antes de salvar")
    void updateLot_reverificaUnicidade() {
        ReagentLot current = lot(100D);
        current.setManufacturer("Bio");
        ReagentLot otherConflicting = ReagentLot.builder()
            .id(UUID.randomUUID())
            .name("OUTRO")
            .lotNumber("LCOLIDE")
            .manufacturer("Bio")
            .currentStock(0D)
            .expiryDate(LocalDate.now().plusDays(30))
            .status(ReagentStatus.EM_ESTOQUE)
            .build();
        when(reagentLotRepository.findById(current.getId())).thenReturn(Optional.of(current));
        when(reagentLotRepository.findByLotNumberAndManufacturer("LCOLIDE", "Bio"))
            .thenReturn(List.of(otherConflicting));

        ReagentLotRequest req = fullRequest(
            "ALT", "LCOLIDE", "Bio", "Bioquímica",
            100D, "em_estoque",
            LocalDate.now().plusDays(60),
            "Geladeira 2", "2-8°C",
            null, null, null
        );

        assertThatThrownBy(() -> reagentService.updateLot(current.getId(), req))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Já existe um lote com este número e fabricante");
        verify(reagentLotRepository, never()).save(any());
    }

    // ===== createMovement =====

    @Test
    @DisplayName("ENTRADA aumenta estoque")
    void shouldUpdateCurrentStockOnEntradaMovement() {
        ReagentLot lot = lot(100D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        reagentService.createMovement(lot.getId(),
            new StockMovementRequest("ENTRADA", 20D, "Ana", "", null));

        assertThat(lot.getCurrentStock()).isEqualTo(120D);
    }

    @Test
    @DisplayName("SAIDA diminui estoque")
    void shouldDecreaseCurrentStockOnSaidaMovement() {
        ReagentLot lot = lot(100D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        reagentService.createMovement(lot.getId(),
            new StockMovementRequest("SAIDA", 15D, "Ana", "", null));

        assertThat(lot.getCurrentStock()).isEqualTo(85D);
    }

    @Test
    @DisplayName("AJUSTE define o estoque exato")
    void shouldSetStockOnAjusteMovement() {
        ReagentLot lot = lot(100D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        reagentService.createMovement(lot.getId(),
            new StockMovementRequest("AJUSTE", 55D, "Ana", "", "CONTAGEM_FISICA"));

        assertThat(lot.getCurrentStock()).isEqualTo(55D);
    }

    @Test
    @DisplayName("SAIDA com estoque insuficiente lanca exception")
    void saidaComEstoqueInsuficiente_deveLancarException() {
        ReagentLot lot = lot(10D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));

        assertThatThrownBy(() ->
            reagentService.createMovement(lot.getId(),
                new StockMovementRequest("SAIDA", 20D, "Ana", "", null))
        )
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Estoque insuficiente");
    }

    @Test
    @DisplayName("SAIDA total em em_estoque vira fora_de_estoque + audit")
    void saidaTotal_emEstoque_viraForaDeEstoque() {
        ReagentLot lot = lot(20D);
        lot.setStatus(ReagentStatus.EM_ESTOQUE);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        reagentService.createMovement(lot.getId(),
            new StockMovementRequest("SAIDA", 20D, "Ana", "", "VENCIMENTO"));

        assertThat(lot.getCurrentStock()).isEqualTo(0D);
        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.FORA_DE_ESTOQUE);
        List<RecordingAuditService.Call> derived = auditService.callsFor(
            ReagentService.AUDIT_ACTION_STATUS_DERIVED);
        assertThat(derived).hasSize(1);
        assertThat(derived.getFirst().details())
            .containsEntry("trigger", ReagentService.AUDIT_TRIGGER_MOVEMENT)
            .containsEntry("from", ReagentStatus.EM_ESTOQUE)
            .containsEntry("to", ReagentStatus.FORA_DE_ESTOQUE);
    }

    @Test
    @DisplayName("SAIDA parcial em em_estoque com openedDate=null mantem em_estoque")
    void saidaParcial_emEstoque_mantemSemAbertura() {
        ReagentLot lot = lot(20D);
        lot.setStatus(ReagentStatus.EM_ESTOQUE);
        lot.setOpenedDate(null);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        reagentService.createMovement(lot.getId(),
            new StockMovementRequest("SAIDA", 5D, "Ana", "", null));

        assertThat(lot.getCurrentStock()).isEqualTo(15D);
        // Sem openedDate o derivado e em_estoque (decisao 5.1 — abertura distingue em_uso de em_estoque).
        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.EM_ESTOQUE);
    }

    @Test
    @DisplayName("ENTRADA em fora_de_estoque com openedDate=null vira em_uso e grava openedDate=today (audit ressalva 3.6)")
    void entradaForaDeEstoque_semOpenedDate_viraEmUso() {
        ReagentLot lot = lot(0D);
        lot.setStatus(ReagentStatus.FORA_DE_ESTOQUE);
        lot.setOpenedDate(null);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        reagentService.createMovement(lot.getId(),
            new StockMovementRequest("ENTRADA", 10D, "Ana", "", null));

        assertThat(lot.getCurrentStock()).isEqualTo(10D);
        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.EM_USO);
        assertThat(lot.getOpenedDate()).isEqualTo(LocalDate.now());

        List<RecordingAuditService.Call> derived = auditService.callsFor(
            ReagentService.AUDIT_ACTION_STATUS_DERIVED);
        assertThat(derived).hasSize(1);
        assertThat(derived.getFirst().details())
            .containsEntry("trigger", ReagentService.AUDIT_TRIGGER_MOVEMENT)
            .containsEntry("from", ReagentStatus.FORA_DE_ESTOQUE)
            .containsEntry("to", ReagentStatus.EM_USO);

        // ENTRADA em fora_de_estoque NAO emite REAGENT_OPENED_DATE_BACKFILLED — abertura
        // operacional (movimento) e diferente de abertura administrativa (UPDATE).
        assertThat(auditService.callsFor(ReagentService.AUDIT_ACTION_OPENED_DATE_BACKFILLED))
            .isEmpty();
    }

    @Test
    @DisplayName("ENTRADA em fora_de_estoque com openedDate ja setada mantem openedDate")
    void entradaForaDeEstoque_comOpenedDate_mantemOpened() {
        LocalDate previousOpening = LocalDate.now().minusDays(10);
        ReagentLot lot = lot(0D);
        lot.setStatus(ReagentStatus.FORA_DE_ESTOQUE);
        lot.setOpenedDate(previousOpening);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        reagentService.createMovement(lot.getId(),
            new StockMovementRequest("ENTRADA", 5D, "Ana", "", null));

        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.EM_USO);
        assertThat(lot.getOpenedDate()).isEqualTo(previousOpening);
    }

    @Test
    @DisplayName("ENTRADA em vencido bloqueia com BusinessException + audit MOVEMENT_BLOCKED (audit ressalva 3.7)")
    void entradaEmVencido_bloqueiaComAudit() {
        ReagentLot lot = lot(5D);
        lot.setStatus(ReagentStatus.VENCIDO);
        lot.setExpiryDate(LocalDate.now().minusDays(5));
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));

        assertThatThrownBy(() ->
            reagentService.createMovement(lot.getId(),
                new StockMovementRequest("ENTRADA", 10D, "Ana", "", null))
        )
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Lote vencido nao aceita nova entrada");

        List<RecordingAuditService.Call> blocked = auditService.callsFor(
            ReagentService.AUDIT_ACTION_MOVEMENT_BLOCKED);
        assertThat(blocked).hasSize(1);
        assertThat(blocked.getFirst().details())
            .containsEntry("reason", "lote_vencido")
            .containsEntry("movementType", "ENTRADA");
        verify(reagentLotRepository, never()).save(any());
    }

    @Test
    @DisplayName("SAIDA em vencido permanece permitida (descarte registrado)")
    void saidaEmVencido_devePermitir() {
        ReagentLot lot = lot(5D);
        lot.setStatus(ReagentStatus.VENCIDO);
        lot.setExpiryDate(LocalDate.now().minusDays(5));
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        reagentService.createMovement(lot.getId(),
            new StockMovementRequest("SAIDA", 5D, "Ana", "", "VENCIMENTO"));

        assertThat(lot.getCurrentStock()).isEqualTo(0D);
        // Mantem vencido — vencido nao reverte para outra coisa apenas porque zerou estoque.
        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.VENCIDO);
    }

    @Test
    @DisplayName("AJUSTE em fora_de_estoque com q>0 vira em_uso")
    void ajusteForaDeEstoque_q_positivo_viraEmUso() {
        ReagentLot lot = lot(0D);
        lot.setStatus(ReagentStatus.FORA_DE_ESTOQUE);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        reagentService.createMovement(lot.getId(),
            new StockMovementRequest("AJUSTE", 8D, "Ana", "Recontagem", "CORRECAO"));

        assertThat(lot.getCurrentStock()).isEqualTo(8D);
        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.EM_USO);
        assertThat(lot.getOpenedDate()).isEqualTo(LocalDate.now());
    }

    // ===== Validacoes de motivo (preservadas) =====

    @Test
    @DisplayName("AJUSTE sem motivo deve falhar")
    void ajusteSemMotivo_deveFalhar() {
        ReagentLot lot = lot(50D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));

        assertThatThrownBy(() ->
            reagentService.createMovement(lot.getId(),
                new StockMovementRequest("AJUSTE", 30D, "Ana", "", null))
        )
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("AJUSTE exige um motivo");
    }

    @Test
    @DisplayName("SAIDA que zera estoque sem motivo deve falhar")
    void saidaZerandoSemMotivo_deveFalhar() {
        ReagentLot lot = lot(40D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));

        assertThatThrownBy(() ->
            reagentService.createMovement(lot.getId(),
                new StockMovementRequest("SAIDA", 40D, "Ana", "", null))
        )
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Saída que zera o estoque exige um motivo");
    }

    @Test
    @DisplayName("AJUSTE com motivo invalido deve falhar")
    void ajusteMotivoInvalido_deveFalhar() {
        ReagentLot lot = lot(50D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));

        assertThatThrownBy(() ->
            reagentService.createMovement(lot.getId(),
                new StockMovementRequest("AJUSTE", 30D, "Ana", "", "FANTASIA"))
        )
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Motivo de movimentação inválido");
    }

    @Test
    @DisplayName("SAIDA permitida quando iguala zero com motivo")
    void saidaQueIgualaZero_devePermitir() {
        ReagentLot lot = lot(50D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        StockMovement movement = reagentService.createMovement(
            lot.getId(), new StockMovementRequest("SAIDA", 50D, "Ana", "", "VENCIMENTO"));

        assertThat(lot.getCurrentStock()).isEqualTo(0D);
        assertThat(movement.getQuantity()).isEqualTo(50D);
    }

    @Test
    @DisplayName("AJUSTE para zero deve permitir")
    void ajusteParaZero_devePermitir() {
        ReagentLot lot = lot(80D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(i -> i.getArgument(0));

        StockMovement movement = reagentService.createMovement(
            lot.getId(), new StockMovementRequest("AJUSTE", 0D, "Ana", "Zerando estoque", "CORRECAO"));

        assertThat(lot.getCurrentStock()).isEqualTo(0D);
        assertThat(movement.getNotes()).isEqualTo("Zerando estoque");
        assertThat(movement.getPreviousStock()).isEqualTo(80D);
    }

    @Test
    @DisplayName("ENTRADA grava previousStock")
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
    @DisplayName("SAIDA grava previousStock")
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

    // ===== getLots / filtros =====

    @Test
    @DisplayName("getLots calcula daysLeft corretamente")
    void shouldCalculateDaysLeftCorrectly() {
        ReagentLot lot = lot(100D);
        lot.setExpiryDate(LocalDate.now().plusDays(10));
        when(reagentLotRepository.findByFilters(isNull(), isNull())).thenReturn(List.of(lot));

        var result = reagentService.getLots(null, null);

        assertThat(result.getFirst().daysLeft()).isBetween(9L, 10L);
    }

    @Test
    @DisplayName("getLots nao altera status (auto-vencimento delegado ao scheduler)")
    void getLots_naoDeveAlterarStatus() {
        ReagentLot lot = lot(100D);
        lot.setExpiryDate(LocalDate.now().minusDays(1));
        lot.setStatus(ReagentStatus.EM_ESTOQUE);
        when(reagentLotRepository.findByFilters(isNull(), isNull())).thenReturn(List.of(lot));

        var result = reagentService.getLots(null, null);

        // Mantem status atual; derivacao automatica ocorre no scheduler/createMovement, nao em GET.
        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.EM_ESTOQUE);
        verify(reagentLotRepository, never()).save(any());
        assertThat(result).hasSize(1);
    }

    @Test
    @DisplayName("filtragem por category e status novo deve usar repository")
    void filtragemCategoryEStatus_deveUsarRepository() {
        ReagentLot lot = lot(100D);
        lot.setCategory("Bioquímica");
        lot.setExpiryDate(LocalDate.now().plusDays(30));
        when(reagentLotRepository.findByFilters(eq("Bioquímica"), eq("em_estoque")))
            .thenReturn(List.of(lot));

        var result = reagentService.getLots("Bioquímica", "em_estoque");

        assertThat(result).hasSize(1);
        verify(reagentLotRepository).findByFilters("Bioquímica", "em_estoque");
    }

    @Test
    @DisplayName("filtro por status legado retorna 400 (defesa anti-status-legado)")
    void filtragemStatusLegado_deveFalhar() {
        assertThatThrownBy(() -> reagentService.getLots(null, "ativo"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Status legado nao suportado");
    }

    @Test
    @DisplayName("getByLotNumber retorna lotes com mesmo numero")
    void getByLotNumber_deveRetornarLotes() {
        ReagentLot lot1 = lot(100D);
        ReagentLot lot2 = lot(50D);
        lot2.setManufacturer("OutroFab");
        when(reagentLotRepository.findByLotNumberIgnoreCase("L123")).thenReturn(List.of(lot1, lot2));

        var result = reagentService.getByLotNumber("L123");

        assertThat(result).hasSize(2);
    }

    @Test
    @DisplayName("getLots marca usedInQcRecently com base em CQ recente")
    void getLotsMarcaUsedInQcRecently() {
        ReagentLot usedLot = lot(100D);
        usedLot.setLotNumber("L-ACTIVE");
        ReagentLot unusedLot = lot(100D);
        unusedLot.setLotNumber("L-INACTIVE");
        when(reagentLotRepository.findByFilters(isNull(), isNull())).thenReturn(List.of(usedLot, unusedLot));
        when(qcRecordRepository.findActiveLotNumbersSince(any(), any())).thenReturn(List.of("l-active"));

        var result = reagentService.getLots(null, null);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).usedInQcRecently()).isTrue();
        assertThat(result.get(1).usedInQcRecently()).isFalse();
    }

    @Test
    @DisplayName("getLots tolera retorno vazio do repo de CQ")
    void getLotsToleraCqVazio() {
        ReagentLot l = lot(100D);
        when(reagentLotRepository.findByFilters(isNull(), isNull())).thenReturn(List.of(l));
        when(qcRecordRepository.findActiveLotNumbersSince(any(), any())).thenReturn(Collections.emptyList());

        var result = reagentService.getLots(null, null);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().usedInQcRecently()).isFalse();
    }

    @Test
    @DisplayName("getLots: lotNumber em colisao NAO marca usedInQcRecently (P0-1)")
    void usedInQcRecentlyConservadorQuandoColide() {
        ReagentLot a = lot(100D);
        a.setLotNumber("L-DUO");
        a.setManufacturer("FabA");
        ReagentLot b = lot(100D);
        b.setLotNumber("L-DUO");
        b.setManufacturer("FabB");
        when(reagentLotRepository.findByFilters(isNull(), isNull())).thenReturn(List.of(a, b));
        when(qcRecordRepository.findActiveLotNumbersSince(any(), any())).thenReturn(List.of("l-duo"));

        var result = reagentService.getLots(null, null);

        assertThat(result.get(0).usedInQcRecently()).isFalse();
        assertThat(result.get(1).usedInQcRecently()).isFalse();
    }

    @Test
    @DisplayName("getLots expoe diagnostico de rastreabilidade forte")
    void getLotsExpoeDiagnostico() {
        ReagentLot incomplete = lot(100D);
        incomplete.setManufacturer("Bio");
        incomplete.setLocation(null);
        incomplete.setSupplier(null);
        incomplete.setReceivedDate(null);

        ReagentLot complete = lot(100D);
        complete.setLotNumber("L-COMPLETE");
        complete.setManufacturer("Bio");
        complete.setLocation("Geladeira 2");
        complete.setSupplier("ForneceX");
        complete.setReceivedDate(LocalDate.now().minusDays(3));

        when(reagentLotRepository.findByFilters(isNull(), isNull())).thenReturn(List.of(incomplete, complete));
        when(qcRecordRepository.findActiveLotNumbersSince(any(), any())).thenReturn(Collections.emptyList());

        var result = reagentService.getLots(null, null);

        assertThat(result.get(0).traceabilityComplete()).isFalse();
        assertThat(result.get(0).traceabilityIssues())
            .containsExactlyInAnyOrder("location", "supplier", "receivedDate");
        assertThat(result.get(1).traceabilityComplete()).isTrue();
        assertThat(result.get(1).traceabilityIssues()).isEmpty();
    }

    @Test
    @DisplayName("getLots expoe canReceiveEntry=false apenas para vencido")
    void getLotsExpoePoliticaMovimentacao() {
        ReagentLot foraDeEstoque = lot(0D);
        foraDeEstoque.setStatus(ReagentStatus.FORA_DE_ESTOQUE);
        ReagentLot vencido = lot(0D);
        vencido.setLotNumber("L-V");
        vencido.setStatus(ReagentStatus.VENCIDO);

        when(reagentLotRepository.findByFilters(isNull(), isNull()))
            .thenReturn(List.of(foraDeEstoque, vencido));
        when(qcRecordRepository.findActiveLotNumbersSince(any(), any())).thenReturn(Collections.emptyList());

        var result = reagentService.getLots(null, null);

        assertThat(result.get(0).canReceiveEntry()).isTrue();
        assertThat(result.get(0).allowedMovementTypes()).containsExactly("ENTRADA", "SAIDA", "AJUSTE");
        assertThat(result.get(0).movementWarning()).isNull();

        assertThat(result.get(1).canReceiveEntry()).isFalse();
        assertThat(result.get(1).allowedMovementTypes()).containsExactly("SAIDA", "AJUSTE");
        assertThat(result.get(1).movementWarning())
            .isEqualTo("Lote vencido nao aceita nova entrada. Crie um novo lote.");
    }

    // ===== deleteLot =====

    @Test
    @DisplayName("deleteLot remove fisicamente quando sem historico")
    void deleteLot_semHistorico_deveRemoverFisicamente() {
        ReagentLot lot = lot(0D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(stockMovementRepository.existsByReagentLotId(lot.getId())).thenReturn(false);
        when(qcRecordRepository.existsByLotNumberOperational(lot.getLotNumber())).thenReturn(false);

        reagentService.deleteLot(lot.getId());

        verify(reagentLotRepository).deleteById(lot.getId());
        verify(reagentLotRepository, never()).save(any());
    }

    @Test
    @DisplayName("deleteLot arquiva como fora_de_estoque quando ha movimentos com estoque zero")
    void deleteLot_comMovimentos_arquivaForaDeEstoque() {
        ReagentLot lot = lot(0D);
        lot.setStatus(ReagentStatus.EM_ESTOQUE);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(stockMovementRepository.existsByReagentLotId(lot.getId())).thenReturn(true);
        when(qcRecordRepository.existsByLotNumberOperational(lot.getLotNumber())).thenReturn(false);
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));

        reagentService.deleteLot(lot.getId());

        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.FORA_DE_ESTOQUE);
        verify(reagentLotRepository, never()).deleteById(any());
        List<RecordingAuditService.Call> archived = auditService.callsFor(
            ReagentService.AUDIT_ACTION_LOT_ARCHIVED);
        assertThat(archived).hasSize(1);
        assertThat(archived.getFirst().details())
            .containsEntry("to", ReagentStatus.FORA_DE_ESTOQUE);
    }

    @Test
    @DisplayName("deleteLot bloqueia arquivamento com historico e estoque positivo")
    void deleteLot_comHistoricoEEstoquePositivo_deveBloquear() {
        ReagentLot lot = lot(5D);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(stockMovementRepository.existsByReagentLotId(lot.getId())).thenReturn(true);
        when(qcRecordRepository.existsByLotNumberOperational(lot.getLotNumber())).thenReturn(false);

        assertThatThrownBy(() -> reagentService.deleteLot(lot.getId()))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Zere o estoque antes de arquivar");

        verify(reagentLotRepository, never()).deleteById(any());
        verify(reagentLotRepository, never()).save(any());
        assertThat(auditService.callsFor(ReagentService.AUDIT_ACTION_DELETE_BLOCKED)).hasSize(1);
    }

    @Test
    @DisplayName("deleteLot preserva lote usado em CQ como fora_de_estoque quando estoque zerado")
    void deleteLot_usadoEmCqComEstoqueZero_deveArquivar() {
        ReagentLot lot = lot(0D);
        lot.setStatus(ReagentStatus.EM_ESTOQUE);
        when(reagentLotRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        when(stockMovementRepository.existsByReagentLotId(lot.getId())).thenReturn(false);
        when(qcRecordRepository.existsByLotNumberOperational(lot.getLotNumber())).thenReturn(true);
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));

        reagentService.deleteLot(lot.getId());

        assertThat(lot.getStatus()).isEqualTo(ReagentStatus.FORA_DE_ESTOQUE);
        verify(reagentLotRepository, never()).deleteById(any());
    }

    // ===== deleteMovement =====

    @Test
    @DisplayName("deleteMovement ENTRADA com estoque insuficiente lanca exception")
    void deleteMovementEntrada_comEstoqueInsuficiente_deveLancarException() {
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
    @DisplayName("deleteMovement SAIDA restaura estoque")
    void deleteMovementSaida_deveRestaurarEstoque() {
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

    // ===== getExpiringLots / getLabelSummaries =====

    @Test
    @DisplayName("getExpiringLots delega ao repository com janela de dias")
    void shouldFindExpiringLots() {
        when(reagentLotRepository.findExpiringLots(any(), any())).thenReturn(List.of(lot(100D)));

        var result = reagentService.getExpiringLots(30);

        assertThat(result).hasSize(1);
    }

    // ===== Alinhamento de listas canonicas (G-01 / G-02) =====
    //
    // Regressao para o bug critico do refator-reagentes-v2 (qa-review):
    // ALLOWED_CATEGORIES e ALLOWED_STORAGE_TEMPS no backend DEVEM espelhar exatamente
    // CATEGORIES e TEMPS em biodiagnostico-web/src/components/proin/reagentes/constants.ts.
    // Drift quebra cadastro com BusinessException("Categoria invalida..." / "Temperatura..."
    // de armazenamento invalida...").

    @org.junit.jupiter.params.ParameterizedTest(name = "createLot aceita categoria canonica: {0}")
    @org.junit.jupiter.params.provider.MethodSource(
        "com.biodiagnostico.service.ReagentServiceTest#allowedCategoriesProvider")
    @DisplayName("ALLOWED_CATEGORIES: cada categoria canonica e aceita por createLot (G-01)")
    void allCategorias_canonicas_saoAceitas(String category) {
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));

        ReagentLotRequest req = fullRequest(
            "ALT", "L-CAT-" + Math.abs(category.hashCode()), "Bio", category,
            80D, "em_estoque",
            LocalDate.now().plusDays(60),
            "Geladeira 2", "2-8°C",
            null, null, null
        );

        ReagentLot lot = reagentService.createLot(req);
        assertThat(lot.getCategory()).isEqualTo(category);
    }

    @org.junit.jupiter.params.ParameterizedTest(name = "createLot aceita storageTemp canonica: {0}")
    @org.junit.jupiter.params.provider.MethodSource(
        "com.biodiagnostico.service.ReagentServiceTest#allowedStorageTempsProvider")
    @DisplayName("ALLOWED_STORAGE_TEMPS: cada temperatura canonica e aceita por createLot (G-02)")
    void allTemperaturas_canonicas_saoAceitas(String storageTemp) {
        when(reagentLotRepository.save(any(ReagentLot.class))).thenAnswer(i -> i.getArgument(0));

        ReagentLotRequest req = fullRequest(
            "ALT", "L-TEMP-" + Math.abs(storageTemp.hashCode()), "Bio", "Bioquímica",
            80D, "em_estoque",
            LocalDate.now().plusDays(60),
            "Geladeira 2", storageTemp,
            null, null, null
        );

        ReagentLot lot = reagentService.createLot(req);
        assertThat(lot.getStorageTemp()).isEqualTo(storageTemp);
    }

    @Test
    @DisplayName("ALLOWED_CATEGORIES: valor fora da lista (legado) e rejeitado com mensagem clara (G-01)")
    void categoria_legada_eRejeitada() {
        ReagentLotRequest req = fullRequest(
            "ALT", "L-CAT-LEG", "Bio", "Coagulacao",
            80D, "em_estoque",
            LocalDate.now().plusDays(60),
            "Geladeira 2", "2-8°C",
            null, null, null
        );
        assertThatThrownBy(() -> reagentService.createLot(req))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Categoria invalida")
            .hasMessageContaining("Bioquímica")
            .hasMessageContaining("Kit Diagnóstico");
    }

    @Test
    @DisplayName("ALLOWED_STORAGE_TEMPS: formato legado (sem °C) e rejeitado com mensagem clara (G-02)")
    void temperatura_legada_eRejeitada() {
        ReagentLotRequest req = fullRequest(
            "ALT", "L-TEMP-LEG", "Bio", "Bioquímica",
            80D, "em_estoque",
            LocalDate.now().plusDays(60),
            "Geladeira 2", "2-8C",
            null, null, null
        );
        assertThatThrownBy(() -> reagentService.createLot(req))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Temperatura de armazenamento invalida")
            .hasMessageContaining("2-8°C");
    }

    @Test
    @DisplayName("ALLOWED_CATEGORIES espelha frontend constants.ts (literal de seguranca G-01)")
    void categorias_espelhamFrontendConstantsTs() {
        // Snapshot literal das CATEGORIES em
        // biodiagnostico-web/src/components/proin/reagentes/constants.ts.
        // Se este teste quebrar, alinhar tambem la (ou aqui se a UI mudou primeiro).
        assertThat(ReagentService.ALLOWED_CATEGORIES).containsExactly(
            "Bioquímica",
            "Hematologia",
            "Imunologia",
            "Parasitologia",
            "Microbiologia",
            "Uroanálise",
            "Kit Diagnóstico",
            "Controle CQ",
            "Calibrador",
            "Geral"
        );
    }

    @Test
    @DisplayName("ALLOWED_STORAGE_TEMPS espelha frontend constants.ts (literal de seguranca G-02)")
    void temperaturas_espelhamFrontendConstantsTs() {
        // Snapshot literal das TEMPS em
        // biodiagnostico-web/src/components/proin/reagentes/constants.ts.
        assertThat(ReagentService.ALLOWED_STORAGE_TEMPS).containsExactly(
            "2-8°C",
            "15-25°C (Ambiente)",
            "-20°C",
            "-80°C"
        );
    }

    static java.util.stream.Stream<String> allowedCategoriesProvider() {
        return ReagentService.ALLOWED_CATEGORIES.stream();
    }

    static java.util.stream.Stream<String> allowedStorageTempsProvider() {
        return ReagentService.ALLOWED_STORAGE_TEMPS.stream();
    }
}

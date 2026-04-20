package com.biodiagnostico.service;

import com.biodiagnostico.dto.request.ReagentLotRequest;
import com.biodiagnostico.dto.request.StockMovementRequest;
import com.biodiagnostico.dto.response.ReagentLotResponse;
import com.biodiagnostico.dto.response.ReagentTagSummary;
import com.biodiagnostico.entity.MovementReason;
import com.biodiagnostico.entity.MovementType;
import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.entity.ReagentStatus;
import com.biodiagnostico.entity.StockMovement;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.exception.ResourceNotFoundException;
import com.biodiagnostico.repository.QcRecordRepository;
import com.biodiagnostico.repository.ReagentLotRepository;
import com.biodiagnostico.repository.StockMovementRepository;
import com.biodiagnostico.util.NumericUtils;
import com.biodiagnostico.util.ResponseMapper;
import java.time.LocalDate;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReagentService {

    private static final String PREVIOUS_STOCK_PREFIX = "PREVIOUS_STOCK=";

    /** Janela para considerar um lote "ativo em CQ" (Fase 3). */
    private static final int QC_ACTIVE_WINDOW_DAYS = 30;

    // Acoes de auditoria (regulatorio ANVISA RDC 302 / ISO 15189).
    // Transicoes automaticas de status sao registradas em audit_log para
    // rastreabilidade externa. Chamadas diretas deste service a AuditService
    // cobrem as mudancas originadas em fluxos operacionais (create/update/move);
    // o scheduler registra suas proprias transicoes em trigger="scheduler".
    public static final String AUDIT_ACTION_STATUS_DERIVED = "REAGENT_STATUS_DERIVED";
    public static final String AUDIT_ACTION_MOVEMENT_BLOCKED = "REAGENT_MOVEMENT_BLOCKED";

    public static final String AUDIT_TRIGGER_CREATE_LOT = "createLot";
    public static final String AUDIT_TRIGGER_UPDATE_LOT = "updateLot";
    public static final String AUDIT_TRIGGER_MOVEMENT = "movement";
    public static final String AUDIT_TRIGGER_SCHEDULER = "scheduler";

    private final ReagentLotRepository reagentLotRepository;
    private final StockMovementRepository stockMovementRepository;
    private final QcRecordRepository qcRecordRepository;
    private final AuditService auditService;

    public ReagentService(
        ReagentLotRepository reagentLotRepository,
        StockMovementRepository stockMovementRepository,
        QcRecordRepository qcRecordRepository,
        AuditService auditService
    ) {
        this.reagentLotRepository = reagentLotRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.qcRecordRepository = qcRecordRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<ReagentLotResponse> getLots(String category, String status) {
        String normalizedCategory = (category == null || category.isBlank()) ? null : category;
        String normalizedStatus = (status == null || status.isBlank()) ? null : ReagentStatus.normalize(status);

        List<ReagentLot> lots = reagentLotRepository.findByFilters(normalizedCategory, normalizedStatus);

        // Fase 3: descobre quais lotes apareceram em CQ recente, em uma unica query.
        Set<String> activeInQc = lotNumbersUsedInQcRecently(lots);
        // P0-1 (audit): QcRecord guarda apenas lotNumber (sem manufacturer). Se
        // dois ReagentLot compartilham o mesmo lotNumber (fabricantes distintos),
        // a flag usedInQcRecently ficaria ambigua. Politica conservadora: nao
        // marcar nenhum dos lotes em colisao, evitando falso positivo.
        Set<String> ambiguousLotNumbers = lotNumbersWithCollision(lots);

        return lots.stream()
            .map(lot -> {
                boolean inQc = lot.getLotNumber() != null
                    && activeInQc.contains(lot.getLotNumber().toLowerCase());
                boolean ambiguous = lot.getLotNumber() != null
                    && ambiguousLotNumbers.contains(lot.getLotNumber().toLowerCase());
                return ResponseMapper.toReagentLotResponse(lot, inQc && !ambiguous);
            })
            .toList();
    }

    /**
     * Consulta em batch quais dos {@code lotNumber} fornecidos aparecem em registros
     * de CQ nos ultimos {@link #QC_ACTIVE_WINDOW_DAYS} dias. Retorna o conjunto em
     * minusculas para match case-insensitive.
     */
    private Set<String> lotNumbersUsedInQcRecently(List<ReagentLot> lots) {
        // QA P1: normalizar com trim+lower ao coletar para que " 123 " no lote
        // case com "123" em qc_records (diferenca operacional comum nos imports).
        Set<String> lotNumbersLower = lots.stream()
            .map(ReagentLot::getLotNumber)
            .filter(ln -> ln != null && !ln.isBlank())
            .map(ln -> ln.trim().toLowerCase())
            .filter(ln -> !ln.isEmpty())
            .collect(Collectors.toCollection(HashSet::new));
        if (lotNumbersLower.isEmpty()) {
            return Collections.emptySet();
        }
        LocalDate since = LocalDate.now().minusDays(QC_ACTIVE_WINDOW_DAYS);
        return new HashSet<>(qcRecordRepository.findActiveLotNumbersSince(lotNumbersLower, since));
    }

    /**
     * Retorna o conjunto (lowercase) de lotNumbers que aparecem em mais de um
     * ReagentLot da lista — ou seja, lotes cujo lotNumber colide com outro
     * fabricante. Usado para calibrar a flag {@code usedInQcRecently}.
     */
    private Set<String> lotNumbersWithCollision(List<ReagentLot> lots) {
        java.util.Map<String, Integer> counts = new java.util.HashMap<>();
        for (ReagentLot lot : lots) {
            String ln = lot.getLotNumber();
            if (ln == null || ln.isBlank()) continue;
            String key = ln.trim().toLowerCase();
            if (key.isEmpty()) continue;
            counts.merge(key, 1, Integer::sum);
        }
        Set<String> ambiguous = new HashSet<>();
        for (var e : counts.entrySet()) {
            if (e.getValue() > 1) ambiguous.add(e.getKey());
        }
        return ambiguous;
    }

    @Transactional
    public ReagentLot createLot(ReagentLotRequest request) {
        validateLotDates(request);
        // Pre-check de unicidade (lotNumber, manufacturer) simetrico ao updateLot.
        // Evita que toda colisao gere "duplicate key" no log do PostgreSQL; mantem
        // o catch abaixo como rede de seguranca para race-condition entre check e save.
        if (!reagentLotRepository
                .findByLotNumberAndManufacturer(request.lotNumber(), request.manufacturer())
                .isEmpty()) {
            throw new BusinessException("Já existe um lote com este número e fabricante");
        }
        String status = resolveStatus(request.status(), ReagentStatus.ATIVO);
        ReagentLot lot = ReagentLot.builder()
            .name(request.name())
            .lotNumber(request.lotNumber())
            .manufacturer(request.manufacturer())
            .category(request.category())
            .expiryDate(request.expiryDate())
            .quantityValue(NumericUtils.defaultIfNull(request.quantityValue()))
            .stockUnit(request.stockUnit() == null || request.stockUnit().isBlank() ? "unidades" : request.stockUnit())
            .currentStock(NumericUtils.defaultIfNull(request.currentStock()))
            .estimatedConsumption(NumericUtils.defaultIfNull(request.estimatedConsumption()))
            .storageTemp(request.storageTemp())
            .startDate(request.startDate())
            .endDate(request.endDate())
            .alertThresholdDays(request.alertThresholdDays() == null ? 7 : request.alertThresholdDays())
            .status(status)
            .location(request.location())
            .supplier(request.supplier())
            .receivedDate(request.receivedDate())
            .openedDate(request.openedDate())
            .build();
        // Derivacao automatica: se o lote ja nasce vencido (expiry < today), corrige
        // para vencido (estoque > 0) ou inativo (estoque 0). quarentena preserva.
        applyDerivedStatus(lot, LocalDate.now(), AUDIT_TRIGGER_CREATE_LOT);
        try {
            return reagentLotRepository.save(lot);
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("Já existe um lote com este número e fabricante");
        }
    }

    @Transactional
    public ReagentLot updateLot(UUID id, ReagentLotRequest request) {
        ReagentLot lot = reagentLotRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Lote de reagente não encontrado"));
        validateLotDates(request);
        // Reverifica unicidade (lotNumber, manufacturer) antes de salvar, para evitar
        // que uma alteracao colida com outro lote existente e so estoure o erro na
        // DataIntegrityViolationException, que pode ser menos claro.
        List<ReagentLot> conflicts = reagentLotRepository.findByLotNumberAndManufacturer(
            request.lotNumber(), request.manufacturer());
        boolean conflict = conflicts.stream().anyMatch(other -> !other.getId().equals(id));
        if (conflict) {
            throw new BusinessException("Já existe um lote com este número e fabricante");
        }

        lot.setName(request.name());
        lot.setLotNumber(request.lotNumber());
        lot.setManufacturer(request.manufacturer());
        lot.setCategory(request.category());
        lot.setExpiryDate(request.expiryDate());
        lot.setQuantityValue(NumericUtils.defaultIfNull(request.quantityValue()));
        lot.setStockUnit(request.stockUnit() == null || request.stockUnit().isBlank() ? lot.getStockUnit() : request.stockUnit());
        lot.setCurrentStock(NumericUtils.defaultIfNull(request.currentStock()));
        lot.setEstimatedConsumption(NumericUtils.defaultIfNull(request.estimatedConsumption()));
        lot.setStorageTemp(request.storageTemp());
        lot.setStartDate(request.startDate());
        lot.setEndDate(request.endDate());
        lot.setAlertThresholdDays(request.alertThresholdDays() == null ? lot.getAlertThresholdDays() : request.alertThresholdDays());
        if (request.status() != null && !request.status().isBlank()) {
            lot.setStatus(resolveStatus(request.status(), lot.getStatus()));
        }
        // Fase 3: rastreabilidade. Campos opcionais — passam para null livremente,
        // mas nao sobrescrevem dados nao informados (null trata como "sem alteracao"
        // seria outra politica; aqui aceitamos override explicito para permitir limpar).
        lot.setLocation(request.location());
        lot.setSupplier(request.supplier());
        lot.setReceivedDate(request.receivedDate());
        lot.setOpenedDate(request.openedDate());
        // Derivacao automatica pos-atualizacao. Se o admin pediu quarentena explicitamente
        // (resolveStatus ja aplicou acima), applyDerivedStatus preserva quarentena. Se o
        // status ficou outro (ativo/em_uso/inativo/vencido) e a validade/estoque indicarem
        // um derivado diferente, a derivacao sobrepoe — ex: admin tentou reativar lote com
        // validade passada, o sistema corrige para vencido/inativo.
        applyDerivedStatus(lot, LocalDate.now(), AUDIT_TRIGGER_UPDATE_LOT);
        try {
            return reagentLotRepository.save(lot);
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("Já existe um lote com este número e fabricante");
        }
    }

    @Transactional
    public void deleteLot(UUID id) {
        if (!reagentLotRepository.existsById(id)) {
            throw new ResourceNotFoundException("Lote de reagente não encontrado");
        }
        reagentLotRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<StockMovement> getMovements(UUID lotId) {
        return stockMovementRepository.findByReagentLotIdOrderByCreatedAtDesc(lotId);
    }

    @Transactional
    public StockMovement createMovement(UUID lotId, StockMovementRequest request) {
        ReagentLot lot = reagentLotRepository.findById(lotId)
            .orElseThrow(() -> new ResourceNotFoundException("Lote de reagente não encontrado"));

        String type = MovementType.normalize(request.type());
        if (!MovementType.isValid(type)) {
            throw new BusinessException(
                "Tipo de movimentação inválido. Valores aceitos: " + MovementType.humanList());
        }

        // Lote inativo representa historico/arquivo (acabou e passou da validade).
        // ENTRADA em inativo "ressuscitaria" o lote e quebraria a semantica do estado
        // terminal. Obrigamos criacao de novo lote. AJUSTE continua permitido (correcao
        // operacional de contagem — se o ajuste elevar o estoque acima de zero com
        // validade ja vencida, a derivacao automatica reclassifica para vencido).
        if (ReagentStatus.INATIVO.equals(lot.getStatus()) && MovementType.ENTRADA.equals(type)) {
            // Auditoria regulatoria: registrar a tentativa bloqueada para que o
            // auditor observe fluxo operacional mal-resolvido (usuario tentando
            // reaproveitar lote terminal ao inves de criar um novo).
            Map<String, Object> blockedDetails = new HashMap<>();
            blockedDetails.put("reason", "lote_inativo");
            blockedDetails.put("movementType", MovementType.ENTRADA);
            auditService.log(
                AUDIT_ACTION_MOVEMENT_BLOCKED,
                "ReagentLot",
                lot.getId(),
                blockedDetails
            );
            throw new BusinessException(
                "Lote inativo não aceita nova entrada. Crie um novo lote.");
        }

        double quantity = NumericUtils.defaultIfNull(request.quantity());
        double currentStock = NumericUtils.defaultIfNull(lot.getCurrentStock());
        double nextStock;

        switch (type) {
            case MovementType.ENTRADA -> nextStock = currentStock + quantity;
            case MovementType.SAIDA -> {
                if (currentStock - quantity < 0) {
                    throw new BusinessException(
                        "Estoque insuficiente para esta saída. Estoque atual: " + currentStock);
                }
                nextStock = currentStock - quantity;
            }
            case MovementType.AJUSTE -> nextStock = quantity;
            default -> throw new BusinessException("Tipo de movimentação inválido");
        }

        // Valida motivo: obrigatorio para AJUSTE e para SAIDA que zere o estoque.
        String reason = MovementReason.normalize(request.reason());
        boolean zeroingSaida = MovementType.SAIDA.equals(type) && nextStock == 0;
        if (MovementType.AJUSTE.equals(type) && (reason == null || reason.isBlank())) {
            throw new BusinessException(
                "AJUSTE exige um motivo. Valores aceitos: " + MovementReason.humanList());
        }
        if (zeroingSaida && (reason == null || reason.isBlank())) {
            throw new BusinessException(
                "Saída que zera o estoque exige um motivo. Valores aceitos: " + MovementReason.humanList());
        }
        if (reason != null && !reason.isBlank() && !MovementReason.isValid(reason)) {
            throw new BusinessException(
                "Motivo de movimentação inválido. Valores aceitos: " + MovementReason.humanList());
        }

        lot.setCurrentStock(nextStock);
        // Derivacao automatica pos-movimento: se a validade ja passou, a transicao entre
        // vencido <-> inativo segue o estoque. quarentena preserva (regra manual).
        // Ex 1: SAIDA que zera estoque em lote vencido → inativo (arquivo/historico).
        // Ex 2: AJUSTE que eleva estoque > 0 em lote inativo com validade passada → vencido.
        applyDerivedStatus(lot, LocalDate.now(), AUDIT_TRIGGER_MOVEMENT);
        reagentLotRepository.save(lot);
        // previousStock passa a ser gravado em TODOS os movimentos para permitir
        // auditoria e reversao consistente independente do tipo.
        StockMovement movement = StockMovement.builder()
            .reagentLot(lot)
            .type(type)
            .quantity(quantity)
            .responsible(request.responsible())
            .notes(request.notes())
            .previousStock(currentStock)
            .reason(reason)
            .build();
        return stockMovementRepository.save(movement);
    }

    @Transactional
    public void deleteMovement(UUID movementId) {
        StockMovement movement = stockMovementRepository.findById(movementId)
            .orElseThrow(() -> new ResourceNotFoundException("Movimentação não encontrada"));
        ReagentLot lot = movement.getReagentLot();
        double currentStock = NumericUtils.defaultIfNull(lot.getCurrentStock());

        switch (movement.getType()) {
            case MovementType.ENTRADA -> {
                double resultingStock = currentStock - movement.getQuantity();
                if (resultingStock < 0) {
                    throw new BusinessException(
                        "Não é possível excluir esta entrada. O estoque resultante ficaria negativo.");
                }
                lot.setCurrentStock(resultingStock);
            }
            case MovementType.SAIDA -> lot.setCurrentStock(currentStock + movement.getQuantity());
            case MovementType.AJUSTE -> {
                double previousStock = movement.getPreviousStock() != null
                    ? movement.getPreviousStock()
                    : extractPreviousStock(movement.getNotes(), currentStock);
                if (previousStock < 0) {
                    throw new BusinessException(
                        "Não é possível excluir este ajuste. O estoque resultante ficaria negativo.");
                }
                lot.setCurrentStock(previousStock);
            }
            default -> throw new BusinessException("Tipo de movimentação inválido");
        }

        reagentLotRepository.save(lot);
        stockMovementRepository.delete(movement);
    }

    @Transactional(readOnly = true)
    public List<ReagentLot> getByLotNumber(String lotNumber) {
        return reagentLotRepository.findByLotNumberIgnoreCase(lotNumber);
    }

    @Transactional(readOnly = true)
    public List<ReagentLot> getExpiringLots(int days) {
        LocalDate today = LocalDate.now();
        return reagentLotRepository.findExpiringLots(today, today.plusDays(days));
    }

    @Transactional(readOnly = true)
    public List<ReagentTagSummary> getTagSummaries() {
        return reagentLotRepository.findTagSummaries().stream()
            .map(summary -> new ReagentTagSummary(
                summary.getName(),
                summary.getTotal(),
                summary.getAtivos(),
                summary.getEmUso(),
                summary.getInativos(),
                summary.getVencidos()
            ))
            .toList();
    }

    private double extractPreviousStock(String notes, double fallback) {
        if (notes == null || !notes.startsWith(PREVIOUS_STOCK_PREFIX)) {
            return fallback;
        }
        String value = notes.substring(PREVIOUS_STOCK_PREFIX.length()).split(";")[0];
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }

    /**
     * Valida que a data de validade seja posterior a data de inicio (quando ambas existirem).
     * Regras de obrigatoriedade sao tratadas via bean validation no DTO.
     */
    private void validateLotDates(ReagentLotRequest request) {
        if (request.expiryDate() != null && request.startDate() != null) {
            if (request.expiryDate().isBefore(request.startDate())) {
                throw new BusinessException(
                    "A data de validade não pode ser anterior à data de início de uso.");
            }
        }
    }

    /**
     * Retorna o status derivado para um lote dado o estoque e validade atuais.
     * Regras:
     *  - quarentena prevalece (estado de excecao manual — nao altera)
     *  - expiryDate nula → mantem status atual (sem informacao suficiente para derivar)
     *  - expiryDate &lt; today e currentStock &lt;= 0 → inativo (historico/arquivo)
     *  - expiryDate &lt; today e currentStock &gt; 0  → vencido (risco operacional)
     *  - senao → mantem status atual (nao muda)
     *
     * Valor operacional: separar RISCO (vencido com estoque, precisa descartar)
     * de HISTORICO (inativo = acabou e passou da validade).
     */
    public String deriveStatus(ReagentLot lot, LocalDate today) {
        if (lot == null) {
            return null;
        }
        String current = lot.getStatus();
        if (ReagentStatus.QUARENTENA.equals(current)) {
            return current;
        }
        LocalDate expiry = lot.getExpiryDate();
        if (expiry == null || !expiry.isBefore(today)) {
            return current;
        }
        double stock = NumericUtils.defaultIfNull(lot.getCurrentStock());
        if (stock <= 0) {
            return ReagentStatus.INATIVO;
        }
        return ReagentStatus.VENCIDO;
    }

    /**
     * Aplica {@link #deriveStatus(ReagentLot, LocalDate)} mutando o lote quando o
     * status derivado difere do atual. Nao atua em lotes em {@code quarentena}
     * (a propria derivacao ja preserva o valor, mas mantemos o guard explicito
     * para deixar a intencao clara no call-site).
     *
     * Quando ha transicao efetiva, registra um log de auditoria (acao
     * {@link #AUDIT_ACTION_STATUS_DERIVED}) com o {@code trigger} que originou
     * a mudanca. Transicoes no-op (derivado == atual) nao sao logadas para
     * evitar poluicao do audit_log.
     *
     * @param trigger origem semantica: {@link #AUDIT_TRIGGER_CREATE_LOT},
     *                {@link #AUDIT_TRIGGER_UPDATE_LOT},
     *                {@link #AUDIT_TRIGGER_MOVEMENT} ou
     *                {@link #AUDIT_TRIGGER_SCHEDULER}.
     */
    private void applyDerivedStatus(ReagentLot lot, LocalDate today, String trigger) {
        if (lot == null) return;
        String oldStatus = lot.getStatus();
        if (ReagentStatus.QUARENTENA.equals(oldStatus)) {
            // Preservacao manual — quarentena nao e sobrescrita por derivacao
            // nem gera log (nao ha transicao).
            return;
        }
        String derived = deriveStatus(lot, today);
        if (Objects.equals(oldStatus, derived)) {
            // Sem transicao efetiva: nao logar (evita ruido em audit_log).
            return;
        }
        lot.setStatus(derived);
        recordStatusTransition(lot, oldStatus, derived, trigger);
    }

    /**
     * Aplicacao invocada pelo scheduler: alem de mutar o status, tambem registra
     * o log de auditoria com {@code trigger="scheduler"}. Retorna {@code true}
     * se houve transicao efetiva (usado pelo scheduler para decidir se adiciona
     * o lote ao batch de saveAll).
     *
     * Exposto como publico para que {@code ReagentExpiryScheduler} consuma a
     * mesma regra — evita duplicar a derivacao/log em dois lugares.
     */
    public boolean applyDerivedStatusFromScheduler(ReagentLot lot, LocalDate today) {
        if (lot == null) return false;
        String oldStatus = lot.getStatus();
        if (ReagentStatus.QUARENTENA.equals(oldStatus)) {
            return false;
        }
        String derived = deriveStatus(lot, today);
        if (Objects.equals(oldStatus, derived)) {
            return false;
        }
        lot.setStatus(derived);
        recordStatusTransition(lot, oldStatus, derived, AUDIT_TRIGGER_SCHEDULER);
        return true;
    }

    /**
     * Emite um AuditLog de transicao de status. Isolado para centralizar o shape
     * dos {@code details} (comparavel entre triggers) e permitir testes uniformes.
     */
    private void recordStatusTransition(ReagentLot lot, String from, String to, String trigger) {
        // HashMap (e nao Map.of) porque {@code from} pode vir nulo em lotes recem
        // criados que nasceram com status derivado (validade passada no createLot).
        Map<String, Object> details = new HashMap<>();
        details.put("from", from);
        details.put("to", to);
        details.put("trigger", trigger);
        details.put("expiryDate", String.valueOf(lot.getExpiryDate()));
        details.put("currentStock", String.valueOf(lot.getCurrentStock()));
        auditService.log(
            AUDIT_ACTION_STATUS_DERIVED,
            "ReagentLot",
            lot.getId(),
            details
        );
    }

    /**
     * Normaliza e valida o status. Retorna o valor canonico ou lanca BusinessException
     * com a lista de valores permitidos. Se input vier vazio, usa o fallback.
     */
    private String resolveStatus(String raw, String fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        String normalized = ReagentStatus.normalize(raw);
        if (!ReagentStatus.isValid(normalized)) {
            throw new BusinessException(
                "Status de lote inválido. Valores aceitos: " + ReagentStatus.humanList());
        }
        return normalized;
    }
}

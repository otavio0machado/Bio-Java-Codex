package com.biodiagnostico.service;

import com.biodiagnostico.dto.request.ReagentLotRequest;
import com.biodiagnostico.dto.request.StockMovementRequest;
import com.biodiagnostico.dto.response.ReagentLabelSummary;
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

    /** Janela para considerar um lote "ativo em CQ" (rastreabilidade Fase 3). */
    private static final int QC_ACTIVE_WINDOW_DAYS = 30;

    /**
     * Lista canonica de categorias de reagente.
     *
     * <p>MUST mirror {@code biodiagnostico-web/src/components/proin/reagentes/constants.ts}
     * (CATEGORIES). Drift entre as duas listas quebra cadastro com 400. Se mudar aqui,
     * mude la — e tambem em {@link com.biodiagnostico.service.reports.v2.catalog.ReportDefinitionRegistry#REAGENT_CATEGORIES}.
     *
     * <p>Origem da decisao: refator-reagentes-v2 G-01 (qa-review). Fonte canonica = frontend
     * porque (a) preserva dados historicos no banco ({@code storage_temp} VARCHAR ja contem
     * estes literais), (b) UI e a interface humana e (c) alinhar reverse e mudanca contida.
     * Ordem preservada para casamento literal com o dropdown.
     */
    static final List<String> ALLOWED_CATEGORIES = List.of(
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

    /**
     * Lista canonica de temperaturas de armazenamento.
     *
     * <p>MUST mirror {@code biodiagnostico-web/src/components/proin/reagentes/constants.ts}
     * (TEMPS). Strings com sufixo {@code °C} e parenteses sao a forma legivel para o
     * usuario do laboratorio e ja sao o formato persistido. Drift quebra cadastro com 400.
     *
     * <p>Origem da decisao: refator-reagentes-v2 G-02 (qa-review).
     */
    static final List<String> ALLOWED_STORAGE_TEMPS = List.of(
        "2-8°C",
        "15-25°C (Ambiente)",
        "-20°C",
        "-80°C"
    );

    // Acoes de auditoria (regulatorio ANVISA RDC 302 / ISO 15189). Transicoes automaticas
    // de status sao registradas em audit_log para rastreabilidade externa. Chamadas
    // diretas deste service a AuditService cobrem mudancas originadas em fluxos
    // operacionais (create/update/move); o scheduler registra suas proprias transicoes
    // em trigger="scheduler".
    public static final String AUDIT_ACTION_STATUS_DERIVED = "REAGENT_STATUS_DERIVED";
    public static final String AUDIT_ACTION_MOVEMENT_BLOCKED = "REAGENT_MOVEMENT_BLOCKED";
    public static final String AUDIT_ACTION_LOT_ARCHIVED = "REAGENT_LOT_ARCHIVED";
    public static final String AUDIT_ACTION_DELETE_BLOCKED = "REAGENT_DELETE_BLOCKED";
    /**
     * Action distinta para backfill administrativo de {@code openedDate} (audit ressalva 1.7).
     *
     * <p>Disparada quando {@link #applyOpenedDateOnUseTransition} grava {@code openedDate=today}
     * em um fluxo de UPDATE administrativo (admin marcou {@code em_uso} sem informar a
     * data de abertura). Para CREATE e movimentos (ENTRADA em {@code fora_de_estoque}, etc),
     * o backfill ocorre dentro do mesmo audit {@code REAGENT_STATUS_DERIVED} — apenas em
     * UPDATE pedimos action separada para o auditor distinguir abertura natural vs
     * preenchimento administrativo (RDC 302 art. 60).</p>
     */
    public static final String AUDIT_ACTION_OPENED_DATE_BACKFILLED = "REAGENT_OPENED_DATE_BACKFILLED";

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
        if (normalizedStatus != null && !ReagentStatus.isValid(normalizedStatus)) {
            // Defesa anti-status-legado (contrato 4.3): rejeita explicitamente valores antigos
            // para que clientes desatualizados aprendam o novo dominio.
            throw new BusinessException(
                "Status legado nao suportado. Use: " + ReagentStatus.humanList());
        }

        List<ReagentLot> lots = reagentLotRepository.findByFilters(normalizedCategory, normalizedStatus);

        // Descobre quais lotes apareceram em CQ recente em uma unica query.
        Set<String> activeInQc = lotNumbersUsedInQcRecently(lots);
        // QcRecord guarda apenas lotNumber (sem manufacturer). Se dois ReagentLot
        // compartilham o mesmo lotNumber (fabricantes distintos), a flag usedInQcRecently
        // ficaria ambigua. Politica conservadora: nao marcar nenhum dos lotes em colisao.
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
        validateCategoryAndTemp(request);
        // Pre-check de unicidade (lotNumber, manufacturer) simetrico ao updateLot.
        if (!reagentLotRepository
                .findByLotNumberAndManufacturer(request.lotNumber(), request.manufacturer())
                .isEmpty()) {
            throw new BusinessException("Já existe um lote com este número e fabricante");
        }
        String status = resolveStatus(request.status(), ReagentStatus.EM_ESTOQUE);
        // Trim defensivo na label antes de salvar — protege contra capitalizacao acidental
        // ("  Glicose  " vs "Glicose"). Frontend ja faz mas backend nao confia.
        String label = request.label() == null ? null : request.label().trim();
        ReagentLot lot = ReagentLot.builder()
            .name(label)
            .lotNumber(request.lotNumber())
            .manufacturer(request.manufacturer())
            .category(request.category())
            .expiryDate(request.expiryDate())
            .currentStock(NumericUtils.defaultIfNull(request.currentStock()))
            .storageTemp(request.storageTemp())
            .status(status)
            .location(request.location())
            .supplier(request.supplier())
            .receivedDate(request.receivedDate())
            .openedDate(request.openedDate())
            .build();
        // Forcing rule (contrato 4.1): expiry < hoje sempre reclassifica para vencido,
        // ignorando o status do request. Aplicado ANTES de applyDerivedStatus para que
        // a auditoria registre a transicao "tentativa do usuario" -> "vencido".
        LocalDate today = LocalDate.now();
        if (request.expiryDate() != null && request.expiryDate().isBefore(today)) {
            lot.setStatus(ReagentStatus.VENCIDO);
        } else if (ReagentStatus.EM_USO.equals(status) && lot.getOpenedDate() == null) {
            // Decisao 1.7: cadastro com em_uso sem openedDate forca openedDate=today.
            lot.setOpenedDate(today);
        }
        // Derivacao automatica converge o status final com o estado real do lote (estoque,
        // validade, abertura). Se cliente pediu em_estoque com estoque=0, vira fora_de_estoque.
        applyDerivedStatus(lot, today, AUDIT_TRIGGER_CREATE_LOT);
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
        validateCategoryAndTemp(request);
        // Reverifica unicidade (lotNumber, manufacturer) antes de salvar.
        List<ReagentLot> conflicts = reagentLotRepository.findByLotNumberAndManufacturer(
            request.lotNumber(), request.manufacturer());
        boolean conflict = conflicts.stream().anyMatch(other -> !other.getId().equals(id));
        if (conflict) {
            throw new BusinessException("Já existe um lote com este número e fabricante");
        }

        String label = request.label() == null ? null : request.label().trim();
        lot.setName(label);
        lot.setLotNumber(request.lotNumber());
        lot.setManufacturer(request.manufacturer());
        lot.setCategory(request.category());
        lot.setExpiryDate(request.expiryDate());
        lot.setCurrentStock(NumericUtils.defaultIfNull(request.currentStock()));
        lot.setStorageTemp(request.storageTemp());
        if (request.status() != null && !request.status().isBlank()) {
            lot.setStatus(resolveStatus(request.status(), lot.getStatus()));
        }
        // Decisao 1.7 (reciproca): nunca apaga openedDate no UPDATE. "Aberto" e historico forte.
        // Atualiza openedDate apenas se o request enviar valor explicito (incluindo null que
        // o usuario quis manter — interpretamos como "nao tocar" se nulo, sobrepor se nao-nulo).
        // Logica defensiva: se request trouxer openedDate nao-nulo, atualiza.
        if (request.openedDate() != null) {
            lot.setOpenedDate(request.openedDate());
        }
        // Campos opcionais — aceitam override explicito (incluindo null para limpar).
        lot.setLocation(request.location());
        lot.setSupplier(request.supplier());
        lot.setReceivedDate(request.receivedDate());
        // Forcing rule: expiry < hoje sempre reclassifica para vencido (mesmo em UPDATE).
        LocalDate today = LocalDate.now();
        if (request.expiryDate() != null && request.expiryDate().isBefore(today)) {
            lot.setStatus(ReagentStatus.VENCIDO);
        } else {
            // Backfill administrativo: admin pediu em_uso e o lote nao tem openedDate.
            // Audit ressalva 1.7 — usa action distinta para UPDATE administrativo.
            applyOpenedDateOnUseTransition(lot, today, AUDIT_TRIGGER_UPDATE_LOT);
        }
        // Derivacao automatica converge.
        applyDerivedStatus(lot, today, AUDIT_TRIGGER_UPDATE_LOT);
        try {
            return reagentLotRepository.save(lot);
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("Já existe um lote com este número e fabricante");
        }
    }

    @Transactional
    public void deleteLot(UUID id) {
        ReagentLot lot = reagentLotRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Lote de reagente não encontrado"));

        boolean hasStockMovements = stockMovementRepository.existsByReagentLotId(id);
        boolean usedInQc = hasOperationalQcUsage(lot);
        if (!hasStockMovements && !usedInQc) {
            reagentLotRepository.deleteById(id);
            return;
        }

        double currentStock = NumericUtils.defaultIfNull(lot.getCurrentStock());
        if (currentStock > 0) {
            Map<String, Object> details = new HashMap<>();
            details.put("reason", "historico_ou_cq_com_estoque");
            details.put("currentStock", String.valueOf(currentStock));
            details.put("hasStockMovements", hasStockMovements);
            details.put("usedInQc", usedInQc);
            auditService.log(AUDIT_ACTION_DELETE_BLOCKED, "ReagentLot", lot.getId(), details);
            throw new BusinessException(
                "Lote com histórico ou uso em CQ não pode ser removido com estoque atual. Zere o estoque antes de arquivar.");
        }

        // Arquivamento logico — refator-v2 substitui o antigo INATIVO por FORA_DE_ESTOQUE
        // como destino terminal. Compliance preservada (mesma action, novo to-status).
        if (!ReagentStatus.FORA_DE_ESTOQUE.equals(lot.getStatus())) {
            String oldStatus = lot.getStatus();
            lot.setStatus(ReagentStatus.FORA_DE_ESTOQUE);
            reagentLotRepository.save(lot);
            Map<String, Object> details = new HashMap<>();
            details.put("from", oldStatus);
            details.put("to", ReagentStatus.FORA_DE_ESTOQUE);
            details.put("hasStockMovements", hasStockMovements);
            details.put("usedInQc", usedInQc);
            auditService.log(AUDIT_ACTION_LOT_ARCHIVED, "ReagentLot", lot.getId(), details);
        }
    }

    private boolean hasOperationalQcUsage(ReagentLot lot) {
        String lotNumber = lot.getLotNumber();
        return lotNumber != null
            && !lotNumber.isBlank()
            && qcRecordRepository.existsByLotNumberOperational(lotNumber);
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

        // Bloqueio canonico (decisao 1.8): apenas vencido nao recebe ENTRADA. fora_de_estoque
        // ACEITA ENTRADA — esse e o ponto: a entrada retorna o lote para em_uso via derivacao.
        if (ReagentStatus.VENCIDO.equals(lot.getStatus()) && MovementType.ENTRADA.equals(type)) {
            // Audit ressalva regulatoria (RDC 302 art. 49): tentativa de reaproveitar lote
            // vencido deve ficar registrada para auditoria externa.
            Map<String, Object> blockedDetails = new HashMap<>();
            blockedDetails.put("reason", "lote_vencido");
            blockedDetails.put("movementType", MovementType.ENTRADA);
            auditService.log(
                AUDIT_ACTION_MOVEMENT_BLOCKED,
                "ReagentLot",
                lot.getId(),
                blockedDetails
            );
            throw new BusinessException(
                "Lote vencido nao aceita nova entrada. Crie um novo lote.");
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

        // Reativacao de fora_de_estoque por ENTRADA/AJUSTE (decisao 5.6 / matriz 4.7).
        // Quando o lote estava em fora_de_estoque e o movimento eleva o estoque acima de
        // zero, marcamos openedDate=today (se ainda nulo) ANTES da derivacao para que
        // deriveStatus retorne em_uso (a regra ternaria distingue em_uso vs em_estoque
        // por openedDate). Isso modela o ato operacional de "abrir um frasco novo do
        // mesmo lote" sem precisar de UPDATE administrativo.
        boolean estavaForaDeEstoque = ReagentStatus.FORA_DE_ESTOQUE.equals(lot.getStatus());
        boolean reativaEstoque = nextStock > 0
            && (MovementType.ENTRADA.equals(type) || MovementType.AJUSTE.equals(type));
        LocalDate today = LocalDate.now();
        if (estavaForaDeEstoque && reativaEstoque && lot.getOpenedDate() == null) {
            lot.setOpenedDate(today);
        }

        lot.setCurrentStock(nextStock);
        // Derivacao automatica pos-movimento. Casos canonicos novos:
        //  - ENTRADA em fora_de_estoque -> em_uso (decisao 5.6)
        //  - SAIDA total em em_estoque/em_uso -> fora_de_estoque
        //  - AJUSTE positivo em fora_de_estoque -> em_uso
        applyDerivedStatus(lot, today, AUDIT_TRIGGER_MOVEMENT);
        reagentLotRepository.save(lot);
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

    /**
     * Endpoint canonico do refator-v2: lista resumos por etiqueta. Substitui
     * {@link #getTagSummaries()} no contrato externo.
     */
    @Transactional(readOnly = true)
    public List<ReagentLabelSummary> getLabelSummaries() {
        return reagentLotRepository.findLabelSummaries().stream()
            .map(p -> new ReagentLabelSummary(
                p.getLabel(),
                p.getTotal(),
                p.getEmEstoque(),
                p.getEmUso(),
                p.getForaDeEstoque(),
                p.getVencidos()
            ))
            .toList();
    }

    /**
     * Alias deprecated — espelha {@link #getLabelSummaries()} mapeando para o shape antigo
     * {@link ReagentTagSummary}. Servido pelo endpoint {@code /api/reagents/tags} apenas
     * por compatibilidade temporaria com integradores externos. Removido em PR-4.
     */
    @Transactional(readOnly = true)
    public List<ReagentTagSummary> getTagSummaries() {
        return reagentLotRepository.findLabelSummaries().stream()
            .map(p -> new ReagentTagSummary(
                p.getName(),
                p.getTotal(),
                // Mapeamento de compatibilidade do shape antigo (refator-v2 substitui semanticamente):
                //   ativos    <- emEstoque (lotes ativos com estoque, sem abertura)
                //   emUso     <- emUso
                //   inativos  <- foraDeEstoque (lotes terminais — substitui o antigo INATIVO)
                //   vencidos  <- vencidos
                p.getEmEstoque(),
                p.getEmUso(),
                p.getForaDeEstoque(),
                p.getVencidos()
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
     * Cross-field: receivedDate <= openedDate <= expiryDate (quando ambas presentes).
     * @NotNull/@NotBlank cobrem obrigatoriedade no DTO.
     */
    private void validateLotDates(ReagentLotRequest request) {
        if (request.expiryDate() != null && request.openedDate() != null
            && request.openedDate().isAfter(request.expiryDate())) {
            throw new BusinessException(
                "A data de abertura não pode ser posterior à data de validade.");
        }
        if (request.openedDate() != null && request.receivedDate() != null
            && request.receivedDate().isAfter(request.openedDate())) {
            throw new BusinessException(
                "A data de recebimento não pode ser posterior à data de abertura.");
        }
        if (request.expiryDate() != null && request.receivedDate() != null
            && request.receivedDate().isAfter(request.expiryDate())) {
            throw new BusinessException(
                "A data de recebimento não pode ser posterior à data de validade.");
        }
    }

    private void validateCategoryAndTemp(ReagentLotRequest request) {
        if (request.category() != null && !request.category().isBlank()
            && !ALLOWED_CATEGORIES.contains(request.category().trim())) {
            throw new BusinessException(
                "Categoria invalida. Valores aceitos: " + String.join(", ", ALLOWED_CATEGORIES));
        }
        if (request.storageTemp() != null && !request.storageTemp().isBlank()
            && !ALLOWED_STORAGE_TEMPS.contains(request.storageTemp().trim())) {
            throw new BusinessException(
                "Temperatura de armazenamento invalida. Valores aceitos: "
                    + String.join(", ", ALLOWED_STORAGE_TEMPS));
        }
    }

    /**
     * Regra ternaria canonica do refator-v2 (contrato 5.1):
     *
     * <ol>
     *   <li>{@code expiryDate < today} (qualquer estoque/abertura) — {@code vencido}</li>
     *   <li>{@code stock <= 0} — {@code fora_de_estoque}</li>
     *   <li>{@code openedDate != null} — {@code em_uso}</li>
     *   <li>caso contrario — {@code em_estoque}</li>
     * </ol>
     *
     * <p>Defesa: se {@code expiryDate} for nulo (cenario impossivel apos V13 NOT NULL,
     * mas teste protege), retorna o status atual sem alterar.</p>
     */
    public String deriveStatus(ReagentLot lot, LocalDate today) {
        if (lot == null) {
            return null;
        }
        LocalDate expiry = lot.getExpiryDate();
        if (expiry == null) {
            return lot.getStatus();
        }
        if (expiry.isBefore(today)) {
            return ReagentStatus.VENCIDO;
        }
        double stock = NumericUtils.defaultIfNull(lot.getCurrentStock());
        if (stock <= 0) {
            return ReagentStatus.FORA_DE_ESTOQUE;
        }
        if (lot.getOpenedDate() != null) {
            return ReagentStatus.EM_USO;
        }
        return ReagentStatus.EM_ESTOQUE;
    }

    /**
     * Aplica {@link #deriveStatus(ReagentLot, LocalDate)} mutando o lote quando o status
     * derivado difere do atual. Quando o status final e {@code em_uso} e o lote nao tem
     * {@code openedDate}, dispara o backfill (audit ressalva 1.7) — a action de auditoria
     * difere conforme o trigger:
     *
     * <ul>
     *   <li>{@code createLot}: openedDate vai com o REAGENT_STATUS_DERIVED principal.</li>
     *   <li>{@code movement}: idem (entrada em fora_de_estoque -> em_uso).</li>
     *   <li>{@code updateLot}: o backfill ja foi feito ANTES desta chamada via
     *       {@link #applyOpenedDateOnUseTransition} para emitir REAGENT_OPENED_DATE_BACKFILLED
     *       em audit_log (separa abertura administrativa de abertura natural).</li>
     * </ul>
     *
     * <p>Transicoes no-op (derivado == atual) nao sao logadas para evitar ruido.</p>
     */
    private void applyDerivedStatus(ReagentLot lot, LocalDate today, String trigger) {
        if (lot == null) return;
        String oldStatus = lot.getStatus();
        String derived = deriveStatus(lot, today);
        if (Objects.equals(oldStatus, derived)) {
            return;
        }
        lot.setStatus(derived);
        // Set openedDate quando o status final for em_uso e ainda nao houver. Para CREATE
        // e MOVEMENT a marcacao acompanha REAGENT_STATUS_DERIVED. Para UPDATE, o backfill
        // ja deve ter ocorrido antes desta chamada — defesa: nao re-emite audit aqui.
        if (ReagentStatus.EM_USO.equals(derived)
            && lot.getOpenedDate() == null
            && !AUDIT_TRIGGER_UPDATE_LOT.equals(trigger)) {
            lot.setOpenedDate(today);
        }
        recordStatusTransition(lot, oldStatus, derived, trigger);
    }

    /**
     * Backfill administrativo: dispara o set de {@code openedDate=today} quando o status
     * final SERA {@code em_uso} e {@code openedDate} esta nulo. Para o caminho de UPDATE,
     * chama {@link AuditService} com action distinta {@link #AUDIT_ACTION_OPENED_DATE_BACKFILLED}
     * (audit ressalva 1.7).
     *
     * <p>Esta funcao deve ser chamada ANTES de {@link #applyDerivedStatus} no fluxo de
     * UPDATE para que o derivado ja conte com {@code openedDate} setada.</p>
     */
    private void applyOpenedDateOnUseTransition(ReagentLot lot, LocalDate today, String trigger) {
        if (lot == null) return;
        if (lot.getOpenedDate() != null) return;
        String fromStatus = lot.getStatus();
        // Decide se o status final sera em_uso. Replica a logica de deriveStatus mas sem
        // assumir que openedDate ja foi setado (esta sendo definido AGORA).
        LocalDate expiry = lot.getExpiryDate();
        if (expiry == null || expiry.isBefore(today)) {
            return; // vencido (ou indefinido) — nao marca abertura
        }
        double stock = NumericUtils.defaultIfNull(lot.getCurrentStock());
        if (stock <= 0) {
            return; // fora_de_estoque — nao marca abertura
        }
        // O usuario pediu em_uso explicitamente? Se sim, o backfill e administrativo.
        // Caso contrario (em_estoque pedido + estoque > 0 + opened nulo), o derivado
        // sera em_estoque e nao precisamos marcar.
        if (!ReagentStatus.EM_USO.equals(lot.getStatus())) {
            return;
        }
        lot.setOpenedDate(today);
        if (AUDIT_TRIGGER_UPDATE_LOT.equals(trigger)) {
            // Action distinta para UPDATE administrativo (audit 1.7).
            Map<String, Object> details = new HashMap<>();
            details.put("openedDate", String.valueOf(today));
            details.put("fromStatus", fromStatus);
            details.put("toStatus", ReagentStatus.EM_USO);
            details.put("trigger", AUDIT_TRIGGER_UPDATE_LOT);
            auditService.log(
                AUDIT_ACTION_OPENED_DATE_BACKFILLED,
                "ReagentLot",
                lot.getId(),
                details
            );
        }
        // Para createLot/movement, o backfill viaja junto do REAGENT_STATUS_DERIVED.
    }

    /**
     * Aplicacao invocada pelo scheduler: alem de mutar o status, tambem registra
     * o log de auditoria com {@code trigger="scheduler"}. Retorna {@code true}
     * se houve transicao efetiva (usado pelo scheduler para decidir se adiciona
     * o lote ao batch de saveAll).
     */
    public boolean applyDerivedStatusFromScheduler(ReagentLot lot, LocalDate today) {
        if (lot == null) return false;
        String oldStatus = lot.getStatus();
        String derived = deriveStatus(lot, today);
        if (Objects.equals(oldStatus, derived)) {
            return false;
        }
        lot.setStatus(derived);
        // Scheduler nao faz backfill administrativo de openedDate — derivacao puramente
        // mecanica. Se virou em_uso e openedDate=null (pouco provavel apos V13), apenas
        // registra a transicao sem set automatico (preserva o sinal de "abertura nao registrada").
        recordStatusTransition(lot, oldStatus, derived, AUDIT_TRIGGER_SCHEDULER);
        return true;
    }

    /**
     * Emite um AuditLog de transicao de status. Isolado para centralizar o shape
     * dos {@code details} (comparavel entre triggers) e permitir testes uniformes.
     */
    private void recordStatusTransition(ReagentLot lot, String from, String to, String trigger) {
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

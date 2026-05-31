package com.biodiagnostico.service;

import com.biodiagnostico.dto.request.ImmunologyControlItemRequest;
import com.biodiagnostico.dto.request.ImmunologyControlSetRequest;
import com.biodiagnostico.dto.request.ImmunologyRunRequest;
import com.biodiagnostico.dto.request.ImmunologyRunResultRequest;
import com.biodiagnostico.dto.response.ImmunologyControlItemResponse;
import com.biodiagnostico.dto.response.ImmunologyControlSetResponse;
import com.biodiagnostico.dto.response.ImmunologyRunResponse;
import com.biodiagnostico.dto.response.ImmunologyRunResultResponse;
import com.biodiagnostico.entity.ImmunologyControlItem;
import com.biodiagnostico.entity.ImmunologyControlSet;
import com.biodiagnostico.entity.ImmunologyQcRun;
import com.biodiagnostico.entity.ImmunologyQcRunResult;
import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.exception.ResourceNotFoundException;
import com.biodiagnostico.repository.ImmunologyControlSetRepository;
import com.biodiagnostico.repository.ImmunologyQcRunRepository;
import com.biodiagnostico.repository.ReagentLotRepository;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ImmunologyQcService {

    public static final String RESULT_REAGENTE = "REAGENTE";
    public static final String RESULT_NAO_REAGENTE = "NAO_REAGENTE";
    private static final Set<String> ALLOWED_RESULTS = Set.of(RESULT_REAGENTE, RESULT_NAO_REAGENTE);

    private final ImmunologyControlSetRepository controlSetRepository;
    private final ImmunologyQcRunRepository runRepository;
    private final ReagentLotRepository reagentLotRepository;

    public ImmunologyQcService(
        ImmunologyControlSetRepository controlSetRepository,
        ImmunologyQcRunRepository runRepository,
        ReagentLotRepository reagentLotRepository
    ) {
        this.controlSetRepository = controlSetRepository;
        this.runRepository = runRepository;
        this.reagentLotRepository = reagentLotRepository;
    }

    @Transactional(readOnly = true)
    public List<ImmunologyControlSetResponse> getControlSets(String analito) {
        return getControlSets(analito, false);
    }

    @Transactional(readOnly = true)
    public List<ImmunologyControlSetResponse> getControlSets(String analito, boolean includeInactive) {
        List<ImmunologyControlSet> controlSets = (analito == null || analito.isBlank())
            ? (includeInactive
                ? controlSetRepository.findAllByOrderByIsActiveDescAnalitoAscManufacturerAscLotNumberAsc()
                : controlSetRepository.findByIsActiveTrueOrderByAnalitoAscManufacturerAscLotNumberAsc())
            : (includeInactive
                ? controlSetRepository.findByAnalitoIgnoreCaseOrderByIsActiveDescCreatedAtDesc(analito.trim())
                : controlSetRepository.findByAnalitoIgnoreCaseAndIsActiveTrueOrderByCreatedAtDesc(analito.trim()));
        return controlSets.stream().map(this::toControlSetResponse).toList();
    }

    @Transactional
    public ImmunologyControlSetResponse createControlSet(ImmunologyControlSetRequest request) {
        validateNaturalKey(null, request);
        ImmunologyControlSet controlSet = ImmunologyControlSet.builder()
            .analito(normalizeAnalito(request.analito()))
            .manufacturer(normalizeRequired(request.manufacturer(), "Fabricante/marca é obrigatório."))
            .lotNumber(normalizeRequired(request.lotNumber(), "Lote é obrigatório."))
            .validUntil(request.validUntil())
            .isActive(Boolean.TRUE)
            .build();
        replaceControls(controlSet, request.controls());
        return toControlSetResponse(controlSetRepository.save(controlSet));
    }

    @Transactional
    public ImmunologyControlSetResponse updateControlSet(UUID id, ImmunologyControlSetRequest request) {
        ImmunologyControlSet controlSet = controlSetRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Controle de imunologia não encontrado"));
        if (!Boolean.TRUE.equals(controlSet.getIsActive())) {
            throw new BusinessException("Controle de imunologia inativo não pode ser editado.");
        }
        validateNaturalKey(id, request);
        controlSet.setAnalito(normalizeAnalito(request.analito()));
        controlSet.setManufacturer(normalizeRequired(request.manufacturer(), "Fabricante/marca é obrigatório."));
        controlSet.setLotNumber(normalizeRequired(request.lotNumber(), "Lote é obrigatório."));
        controlSet.setValidUntil(request.validUntil());
        replaceControls(controlSet, request.controls());
        return toControlSetResponse(controlSetRepository.save(controlSet));
    }

    @Transactional
    public void deactivateControlSet(UUID id) {
        ImmunologyControlSet controlSet = controlSetRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Controle de imunologia não encontrado"));
        controlSet.setIsActive(Boolean.FALSE);
        controlSetRepository.save(controlSet);
    }

    @Transactional(readOnly = true)
    public List<ImmunologyRunResponse> getRuns(
        String analito,
        UUID controlSetId,
        LocalDate startDate,
        LocalDate endDate
    ) {
        List<ImmunologyQcRun> runs;
        if (controlSetId != null) {
            runs = runRepository.findByControlSetIdOrderByDataMedicaoDescCreatedAtDesc(controlSetId);
        } else if (startDate != null && endDate != null) {
            runs = runRepository.findByDataMedicaoBetweenOrderByDataMedicaoDescCreatedAtDesc(startDate, endDate);
        } else {
            runs = runRepository.findAllByOrderByDataMedicaoDescCreatedAtDesc();
        }
        return runs.stream()
            .filter(run -> analito == null || analito.isBlank() || run.getAnalitoSnapshot().equalsIgnoreCase(analito.trim()))
            .filter(run -> startDate == null || !run.getDataMedicao().isBefore(startDate))
            .filter(run -> endDate == null || !run.getDataMedicao().isAfter(endDate))
            .map(this::toRunResponse)
            .toList();
    }

    @Transactional
    public ImmunologyRunResponse createRun(ImmunologyRunRequest request) {
        ReagentLot reagentLot = reagentLotRepository.findById(request.reagentLotId())
            .orElseThrow(() -> new ResourceNotFoundException("Reagente de imunologia não encontrado"));
        ImmunologyControlSet controlSet = controlSetRepository.findById(request.controlSetId())
            .orElseThrow(() -> new ResourceNotFoundException("Controle de imunologia não encontrado"));
        validateReagentForRun(reagentLot, controlSet, request.dataMedicao());
        if (!Boolean.TRUE.equals(controlSet.getIsActive())) {
            throw new BusinessException("Controle de imunologia inativo não pode receber nova análise.");
        }
        if (controlSet.getValidUntil().isBefore(request.dataMedicao())) {
            throw new BusinessException("Controle de imunologia vencido na data da análise.");
        }

        Map<UUID, ImmunologyRunResultRequest> resultsByItemId = mapResultsByItem(request.results());
        if (resultsByItemId.size() != controlSet.getControls().size()) {
            throw new BusinessException("Informe resultado observado para todos os controles cadastrados.");
        }

        ImmunologyQcRun run = ImmunologyQcRun.builder()
            .controlSet(controlSet)
            .reagentLot(reagentLot)
            .dataMedicao(request.dataMedicao())
            .analitoSnapshot(controlSet.getAnalito())
            .manufacturerSnapshot(controlSet.getManufacturer())
            .lotNumberSnapshot(controlSet.getLotNumber())
            .validUntilSnapshot(controlSet.getValidUntil())
            .reagentLabelSnapshot(reagentLot.getName())
            .reagentManufacturerSnapshot(reagentLot.getManufacturer())
            .reagentLotNumberSnapshot(reagentLot.getLotNumber())
            .reagentValidUntilSnapshot(reagentLot.getExpiryDate())
            .reagentStatusSnapshot(reagentLot.getStatus())
            .reagentUnitsInStockSnapshot(reagentLot.getUnitsInStock())
            .reagentUnitsInUseSnapshot(reagentLot.getUnitsInUse())
            .reagentStorageTempSnapshot(reagentLot.getStorageTemp())
            .reagentLocationSnapshot(reagentLot.getLocation())
            .analyst(normalizeNullable(request.analyst()))
            .notes(normalizeNullable(request.notes()))
            .status("APROVADO")
            .build();

        boolean approved = true;
        for (ImmunologyControlItem item : controlSet.getControls()) {
            ImmunologyRunResultRequest resultRequest = resultsByItemId.get(item.getId());
            if (resultRequest == null) {
                throw new BusinessException("Resultado observado não pertence ao controle cadastrado informado.");
            }
            String observed = normalizeResult(resultRequest.observedResult());
            String status = item.getExpectedResult().equals(observed) ? "APROVADO" : "REPROVADO";
            if ("REPROVADO".equals(status)) {
                approved = false;
            }
            run.getResults().add(ImmunologyQcRunResult.builder()
                .run(run)
                .controlItem(item)
                .controlNameSnapshot(item.getName())
                .expectedResultSnapshot(item.getExpectedResult())
                .observedResult(observed)
                .status(status)
                .displayOrder(item.getDisplayOrder())
                .build());
        }
        run.setStatus(approved ? "APROVADO" : "REPROVADO");
        return toRunResponse(runRepository.save(run));
    }

    @Transactional
    public void deleteRun(UUID id) {
        ImmunologyQcRun run = runRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Análise de imunologia não encontrada"));
        runRepository.delete(run);
    }

    private void validateReagentForRun(ReagentLot reagentLot, ImmunologyControlSet controlSet, LocalDate dataMedicao) {
        if (!"Imunologia".equalsIgnoreCase(normalizeRequired(reagentLot.getCategory(), "Categoria do reagente é obrigatória."))) {
            throw new BusinessException("Selecione um reagente da categoria Imunologia.");
        }
        if ("inativo".equalsIgnoreCase(reagentLot.getStatus()) || "vencido".equalsIgnoreCase(reagentLot.getStatus())) {
            throw new BusinessException("Reagente inativo ou vencido não pode ser usado em análise de imunologia.");
        }
        if (reagentLot.getExpiryDate() != null && reagentLot.getExpiryDate().isBefore(dataMedicao)) {
            throw new BusinessException("Reagente vencido na data da análise.");
        }
        if (!normalizeComparable(reagentLot.getName()).equals(normalizeComparable(controlSet.getAnalito()))) {
            throw new BusinessException("O soro-controle selecionado não pertence ao analito do reagente.");
        }
    }

    private void validateNaturalKey(UUID currentId, ImmunologyControlSetRequest request) {
        String analito = normalizeAnalito(request.analito());
        String manufacturer = normalizeRequired(request.manufacturer(), "Fabricante/marca é obrigatório.");
        String lotNumber = normalizeRequired(request.lotNumber(), "Lote é obrigatório.");
        boolean duplicate = controlSetRepository.findByAnalitoIgnoreCaseAndIsActiveTrueOrderByCreatedAtDesc(analito).stream()
            .anyMatch(item -> !item.getId().equals(currentId)
                && item.getManufacturer().equalsIgnoreCase(manufacturer)
                && item.getLotNumber().equalsIgnoreCase(lotNumber));
        if (duplicate) {
            throw new BusinessException("Já existe controle ativo para este analito, fabricante/marca e lote.");
        }
    }

    private void replaceControls(ImmunologyControlSet controlSet, List<ImmunologyControlItemRequest> controls) {
        if (controls == null || controls.isEmpty()) {
            throw new BusinessException("Cadastre ao menos um controle esperado.");
        }
        Set<String> names = new HashSet<>();
        controlSet.getControls().clear();
        for (int index = 0; index < controls.size(); index++) {
            ImmunologyControlItemRequest request = controls.get(index);
            String name = normalizeRequired(request.name(), "Nome do controle é obrigatório.");
            if (!names.add(name.toLowerCase(Locale.ROOT))) {
                throw new BusinessException("Não repita o nome do controle no mesmo lote.");
            }
            controlSet.getControls().add(ImmunologyControlItem.builder()
                .controlSet(controlSet)
                .name(name)
                .expectedResult(normalizeResult(request.expectedResult()))
                .displayOrder(index + 1)
                .build());
        }
    }

    private Map<UUID, ImmunologyRunResultRequest> mapResultsByItem(List<ImmunologyRunResultRequest> results) {
        Map<UUID, ImmunologyRunResultRequest> mapped = new HashMap<>();
        for (ImmunologyRunResultRequest result : results) {
            if (mapped.put(result.controlItemId(), result) != null) {
                throw new BusinessException("Resultado observado duplicado para o mesmo controle.");
            }
        }
        return mapped;
    }

    private String normalizeResult(String value) {
        String normalized = stripAccents(value)
            .trim()
            .toUpperCase(Locale.ROOT)
            .replace("-", "_")
            .replace(" ", "_");
        if ("R".equals(normalized) || RESULT_REAGENTE.equals(normalized)) {
            return RESULT_REAGENTE;
        }
        if ("NR".equals(normalized)
            || "NAOREAGENTE".equals(normalized)
            || "NAO_REAGENTE".equals(normalized)
            || "N_REAGENTE".equals(normalized)) {
            return RESULT_NAO_REAGENTE;
        }
        if (!ALLOWED_RESULTS.contains(normalized)) {
            throw new BusinessException("Resultado inválido. Use REAGENTE ou NAO_REAGENTE.");
        }
        return normalized;
    }

    private String normalizeAnalito(String value) {
        return normalizeRequired(value, "Analito é obrigatório.").toUpperCase(Locale.ROOT);
    }

    private String normalizeComparable(String value) {
        return stripAccents(normalizeRequired(value, "Valor obrigatório."))
            .toUpperCase(Locale.ROOT);
    }

    private String normalizeRequired(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(message);
        }
        return value.trim();
    }

    private String normalizeNullable(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String stripAccents(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "");
    }

    private ImmunologyControlSetResponse toControlSetResponse(ImmunologyControlSet controlSet) {
        return new ImmunologyControlSetResponse(
            controlSet.getId(),
            controlSet.getAnalito(),
            controlSet.getManufacturer(),
            controlSet.getLotNumber(),
            controlSet.getValidUntil(),
            controlSet.getIsActive(),
            controlSet.getValidUntil().isBefore(LocalDate.now()),
            controlSet.getCreatedAt(),
            controlSet.getUpdatedAt(),
            controlSet.getControls().stream().map(this::toControlItemResponse).toList()
        );
    }

    private ImmunologyControlItemResponse toControlItemResponse(ImmunologyControlItem item) {
        return new ImmunologyControlItemResponse(
            item.getId(),
            item.getName(),
            item.getExpectedResult(),
            item.getDisplayOrder()
        );
    }

    private ImmunologyRunResponse toRunResponse(ImmunologyQcRun run) {
        ReagentLot reagentLot = run.getReagentLot();
        return new ImmunologyRunResponse(
            run.getId(),
            run.getControlSet() != null ? run.getControlSet().getId() : null,
            reagentLot != null ? reagentLot.getId() : null,
            coalesce(run.getReagentLabelSnapshot(), reagentLot != null ? reagentLot.getName() : null),
            coalesce(run.getReagentManufacturerSnapshot(), reagentLot != null ? reagentLot.getManufacturer() : null),
            coalesce(run.getReagentLotNumberSnapshot(), reagentLot != null ? reagentLot.getLotNumber() : null),
            run.getReagentValidUntilSnapshot() != null ? run.getReagentValidUntilSnapshot() : (reagentLot != null ? reagentLot.getExpiryDate() : null),
            coalesce(run.getReagentStatusSnapshot(), reagentLot != null ? reagentLot.getStatus() : null),
            run.getReagentUnitsInStockSnapshot() != null ? run.getReagentUnitsInStockSnapshot() : (reagentLot != null ? reagentLot.getUnitsInStock() : null),
            run.getReagentUnitsInUseSnapshot() != null ? run.getReagentUnitsInUseSnapshot() : (reagentLot != null ? reagentLot.getUnitsInUse() : null),
            coalesce(run.getReagentStorageTempSnapshot(), reagentLot != null ? reagentLot.getStorageTemp() : null),
            coalesce(run.getReagentLocationSnapshot(), reagentLot != null ? reagentLot.getLocation() : null),
            run.getDataMedicao(),
            run.getAnalitoSnapshot(),
            run.getManufacturerSnapshot(),
            run.getLotNumberSnapshot(),
            run.getValidUntilSnapshot(),
            run.getStatus(),
            run.getAnalyst(),
            run.getNotes(),
            run.getCreatedAt(),
            run.getResults().stream().map(this::toRunResultResponse).toList()
        );
    }

    private String coalesce(String preferred, String fallback) {
        return preferred != null ? preferred : fallback;
    }

    private ImmunologyRunResultResponse toRunResultResponse(ImmunologyQcRunResult result) {
        return new ImmunologyRunResultResponse(
            result.getId(),
            result.getControlItem() != null ? result.getControlItem().getId() : null,
            result.getControlNameSnapshot(),
            result.getExpectedResultSnapshot(),
            result.getObservedResult(),
            result.getStatus(),
            result.getDisplayOrder()
        );
    }
}

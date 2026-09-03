package com.biodiagnostico.service;

import com.biodiagnostico.dto.request.UroSedimentRunRequest;
import com.biodiagnostico.dto.request.UroStripControlSetRequest;
import com.biodiagnostico.dto.request.UroStripRunRequest;
import com.biodiagnostico.dto.response.UroSedimentRunResponse;
import com.biodiagnostico.dto.response.UroStripControlSetResponse;
import com.biodiagnostico.dto.response.UroStripRunResponse;
import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.entity.UroSedimentQcRun;
import com.biodiagnostico.entity.UroStripControlSet;
import com.biodiagnostico.entity.UroStripQcRun;
import com.biodiagnostico.entity.User;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.exception.ResourceNotFoundException;
import com.biodiagnostico.repository.ReagentLotRepository;
import com.biodiagnostico.repository.UroSedimentQcRunRepository;
import com.biodiagnostico.repository.UroStripControlSetRepository;
import com.biodiagnostico.repository.UroStripQcRunRepository;
import com.biodiagnostico.repository.UserRepository;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UroanaliseQcService {

    public static final String STATUS_APROVADO = "APROVADO";
    public static final String STATUS_REPROVADO = "REPROVADO";
    public static final double MAX_CV_SEDIMENT = 20.0;

    private static final Set<String> NEGATIVE_SYNONYMS = Set.of(
        "0", "NEG", "NEGATIVO", "AUSENTE", "NAO REAGENTE", "NAO_REAGENTE", "NORMAL"
    );

    private final UroStripControlSetRepository controlSetRepository;
    private final UroStripQcRunRepository stripRunRepository;
    private final UroSedimentQcRunRepository sedimentRunRepository;
    private final ReagentLotRepository reagentLotRepository;
    private final UserRepository userRepository;

    public UroanaliseQcService(
        UroStripControlSetRepository controlSetRepository,
        UroStripQcRunRepository stripRunRepository,
        UroSedimentQcRunRepository sedimentRunRepository,
        ReagentLotRepository reagentLotRepository,
        UserRepository userRepository
    ) {
        this.controlSetRepository = controlSetRepository;
        this.stripRunRepository = stripRunRepository;
        this.sedimentRunRepository = sedimentRunRepository;
        this.reagentLotRepository = reagentLotRepository;
        this.userRepository = userRepository;
    }

    // ==========================================
    // CONTROLES DE FITA (UroStripControlSet)
    // ==========================================

    @Transactional(readOnly = true)
    public List<UroStripControlSetResponse> getControlSets(boolean includeInactive) {
        List<UroStripControlSet> list = includeInactive
            ? controlSetRepository.findAllByOrderByIsActiveDescCreatedAtDesc()
            : controlSetRepository.findByIsActiveTrueOrderByCreatedAtDesc();
        return list.stream().map(this::toControlSetResponse).toList();
    }

    @Transactional
    public UroStripControlSetResponse createControlSet(UroStripControlSetRequest request) {
        UroStripControlSet controlSet = UroStripControlSet.builder()
            .controlLotNumber(normalizeRequired(request.controlLotNumber(), "Lote do controle é obrigatório."))
            .manufacturer(normalizeRequired(request.manufacturer(), "Fabricante/marca é obrigatório."))
            .validUntil(request.validUntil())
            .expectedPhMin(request.expectedPhMin())
            .expectedPhMax(request.expectedPhMax())
            .expectedDensityMin(request.expectedDensityMin())
            .expectedDensityMax(request.expectedDensityMax())
            .expectedProteins(defaultIfBlank(request.expectedProteins(), "NEGATIVO"))
            .expectedGlucose(defaultIfBlank(request.expectedGlucose(), "NEGATIVO"))
            .expectedKetones(defaultIfBlank(request.expectedKetones(), "NEGATIVO"))
            .expectedBlood(defaultIfBlank(request.expectedBlood(), "NEGATIVO"))
            .expectedUrobilinogen(defaultIfBlank(request.expectedUrobilinogen(), "NORMAL"))
            .expectedNitrite(defaultIfBlank(request.expectedNitrite(), "NEGATIVO"))
            .expectedBilirubin(defaultIfBlank(request.expectedBilirubin(), "NEGATIVO"))
            .expectedLeukocytes(defaultIfBlank(request.expectedLeukocytes(), "NEGATIVO"))
            .isActive(Boolean.TRUE)
            .build();
        return toControlSetResponse(controlSetRepository.save(controlSet));
    }

    @Transactional
    public UroStripControlSetResponse updateControlSet(UUID id, UroStripControlSetRequest request) {
        UroStripControlSet controlSet = controlSetRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Controle de fita não encontrado"));
        if (!Boolean.TRUE.equals(controlSet.getIsActive())) {
            throw new BusinessException("Controle inativo não pode ser editado.");
        }
        controlSet.setControlLotNumber(normalizeRequired(request.controlLotNumber(), "Lote do controle é obrigatório."));
        controlSet.setManufacturer(normalizeRequired(request.manufacturer(), "Fabricante/marca é obrigatório."));
        controlSet.setValidUntil(request.validUntil());
        controlSet.setExpectedPhMin(request.expectedPhMin());
        controlSet.setExpectedPhMax(request.expectedPhMax());
        controlSet.setExpectedDensityMin(request.expectedDensityMin());
        controlSet.setExpectedDensityMax(request.expectedDensityMax());
        controlSet.setExpectedProteins(defaultIfBlank(request.expectedProteins(), "NEGATIVO"));
        controlSet.setExpectedGlucose(defaultIfBlank(request.expectedGlucose(), "NEGATIVO"));
        controlSet.setExpectedKetones(defaultIfBlank(request.expectedKetones(), "NEGATIVO"));
        controlSet.setExpectedBlood(defaultIfBlank(request.expectedBlood(), "NEGATIVO"));
        controlSet.setExpectedUrobilinogen(defaultIfBlank(request.expectedUrobilinogen(), "NORMAL"));
        controlSet.setExpectedNitrite(defaultIfBlank(request.expectedNitrite(), "NEGATIVO"));
        controlSet.setExpectedBilirubin(defaultIfBlank(request.expectedBilirubin(), "NEGATIVO"));
        controlSet.setExpectedLeukocytes(defaultIfBlank(request.expectedLeukocytes(), "NEGATIVO"));
        return toControlSetResponse(controlSetRepository.save(controlSet));
    }

    @Transactional
    public void deactivateControlSet(UUID id) {
        UroStripControlSet controlSet = controlSetRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Controle de fita não encontrado"));
        controlSet.setIsActive(Boolean.FALSE);
        controlSetRepository.save(controlSet);
    }

    // ==========================================
    // CORRIDAS DE FITA REATIVA (UroStripQcRun)
    // ==========================================

    @Transactional(readOnly = true)
    public List<UroStripRunResponse> getStripRuns(LocalDate startDate, LocalDate endDate) {
        List<UroStripQcRun> runs = (startDate != null && endDate != null)
            ? stripRunRepository.findByDataMedicaoBetweenOrderByDataMedicaoDescCreatedAtDesc(startDate, endDate)
            : stripRunRepository.findAllByOrderByDataMedicaoDescCreatedAtDesc();
        return runs.stream().map(this::toStripRunResponse).toList();
    }

    @Transactional
    public UroStripRunResponse createStripRun(UroStripRunRequest request, String loggedUsername) {
        UroStripControlSet controlSet = controlSetRepository.findById(request.controlSetId())
            .orElseThrow(() -> new ResourceNotFoundException("Controle de fita não encontrado"));
        if (!Boolean.TRUE.equals(controlSet.getIsActive())) {
            throw new BusinessException("O controle selecionado está inativo.");
        }

        ReagentLot reagentLot = null;
        String reagentLabel = null;
        String reagentManufacturer = null;
        String reagentLotNumber = null;
        LocalDate reagentValidUntil = null;

        if (request.reagentLotId() != null) {
            reagentLot = reagentLotRepository.findById(request.reagentLotId())
                .orElseThrow(() -> new ResourceNotFoundException("Lote de reagente não encontrado"));
            reagentLabel = reagentLot.getName();
            reagentManufacturer = reagentLot.getManufacturer();
            reagentLotNumber = reagentLot.getLotNumber();
            reagentValidUntil = reagentLot.getExpiryDate();
        }

        // Validação dos analitos individuais
        String statusPh = evaluateRange(request.measuredPh(), controlSet.getExpectedPhMin(), controlSet.getExpectedPhMax());
        String statusDensity = evaluateRange(request.measuredDensity(), controlSet.getExpectedDensityMin(), controlSet.getExpectedDensityMax());
        String statusProteins = evaluateQualitative(request.measuredProteins(), controlSet.getExpectedProteins());
        String statusGlucose = evaluateQualitative(request.measuredGlucose(), controlSet.getExpectedGlucose());
        String statusKetones = evaluateQualitative(request.measuredKetones(), controlSet.getExpectedKetones());
        String statusBlood = evaluateQualitative(request.measuredBlood(), controlSet.getExpectedBlood());
        String statusUrobilinogen = evaluateQualitative(request.measuredUrobilinogen(), controlSet.getExpectedUrobilinogen());
        String statusNitrite = evaluateQualitative(request.measuredNitrite(), controlSet.getExpectedNitrite());

        boolean allApproved = List.of(
            statusPh, statusDensity, statusProteins, statusGlucose,
            statusKetones, statusBlood, statusUrobilinogen, statusNitrite
        ).stream().allMatch(STATUS_APROVADO::equals);

        String statusGeral = allApproved ? STATUS_APROVADO : STATUS_REPROVADO;

        if (STATUS_REPROVADO.equals(statusGeral) && (request.correctiveAction() == null || request.correctiveAction().trim().isBlank())) {
            throw new BusinessException("Ação corretiva é obrigatória para controles de fita reprovados.");
        }

        String analyst = (request.analyst() != null && !request.analyst().isBlank())
            ? request.analyst().trim()
            : loggedUsername;

        UroStripQcRun run = UroStripQcRun.builder()
            .controlSet(controlSet)
            .dataMedicao(request.dataMedicao())
            .controlLotSnapshot(controlSet.getControlLotNumber())
            .controlValidUntilSnapshot(controlSet.getValidUntil())
            .reagentLot(reagentLot)
            .reagentLabelSnapshot(reagentLabel)
            .reagentManufacturerSnapshot(reagentManufacturer)
            .reagentLotNumberSnapshot(reagentLotNumber)
            .reagentValidUntilSnapshot(reagentValidUntil)
            .measuredPh(request.measuredPh())
            .statusPh(statusPh)
            .measuredDensity(request.measuredDensity())
            .statusDensity(statusDensity)
            .measuredProteins(defaultIfBlank(request.measuredProteins(), "NÃO INFORMADO"))
            .statusProteins(statusProteins)
            .measuredGlucose(defaultIfBlank(request.measuredGlucose(), "NÃO INFORMADO"))
            .statusGlucose(statusGlucose)
            .measuredKetones(defaultIfBlank(request.measuredKetones(), "NÃO INFORMADO"))
            .statusKetones(statusKetones)
            .measuredBlood(defaultIfBlank(request.measuredBlood(), "NÃO INFORMADO"))
            .statusBlood(statusBlood)
            .measuredUrobilinogen(defaultIfBlank(request.measuredUrobilinogen(), "NÃO INFORMADO"))
            .statusUrobilinogen(statusUrobilinogen)
            .measuredNitrite(defaultIfBlank(request.measuredNitrite(), "NÃO INFORMADO"))
            .statusNitrite(statusNitrite)
            .statusGeral(statusGeral)
            .correctiveAction(normalizeNullable(request.correctiveAction()))
            .analyst(analyst)
            .notes(normalizeNullable(request.notes()))
            .build();

        return toStripRunResponse(stripRunRepository.save(run));
    }

    @Transactional
    public void deleteStripRun(UUID id) {
        if (!stripRunRepository.existsById(id)) {
            throw new ResourceNotFoundException("Corrida de fita não encontrada");
        }
        stripRunRepository.deleteById(id);
    }

    // ==========================================
    // SEDIMENTO URINÁRIO (UroSedimentQcRun)
    // ==========================================

    @Transactional(readOnly = true)
    public List<UroSedimentRunResponse> getSedimentRuns(LocalDate startDate, LocalDate endDate) {
        List<UroSedimentQcRun> runs = (startDate != null && endDate != null)
            ? sedimentRunRepository.findByDataMedicaoBetweenOrderByDataMedicaoDescCreatedAtDesc(startDate, endDate)
            : sedimentRunRepository.findAllByOrderByDataMedicaoDescCreatedAtDesc();
        return runs.stream().map(this::toSedimentRunResponse).toList();
    }

    @Transactional
    public UroSedimentRunResponse createSedimentRun(UroSedimentRunRequest request) {
        User analyst1 = null;
        String analyst1Name = request.analyst1Name();
        if (request.analyst1Id() != null) {
            analyst1 = userRepository.findById(request.analyst1Id()).orElse(null);
            if (analyst1 != null && (analyst1Name == null || analyst1Name.isBlank())) {
                analyst1Name = analyst1.getName();
            }
        }
        if (analyst1Name == null || analyst1Name.isBlank()) {
            throw new BusinessException("Nome do Analista 1 é obrigatório.");
        }

        User analyst2 = null;
        String analyst2Name = request.analyst2Name();
        if (request.analyst2Id() != null) {
            analyst2 = userRepository.findById(request.analyst2Id()).orElse(null);
            if (analyst2 != null && (analyst2Name == null || analyst2Name.isBlank())) {
                analyst2Name = analyst2.getName();
            }
        }
        if (analyst2Name == null || analyst2Name.isBlank()) {
            throw new BusinessException("Nome do Analista 2 é obrigatório.");
        }

        // Cálculos estatísticos de CV para contagens microscópicas
        double leukocytesCv = calculateCv(request.leukocytesA1(), request.leukocytesA2());
        String statusLeukocytes = leukocytesCv <= MAX_CV_SEDIMENT ? STATUS_APROVADO : STATUS_REPROVADO;

        double erythrocytesCv = calculateCv(request.erythrocytesA1(), request.erythrocytesA2());
        String statusErythrocytes = erythrocytesCv <= MAX_CV_SEDIMENT ? STATUS_APROVADO : STATUS_REPROVADO;

        // Concordância categórica
        String statusBacteria = evaluateCategoricalMatch(request.bacteriaA1(), request.bacteriaA2());
        String statusEpithelialCells = evaluateCategoricalMatch(request.epithelialCellsA1(), request.epithelialCellsA2());
        String statusMucusThreads = evaluateCategoricalMatch(request.mucusThreadsA1(), request.mucusThreadsA2());
        String statusCrystals = evaluateCategoricalMatch(request.crystalsA1(), request.crystalsA2());
        String statusOthers = evaluateCategoricalMatch(request.othersA1(), request.othersA2());

        boolean allApproved = List.of(
            statusLeukocytes, statusErythrocytes, statusBacteria,
            statusEpithelialCells, statusMucusThreads, statusCrystals, statusOthers
        ).stream().allMatch(STATUS_APROVADO::equals);

        String statusGeral = allApproved ? STATUS_APROVADO : STATUS_REPROVADO;

        if (STATUS_REPROVADO.equals(statusGeral) && (request.correctiveAction() == null || request.correctiveAction().trim().isBlank())) {
            throw new BusinessException("Ação corretiva é obrigatória para corridas de sedimento com divergência.");
        }

        UroSedimentQcRun run = UroSedimentQcRun.builder()
            .dataMedicao(request.dataMedicao())
            .patientCode(request.patientCode().trim())
            .analyst1(analyst1)
            .analyst1Name(analyst1Name.trim())
            .analyst2(analyst2)
            .analyst2Name(analyst2Name.trim())
            .leukocytesA1(request.leukocytesA1())
            .leukocytesA2(request.leukocytesA2())
            .leukocytesCv(leukocytesCv)
            .statusLeukocytes(statusLeukocytes)
            .erythrocytesA1(request.erythrocytesA1())
            .erythrocytesA2(request.erythrocytesA2())
            .erythrocytesCv(erythrocytesCv)
            .statusErythrocytes(statusErythrocytes)
            .bacteriaA1(request.bacteriaA1().trim())
            .bacteriaA2(request.bacteriaA2().trim())
            .statusBacteria(statusBacteria)
            .epithelialCellsA1(request.epithelialCellsA1().trim())
            .epithelialCellsA2(request.epithelialCellsA2().trim())
            .statusEpithelialCells(statusEpithelialCells)
            .mucusThreadsA1(request.mucusThreadsA1().trim())
            .mucusThreadsA2(request.mucusThreadsA2().trim())
            .statusMucusThreads(statusMucusThreads)
            .crystalsA1(request.crystalsA1().trim())
            .crystalsA2(request.crystalsA2().trim())
            .statusCrystals(statusCrystals)
            .othersA1(request.othersA1().trim())
            .othersA2(request.othersA2().trim())
            .statusOthers(statusOthers)
            .statusGeral(statusGeral)
            .correctiveAction(normalizeNullable(request.correctiveAction()))
            .notes(normalizeNullable(request.notes()))
            .build();

        return toSedimentRunResponse(sedimentRunRepository.save(run));
    }

    @Transactional
    public void deleteSedimentRun(UUID id) {
        if (!sedimentRunRepository.existsById(id)) {
            throw new ResourceNotFoundException("Corrida de sedimento não encontrada");
        }
        sedimentRunRepository.deleteById(id);
    }

    // ==========================================
    // MÉTODOS DE APOIO E CÁLCULOS
    // ==========================================

    public static double calculateCv(double a1, double a2) {
        double mean = (a1 + a2) / 2.0;
        if (mean == 0.0) {
            return 0.0;
        }
        double sd = Math.abs(a1 - a2) / Math.sqrt(2.0);
        double cv = (sd / mean) * 100.0;
        return Math.round(cv * 100.0) / 100.0;
    }

    private String evaluateRange(Double measured, Double min, Double max) {
        if (measured == null) {
            return STATUS_REPROVADO;
        }
        if (min != null && measured < min) {
            return STATUS_REPROVADO;
        }
        if (max != null && measured > max) {
            return STATUS_REPROVADO;
        }
        return STATUS_APROVADO;
    }

    private String evaluateQualitative(String measured, String expected) {
        if (measured == null || expected == null) {
            return STATUS_REPROVADO;
        }
        String normMeasured = normalizeString(measured);
        String normExpected = normalizeString(expected);

        if (normMeasured.equals(normExpected)) {
            return STATUS_APROVADO;
        }

        // Equivalência de sinônimos laboratoriais (ex: 0 e NEGATIVO)
        boolean bothNegative = NEGATIVE_SYNONYMS.contains(normMeasured) && NEGATIVE_SYNONYMS.contains(normExpected);
        if (bothNegative) {
            return STATUS_APROVADO;
        }

        return STATUS_REPROVADO;
    }

    private String evaluateCategoricalMatch(String a1, String a2) {
        if (a1 == null || a2 == null) {
            return STATUS_REPROVADO;
        }
        return normalizeString(a1).equals(normalizeString(a2)) ? STATUS_APROVADO : STATUS_REPROVADO;
    }

    private String normalizeString(String input) {
        if (input == null) return "";
        String normalized = Normalizer.normalize(input.trim().toUpperCase(Locale.ROOT), Normalizer.Form.NFD);
        return normalized.replaceAll("\\p{M}", "");
    }

    private String normalizeRequired(String value, String errorMessage) {
        if (value == null || value.trim().isBlank()) {
            throw new BusinessException(errorMessage);
        }
        return value.trim();
    }

    private String defaultIfBlank(String value, String fallback) {
        return (value == null || value.trim().isBlank()) ? fallback : value.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeNullable(String value) {
        return (value == null || value.trim().isBlank()) ? null : value.trim();
    }

    private UroStripControlSetResponse toControlSetResponse(UroStripControlSet item) {
        return new UroStripControlSetResponse(
            item.getId(),
            item.getControlLotNumber(),
            item.getManufacturer(),
            item.getValidUntil(),
            item.getExpectedPhMin(),
            item.getExpectedPhMax(),
            item.getExpectedDensityMin(),
            item.getExpectedDensityMax(),
            item.getExpectedProteins(),
            item.getExpectedGlucose(),
            item.getExpectedKetones(),
            item.getExpectedBlood(),
            item.getExpectedUrobilinogen(),
            item.getExpectedNitrite(),
            item.getExpectedBilirubin(),
            item.getExpectedLeukocytes(),
            item.getIsActive(),
            item.getCreatedAt(),
            item.getUpdatedAt()
        );
    }

    private UroStripRunResponse toStripRunResponse(UroStripQcRun run) {
        return new UroStripRunResponse(
            run.getId(),
            run.getControlSet() != null ? run.getControlSet().getId() : null,
            run.getDataMedicao(),
            run.getControlLotSnapshot(),
            run.getControlValidUntilSnapshot(),
            run.getReagentLot() != null ? run.getReagentLot().getId() : null,
            run.getReagentLabelSnapshot(),
            run.getReagentManufacturerSnapshot(),
            run.getReagentLotNumberSnapshot(),
            run.getReagentValidUntilSnapshot(),
            run.getMeasuredPh(),
            run.getStatusPh(),
            run.getMeasuredDensity(),
            run.getStatusDensity(),
            run.getMeasuredProteins(),
            run.getStatusProteins(),
            run.getMeasuredGlucose(),
            run.getStatusGlucose(),
            run.getMeasuredKetones(),
            run.getStatusKetones(),
            run.getMeasuredBlood(),
            run.getStatusBlood(),
            run.getMeasuredUrobilinogen(),
            run.getStatusUrobilinogen(),
            run.getMeasuredNitrite(),
            run.getStatusNitrite(),
            run.getStatusGeral(),
            run.getCorrectiveAction(),
            run.getAnalyst(),
            run.getNotes(),
            run.getCreatedAt()
        );
    }

    private UroSedimentRunResponse toSedimentRunResponse(UroSedimentQcRun run) {
        return new UroSedimentRunResponse(
            run.getId(),
            run.getDataMedicao(),
            run.getPatientCode(),
            run.getAnalyst1() != null ? run.getAnalyst1().getId() : null,
            run.getAnalyst1Name(),
            run.getAnalyst2() != null ? run.getAnalyst2().getId() : null,
            run.getAnalyst2Name(),
            run.getLeukocytesA1(),
            run.getLeukocytesA2(),
            run.getLeukocytesCv(),
            run.getStatusLeukocytes(),
            run.getErythrocytesA1(),
            run.getErythrocytesA2(),
            run.getErythrocytesCv(),
            run.getStatusErythrocytes(),
            run.getBacteriaA1(),
            run.getBacteriaA2(),
            run.getStatusBacteria(),
            run.getEpithelialCellsA1(),
            run.getEpithelialCellsA2(),
            run.getStatusEpithelialCells(),
            run.getMucusThreadsA1(),
            run.getMucusThreadsA2(),
            run.getStatusMucusThreads(),
            run.getCrystalsA1(),
            run.getCrystalsA2(),
            run.getStatusCrystals(),
            run.getOthersA1(),
            run.getOthersA2(),
            run.getStatusOthers(),
            run.getStatusGeral(),
            run.getCorrectiveAction(),
            run.getNotes(),
            run.getCreatedAt()
        );
    }
}

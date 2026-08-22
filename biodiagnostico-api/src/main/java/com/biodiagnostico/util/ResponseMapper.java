package com.biodiagnostico.util;

import com.biodiagnostico.dto.response.HematologyBioRecordResponse;
import com.biodiagnostico.dto.response.ImportRunResponse;
import com.biodiagnostico.dto.response.MaintenanceResponse;
import com.biodiagnostico.dto.response.QcRecordResponse;
import com.biodiagnostico.dto.response.QcReferenceResponse;
import com.biodiagnostico.dto.response.ReagentLotResponse;
import com.biodiagnostico.dto.response.ReportRunResponse;
import com.biodiagnostico.dto.response.StockMovementResponse;
import com.biodiagnostico.dto.response.UserResponse;
import com.biodiagnostico.dto.response.ViolationResponse;
import com.biodiagnostico.entity.HematologyBioRecord;
import com.biodiagnostico.entity.ImportRun;
import com.biodiagnostico.entity.MaintenanceRecord;
import com.biodiagnostico.entity.MovementType;
import com.biodiagnostico.entity.PostCalibrationRecord;
import com.biodiagnostico.entity.QcExam;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.QcReferenceValue;
import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.entity.ReagentStatus;
import com.biodiagnostico.entity.ReportRun;
import com.biodiagnostico.entity.StockMovement;
import com.biodiagnostico.entity.User;
import com.biodiagnostico.entity.WestgardViolation;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

public final class ResponseMapper {

    /**
     * Threshold fixo para a flag {@code nearExpiry}. Substituiu a coluna
     * {@code alert_threshold_days} (dropada na V13). Decisao 1.10 do contrato:
     * sem configurabilidade — overdesign nao pedido.
     */
    private static final int ALERT_THRESHOLD_DAYS = 7;

    private ResponseMapper() {
    }

    public static UserResponse toUserResponse(User user) {
        return new UserResponse(
            user.getId(),
            user.getUsername(),
            user.getEmail(),
            user.getName(),
            user.getRole().name(),
            user.getIsActive(),
            user.getPermissions() == null
                ? java.util.List.of()
                : user.getPermissions().stream().map(Enum::name).sorted().toList()
        );
    }

    public static MaintenanceResponse toMaintenanceResponse(MaintenanceRecord record) {
        return new MaintenanceResponse(
            record.getId(),
            record.getEquipment(),
            record.getType(),
            record.getDate(),
            record.getNextDate(),
            record.getTechnician(),
            record.getNotes(),
            record.getCreatedAt()
        );
    }

    public static QcReferenceResponse toQcReferenceResponse(QcReferenceValue ref) {
        QcExam exam = ref.getExam();
        QcReferenceResponse.QcExamInfo examInfo = exam != null
            ? new QcReferenceResponse.QcExamInfo(
                exam.getId(),
                exam.getName(),
                exam.getArea(),
                exam.getUnit(),
                exam.getIsActive()
            )
            : null;
        return new QcReferenceResponse(
            ref.getId(),
            examInfo,
            ref.getName(),
            ref.getLevel(),
            ref.getLotNumber(),
            ref.getManufacturer(),
            ref.getTargetValue(),
            ref.getTargetSd(),
            ref.getCvMaxThreshold(),
            ref.getValidFrom(),
            ref.getValidUntil(),
            ref.getIsActive(),
            ref.getNotes()
        );
    }

    public static ViolationResponse toViolationResponse(WestgardViolation violation) {
        return new ViolationResponse(
            violation.getRule(),
            violation.getDescription(),
            violation.getSeverity()
        );
    }

    public static QcRecordResponse toQcRecordResponse(QcRecord record) {
        return toQcRecordResponse(record, null, null);
    }

    public static QcRecordResponse toQcRecordResponse(QcRecord record, String referenceWarning) {
        return toQcRecordResponse(record, referenceWarning, null);
    }

    public static QcRecordResponse toQcRecordResponse(QcRecord record, String referenceWarning, PostCalibrationRecord postCalibration) {
        List<WestgardViolation> recordViolations = record.getViolations();
        return toQcRecordResponse(record, referenceWarning, postCalibration, recordViolations);
    }

    /**
     * Variante para fluxos de listagem: as violacoes ja chegam materializadas
     * em lote, portanto o mapper nao toca na colecao LAZY do registro.
     */
    public static QcRecordResponse toQcRecordResponse(
        QcRecord record,
        String referenceWarning,
        PostCalibrationRecord postCalibration,
        List<WestgardViolation> explicitViolations
    ) {
        List<ViolationResponse> violations = explicitViolations == null
            ? List.of()
            : explicitViolations.stream().map(ResponseMapper::toViolationResponse).toList();
        Double postValue = postCalibration != null ? postCalibration.getPostCalibrationValue() : null;
        Double postCv = postCalibration != null ? postCalibration.getPostCalibrationCv() : null;
        String postStatus = computePostCalibrationStatus(postCv, record.getCvLimit());
        return new QcRecordResponse(
            record.getId(),
            record.getReference() != null ? record.getReference().getId() : null,
            record.getExamName(),
            record.getArea(),
            record.getDate(),
            record.getLevel(),
            record.getLotNumber(),
            record.getValue(),
            record.getTargetValue(),
            record.getTargetSd(),
            record.getCv(),
            record.getCvLimit(),
            record.getZScore(),
            record.getEquipment(),
            record.getAnalyst(),
            record.getStatus(),
            record.getNeedsCalibration(),
            violations,
            record.getCreatedAt(),
            record.getUpdatedAt(),
            referenceWarning,
            postValue,
            postCv,
            postStatus
        );
    }

    private static String computePostCalibrationStatus(Double postCv, Double cvLimit) {
        if (postCv == null) return null;
        double limit = cvLimit != null ? cvLimit : 10D;
        return postCv <= limit ? "APROVADO" : "REPROVADO";
    }

    public static ReagentLotResponse toReagentLotResponse(ReagentLot lot) {
        return toReagentLotResponse(lot, false);
    }

    /**
     * Sobrecarga que permite ao chamador informar se o lote foi usado em CQ recentemente.
     * O mapper nao consulta o repositorio — quem chama (ReagentService.getLots) faz a
     * consulta em batch e passa o flag pronto para cada lote.
     */
    public static ReagentLotResponse toReagentLotResponse(ReagentLot lot, boolean usedInQcRecently) {
        long daysLeft = lot.getExpiryDate() == null
            ? -1
            : ChronoUnit.DAYS.between(LocalDate.now(), lot.getExpiryDate());
        boolean nearExpiry = daysLeft >= 0 && daysLeft <= ALERT_THRESHOLD_DAYS;
        List<String> traceabilityIssues = reagentTraceabilityIssues(lot);

        Integer unitsInStock = lot.getUnitsInStock() == null ? 0 : lot.getUnitsInStock();
        Integer unitsInUse = lot.getUnitsInUse() == null ? 0 : lot.getUnitsInUse();
        Integer totalUnits = unitsInStock + unitsInUse;

        // Refator v3: vencido E inativo bloqueiam ENTRADA. Inativo so aceita AJUSTE
        // (terminal manual). Vencido aceita CONSUMO (descarte) e AJUSTE.
        String status = lot.getStatus();
        boolean canReceiveEntry = !ReagentStatus.VENCIDO.equals(status)
            && !ReagentStatus.INATIVO.equals(status);

        List<String> allowedMovementTypes = computeAllowedMovementTypes(
            status, unitsInStock, unitsInUse);
        String movementWarning = computeMovementWarning(status);

        return new ReagentLotResponse(
            lot.getId(),
            lot.getName(), // semantica: label
            lot.getLotNumber(),
            lot.getManufacturer(),
            lot.getCategory(),
            lot.getExpiryDate(),
            unitsInStock,
            unitsInUse,
            totalUnits,
            lot.getStorageTemp(),
            status,
            lot.getCreatedAt(),
            lot.getUpdatedAt(),
            daysLeft,
            nearExpiry,
            lot.getLocation(),
            lot.getSupplier(),
            lot.getReceivedDate(),
            lot.getOpenedDate(),
            lot.getArchivedAt(),
            lot.getArchivedBy(),
            Boolean.TRUE.equals(lot.getNeedsStockReview()),
            usedInQcRecently,
            traceabilityIssues.isEmpty(),
            traceabilityIssues,
            canReceiveEntry,
            allowedMovementTypes,
            movementWarning
        );
    }

    /**
     * Matriz de tipos permitidos por status — espelha contrato 5.7.
     */
    private static List<String> computeAllowedMovementTypes(
        String status, Integer unitsInStock, Integer unitsInUse
    ) {
        if (ReagentStatus.INATIVO.equals(status)) {
            return List.of(MovementType.AJUSTE);
        }
        if (ReagentStatus.VENCIDO.equals(status)) {
            return List.of(MovementType.CONSUMO, MovementType.AJUSTE);
        }
        boolean hasStock = unitsInStock != null && unitsInStock > 0;
        boolean hasUse = unitsInUse != null && unitsInUse > 0;
        if (hasStock && hasUse) {
            return List.of(MovementType.ENTRADA, MovementType.ABERTURA,
                MovementType.FECHAMENTO, MovementType.CONSUMO, MovementType.AJUSTE);
        }
        if (hasStock) {
            return List.of(MovementType.ENTRADA, MovementType.ABERTURA, MovementType.AJUSTE);
        }
        if (hasUse) {
            return List.of(MovementType.ENTRADA, MovementType.FECHAMENTO,
                MovementType.CONSUMO, MovementType.AJUSTE);
        }
        // zero/zero
        return List.of(MovementType.ENTRADA, MovementType.AJUSTE);
    }

    private static String computeMovementWarning(String status) {
        if (ReagentStatus.VENCIDO.equals(status)) {
            return "Lote vencido — apenas CONSUMO (descarte) e AJUSTE permitidos.";
        }
        if (ReagentStatus.INATIVO.equals(status)) {
            return "Lote arquivado — apenas AJUSTE permitido.";
        }
        return null;
    }

    private static List<String> reagentTraceabilityIssues(ReagentLot lot) {
        List<String> issues = new ArrayList<>();
        if (isBlank(lot.getManufacturer())) issues.add("manufacturer");
        if (isBlank(lot.getLocation())) issues.add("location");
        if (isBlank(lot.getSupplier())) issues.add("supplier");
        if (lot.getReceivedDate() == null) issues.add("receivedDate");
        return List.copyOf(issues);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    public static HematologyBioRecordResponse toHematologyBioRecordResponse(HematologyBioRecord record) {
        return new HematologyBioRecordResponse(
            record.getId(),
            record.getDataBio(),
            record.getDataPad(),
            record.getRegistroBio(),
            record.getRegistroPad(),
            record.getModoCi(),
            record.getBioHemacias(),
            record.getBioHematocrito(),
            record.getBioHemoglobina(),
            record.getBioLeucocitos(),
            record.getBioPlaquetas(),
            record.getBioRdw(),
            record.getBioVpm(),
            record.getPadHemacias(),
            record.getPadHematocrito(),
            record.getPadHemoglobina(),
            record.getPadLeucocitos(),
            record.getPadPlaquetas(),
            record.getPadRdw(),
            record.getPadVpm(),
            record.getCiMinHemacias(),
            record.getCiMaxHemacias(),
            record.getCiMinHematocrito(),
            record.getCiMaxHematocrito(),
            record.getCiMinHemoglobina(),
            record.getCiMaxHemoglobina(),
            record.getCiMinLeucocitos(),
            record.getCiMaxLeucocitos(),
            record.getCiMinPlaquetas(),
            record.getCiMaxPlaquetas(),
            record.getCiMinRdw(),
            record.getCiMaxRdw(),
            record.getCiMinVpm(),
            record.getCiMaxVpm(),
            record.getCiPctHemacias(),
            record.getCiPctHematocrito(),
            record.getCiPctHemoglobina(),
            record.getCiPctLeucocitos(),
            record.getCiPctPlaquetas(),
            record.getCiPctRdw(),
            record.getCiPctVpm(),
            record.getCreatedAt()
        );
    }

    public static ReportRunResponse toReportRunResponse(ReportRun run) {
        return new ReportRunResponse(
            run.getId(),
            run.getType(),
            run.getArea(),
            run.getPeriodType(),
            run.getMonth(),
            run.getYear(),
            run.getReportNumber(),
            run.getSha256(),
            run.getSizeBytes(),
            run.getDurationMs(),
            run.getStatus(),
            run.getErrorMessage(),
            run.getUsername(),
            run.getCreatedAt()
        );
    }

    public static ImportRunResponse toImportRunResponse(ImportRun run) {
        return new ImportRunResponse(
            run.getId(),
            run.getSource(),
            run.getMode(),
            run.getTotalRows(),
            run.getSuccessRows(),
            run.getFailureRows(),
            run.getDurationMs(),
            run.getStatus(),
            run.getErrorSummary(),
            run.getUsername(),
            run.getCreatedAt()
        );
    }

    public static StockMovementResponse toStockMovementResponse(StockMovement movement) {
        // isLegacy: movimento gravado pre-V14 (so previousStock preenchido).
        boolean isLegacy = movement.getPreviousStock() != null
            && movement.getPreviousUnitsInStock() == null;
        return new StockMovementResponse(
            movement.getId(),
            movement.getType(),
            movement.getQuantity(),
            movement.getResponsible(),
            movement.getNotes(),
            movement.getPreviousStock(),
            movement.getPreviousUnitsInStock(),
            movement.getPreviousUnitsInUse(),
            isLegacy,
            movement.getReason(),
            movement.getEventDate(),
            movement.getCreatedAt()
        );
    }

    public static com.biodiagnostico.dto.response.TemperatureLocationResponse toTemperatureLocationResponse(
        com.biodiagnostico.entity.TemperatureLocation loc
    ) {
        return new com.biodiagnostico.dto.response.TemperatureLocationResponse(
            loc.getId(),
            loc.getName(),
            loc.getCode(),
            loc.getCategory(),
            loc.getArea(),
            loc.getMinTempTarget(),
            loc.getMaxTempTarget(),
            loc.getMinHumidityTarget(),
            loc.getMaxHumidityTarget(),
            loc.getThermometerCode(),
            loc.getCalibrationCertNumber(),
            loc.getCalibrationDueDate(),
            loc.getFrequency(),
            loc.getActive(),
            loc.getNotes(),
            loc.getCreatedAt(),
            loc.getUpdatedAt()
        );
    }

    public static com.biodiagnostico.dto.response.TemperatureRecordResponse toTemperatureRecordResponse(
        com.biodiagnostico.entity.TemperatureRecord record
    ) {
        return new com.biodiagnostico.dto.response.TemperatureRecordResponse(
            record.getId(),
            record.getLocation() != null ? record.getLocation().getId() : null,
            record.getLocation() != null ? record.getLocation().getName() : null,
            record.getLocation() != null ? record.getLocation().getCode() : null,
            record.getLocation() != null ? record.getLocation().getCategory() : null,
            record.getLocation() != null ? record.getLocation().getArea() : null,
            record.getLocation() != null ? record.getLocation().getMinTempTarget() : null,
            record.getLocation() != null ? record.getLocation().getMaxTempTarget() : null,
            record.getDate(),
            record.getTime(),
            record.getPeriod(),
            record.getTempCurrent(),
            record.getTempMax(),
            record.getTempMin(),
            record.getHumidity(),
            record.getStatus(),
            record.getResponsible(),
            record.getActionTaken(),
            record.getNotes(),
            record.getPhotoUrl(),
            record.getPhotoFilename(),
            record.getPhotoMinUrl(),
            record.getPhotoMinFilename(),
            record.getOcrApplied(),
            record.getCreatedAt(),
            record.getUpdatedAt()
        );
    }
}

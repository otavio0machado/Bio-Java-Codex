package com.biodiagnostico.util;

import com.biodiagnostico.dto.response.HematologyBioRecordResponse;
import com.biodiagnostico.dto.response.MaintenanceResponse;
import com.biodiagnostico.dto.response.QcRecordResponse;
import com.biodiagnostico.dto.response.QcReferenceResponse;
import com.biodiagnostico.dto.response.ReagentLotResponse;
import com.biodiagnostico.dto.response.StockMovementResponse;
import com.biodiagnostico.dto.response.UserResponse;
import com.biodiagnostico.dto.response.ViolationResponse;
import com.biodiagnostico.entity.HematologyBioRecord;
import com.biodiagnostico.entity.MaintenanceRecord;
import com.biodiagnostico.entity.QcExam;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.QcReferenceValue;
import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.entity.StockMovement;
import com.biodiagnostico.entity.User;
import com.biodiagnostico.entity.WestgardViolation;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

public final class ResponseMapper {

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
        List<ViolationResponse> violations = record.getViolations() == null
            ? List.of()
            : record.getViolations().stream().map(ResponseMapper::toViolationResponse).toList();
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
            record.getUpdatedAt()
        );
    }

    public static ReagentLotResponse toReagentLotResponse(ReagentLot lot) {
        long daysLeft = lot.getExpiryDate() == null
            ? -1
            : ChronoUnit.DAYS.between(LocalDate.now(), lot.getExpiryDate());
        double quantityValue = NumericUtils.defaultIfNull(lot.getQuantityValue());
        double currentStock = NumericUtils.defaultIfNull(lot.getCurrentStock());
        double estimatedConsumption = NumericUtils.defaultIfNull(lot.getEstimatedConsumption());
        double stockPct = quantityValue <= 0 ? 0D : (currentStock / quantityValue) * 100D;
        Double daysToRupture = estimatedConsumption > 0 ? currentStock / estimatedConsumption : null;
        int alertThresholdDays = lot.getAlertThresholdDays() == null ? 7 : lot.getAlertThresholdDays();
        boolean nearExpiry = daysLeft >= 0 && daysLeft <= alertThresholdDays;

        return new ReagentLotResponse(
            lot.getId(),
            lot.getName(),
            lot.getLotNumber(),
            lot.getManufacturer(),
            lot.getCategory(),
            lot.getExpiryDate(),
            lot.getQuantityValue(),
            lot.getStockUnit(),
            lot.getCurrentStock(),
            lot.getEstimatedConsumption(),
            lot.getStorageTemp(),
            lot.getStartDate(),
            lot.getEndDate(),
            lot.getStatus(),
            lot.getAlertThresholdDays(),
            lot.getCreatedAt(),
            lot.getUpdatedAt(),
            daysLeft,
            stockPct,
            daysToRupture,
            nearExpiry
        );
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

    public static StockMovementResponse toStockMovementResponse(StockMovement movement) {
        return new StockMovementResponse(
            movement.getId(),
            movement.getType(),
            movement.getQuantity(),
            movement.getResponsible(),
            movement.getNotes(),
            movement.getCreatedAt()
        );
    }
}

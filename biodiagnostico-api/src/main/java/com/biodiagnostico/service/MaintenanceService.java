package com.biodiagnostico.service;

import com.biodiagnostico.dto.request.MaintenanceRequest;
import com.biodiagnostico.entity.MaintenanceRecord;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.exception.ResourceNotFoundException;
import com.biodiagnostico.repository.MaintenanceRecordRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MaintenanceService {

    private final MaintenanceRecordRepository maintenanceRecordRepository;

    public MaintenanceService(MaintenanceRecordRepository maintenanceRecordRepository) {
        this.maintenanceRecordRepository = maintenanceRecordRepository;
    }

    @Transactional(readOnly = true)
    public List<MaintenanceRecord> getRecords(String equipment) {
        if (equipment == null || equipment.isBlank()) {
            return maintenanceRecordRepository.findAllByOrderByDateDesc();
        }
        return maintenanceRecordRepository.findByEquipment(equipment);
    }

    @Transactional
    public MaintenanceRecord createRecord(MaintenanceRequest request) {
        validateNextDate(request);
        return maintenanceRecordRepository.save(MaintenanceRecord.builder()
            .equipment(request.equipment())
            .type(request.type())
            .date(request.date())
            .nextDate(request.nextDate())
            .technician(request.technician())
            .notes(request.notes())
            .build());
    }

    @Transactional
    public MaintenanceRecord updateRecord(UUID id, MaintenanceRequest request) {
        validateNextDate(request);
        MaintenanceRecord record = maintenanceRecordRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Registro de manutenção não encontrado"));
        record.setEquipment(request.equipment());
        record.setType(request.type());
        record.setDate(request.date());
        record.setNextDate(request.nextDate());
        record.setTechnician(request.technician());
        record.setNotes(request.notes());
        return maintenanceRecordRepository.save(record);
    }

    @Transactional
    public void deleteRecord(UUID id) {
        if (!maintenanceRecordRepository.existsById(id)) {
            throw new ResourceNotFoundException("Registro de manutenção não encontrado");
        }
        maintenanceRecordRepository.deleteById(id);
    }

    /**
     * Retorna o registro mais recente por equipamento (ordenado por date DESC).
     * Usado como base para status operacional atual e alertas ativos.
     */
    @Transactional(readOnly = true)
    public List<MaintenanceRecord> getLatestRecordsByEquipment() {
        List<MaintenanceRecord> all = maintenanceRecordRepository.findAllByOrderByDateDesc();
        Map<String, MaintenanceRecord> latestByEquip = new LinkedHashMap<>();
        for (MaintenanceRecord r : all) {
            if (r.getEquipment() != null && !r.getEquipment().isBlank()) {
                latestByEquip.putIfAbsent(r.getEquipment().trim().toUpperCase(Locale.ROOT), r);
            }
        }
        return new ArrayList<>(latestByEquip.values());
    }

    @Transactional(readOnly = true)
    public List<MaintenanceRecord> getPendingMaintenances() {
        LocalDate today = LocalDate.now();
        return getOverdueMaintenances(today);
    }

    @Transactional(readOnly = true)
    public long countPendingMaintenances() {
        return getPendingMaintenances().size();
    }

    @Transactional(readOnly = true)
    public List<MaintenanceRecord> getOverdueMaintenances(LocalDate today) {
        return getLatestRecordsByEquipment().stream()
            .filter(r -> r.getNextDate() != null && !r.getNextDate().isAfter(today))
            .sorted(Comparator.comparing(MaintenanceRecord::getNextDate))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<MaintenanceRecord> getUpcomingMaintenances(LocalDate today, LocalDate limit) {
        return getLatestRecordsByEquipment().stream()
            .filter(r -> r.getNextDate() != null && !r.getNextDate().isBefore(today) && r.getNextDate().isBefore(limit))
            .sorted(Comparator.comparing(MaintenanceRecord::getNextDate))
            .toList();
    }

    private void validateNextDate(MaintenanceRequest request) {
        if (request.nextDate() != null && request.date() != null && !request.nextDate().isAfter(request.date())) {
            throw new BusinessException("A próxima data de manutenção deve ser posterior à data do registro");
        }
    }
}

package com.biodiagnostico.service;

import com.biodiagnostico.dto.request.ReagentLotRequest;
import com.biodiagnostico.dto.request.StockMovementRequest;
import com.biodiagnostico.dto.response.ReagentLotResponse;
import com.biodiagnostico.dto.response.ReagentTagSummary;
import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.entity.StockMovement;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.exception.ResourceNotFoundException;
import com.biodiagnostico.repository.ReagentLotRepository;
import com.biodiagnostico.repository.StockMovementRepository;
import com.biodiagnostico.util.NumericUtils;
import com.biodiagnostico.util.ResponseMapper;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReagentService {

    private static final String PREVIOUS_STOCK_PREFIX = "PREVIOUS_STOCK=";

    private final ReagentLotRepository reagentLotRepository;
    private final StockMovementRepository stockMovementRepository;

    public ReagentService(
        ReagentLotRepository reagentLotRepository,
        StockMovementRepository stockMovementRepository
    ) {
        this.reagentLotRepository = reagentLotRepository;
        this.stockMovementRepository = stockMovementRepository;
    }

    @Transactional(readOnly = true)
    public List<ReagentLotResponse> getLots(String category, String status) {
        String normalizedCategory = (category == null || category.isBlank()) ? null : category;
        String normalizedStatus = (status == null || status.isBlank()) ? null : status;

        List<ReagentLot> lots = reagentLotRepository.findByFilters(normalizedCategory, normalizedStatus);

        return lots.stream()
            .map(ResponseMapper::toReagentLotResponse)
            .toList();
    }

    @Transactional
    public ReagentLot createLot(ReagentLotRequest request) {
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
            .alertThresholdDays(request.alertThresholdDays() == null ? 7 : request.alertThresholdDays())
            .status(request.status() == null || request.status().isBlank() ? "ativo" : request.status())
            .build();
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
        lot.setAlertThresholdDays(request.alertThresholdDays() == null ? lot.getAlertThresholdDays() : request.alertThresholdDays());
        if (request.status() != null && !request.status().isBlank()) {
            lot.setStatus(request.status());
        }
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

        String type = request.type().trim().toUpperCase();
        double quantity = NumericUtils.defaultIfNull(request.quantity());
        double currentStock = NumericUtils.defaultIfNull(lot.getCurrentStock());
        String notes = request.notes();

        switch (type) {
            case "ENTRADA" -> lot.setCurrentStock(currentStock + quantity);
            case "SAIDA" -> {
                if (currentStock - quantity < 0) {
                    throw new BusinessException("Estoque insuficiente para esta saída. Estoque atual: " + currentStock);
                }
                lot.setCurrentStock(currentStock - quantity);
            }
            case "AJUSTE" -> {
                lot.setCurrentStock(quantity);
                notes = PREVIOUS_STOCK_PREFIX + currentStock + ";" + (notes == null ? "" : notes);
            }
            default -> throw new BusinessException("Tipo de movimentação inválido");
        }

        reagentLotRepository.save(lot);
        StockMovement movement = StockMovement.builder()
            .reagentLot(lot)
            .type(type)
            .quantity(quantity)
            .responsible(request.responsible())
            .notes(notes)
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
            case "ENTRADA" -> {
                double resultingStock = currentStock - movement.getQuantity();
                if (resultingStock < 0) {
                    throw new BusinessException(
                        "Não é possível excluir esta entrada. O estoque resultante ficaria negativo.");
                }
                lot.setCurrentStock(resultingStock);
            }
            case "SAIDA" -> lot.setCurrentStock(currentStock + movement.getQuantity());
            case "AJUSTE" -> {
                double previousStock = extractPreviousStock(movement.getNotes(), currentStock);
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
}

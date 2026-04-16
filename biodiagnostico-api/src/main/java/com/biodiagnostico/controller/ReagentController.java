package com.biodiagnostico.controller;

import com.biodiagnostico.dto.request.ReagentLotRequest;
import com.biodiagnostico.dto.request.StockMovementRequest;
import com.biodiagnostico.dto.response.ReagentLotResponse;
import com.biodiagnostico.dto.response.ReagentTagSummary;
import com.biodiagnostico.dto.response.StockMovementResponse;
import com.biodiagnostico.service.ReagentService;
import com.biodiagnostico.util.ResponseMapper;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reagents")
public class ReagentController {

    private final ReagentService reagentService;

    public ReagentController(ReagentService reagentService) {
        this.reagentService = reagentService;
    }

    @GetMapping
    public ResponseEntity<List<ReagentLotResponse>> getLots(
        @RequestParam(required = false) String category,
        @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(reagentService.getLots(category, status));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('FUNCIONARIO')")
    public ResponseEntity<ReagentLotResponse> createLot(@Valid @RequestBody ReagentLotRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ResponseMapper.toReagentLotResponse(reagentService.createLot(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('FUNCIONARIO')")
    public ResponseEntity<ReagentLotResponse> updateLot(@PathVariable UUID id, @Valid @RequestBody ReagentLotRequest request) {
        return ResponseEntity.ok(ResponseMapper.toReagentLotResponse(reagentService.updateLot(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('FUNCIONARIO')")
    public ResponseEntity<Void> deleteLot(@PathVariable UUID id) {
        reagentService.deleteLot(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/movements")
    public ResponseEntity<List<StockMovementResponse>> getMovements(@PathVariable UUID id) {
        return ResponseEntity.ok(
            reagentService.getMovements(id).stream()
                .map(ResponseMapper::toStockMovementResponse)
                .toList()
        );
    }

    @PostMapping("/{id}/movements")
    @PreAuthorize("hasRole('ADMIN') or hasRole('FUNCIONARIO')")
    public ResponseEntity<StockMovementResponse> createMovement(
        @PathVariable UUID id,
        @Valid @RequestBody StockMovementRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ResponseMapper.toStockMovementResponse(reagentService.createMovement(id, request)));
    }

    @DeleteMapping("/movements/{movId}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('FUNCIONARIO')")
    public ResponseEntity<Void> deleteMovement(@PathVariable UUID movId) {
        reagentService.deleteMovement(movId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/by-lot-number")
    public ResponseEntity<List<ReagentLotResponse>> getByLotNumber(@RequestParam String lotNumber) {
        return ResponseEntity.ok(
            reagentService.getByLotNumber(lotNumber).stream()
                .map(ResponseMapper::toReagentLotResponse)
                .toList()
        );
    }

    @GetMapping("/expiring")
    public ResponseEntity<List<ReagentLotResponse>> getExpiringLots(@RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(reagentService.getExpiringLots(days).stream().map(ResponseMapper::toReagentLotResponse).toList());
    }

    @GetMapping("/tags")
    public ResponseEntity<List<ReagentTagSummary>> getTagSummaries() {
        return ResponseEntity.ok(reagentService.getTagSummaries());
    }

    @GetMapping("/export/csv")
    public ResponseEntity<byte[]> exportCsv(
        @RequestParam(required = false) String category,
        @RequestParam(required = false) String status
    ) {
        List<ReagentLotResponse> lots = reagentService.getLots(category, status);
        StringBuilder csv = new StringBuilder();
        csv.append("Nome,Lote,Categoria,Fabricante,Validade,Dias Restantes,Estoque Atual,Unidade,Consumo/Dia,Temperatura,Status\n");
        for (ReagentLotResponse lot : lots) {
            csv.append(escapeCsv(lot.name())).append(",");
            csv.append(escapeCsv(lot.lotNumber())).append(",");
            csv.append(escapeCsv(lot.category())).append(",");
            csv.append(escapeCsv(lot.manufacturer())).append(",");
            csv.append(lot.expiryDate() != null ? lot.expiryDate() : "").append(",");
            csv.append(lot.daysLeft()).append(",");
            csv.append(lot.currentStock() != null ? lot.currentStock() : 0).append(",");
            csv.append(escapeCsv(lot.stockUnit())).append(",");
            csv.append(lot.estimatedConsumption() != null ? lot.estimatedConsumption() : 0).append(",");
            csv.append(escapeCsv(lot.storageTemp())).append(",");
            csv.append(escapeCsv(lot.status())).append("\n");
        }
        return ResponseEntity.ok()
            .header("Content-Disposition", "attachment; filename=reagentes.csv")
            .header("Content-Type", "text/csv; charset=UTF-8")
            .body(csv.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}

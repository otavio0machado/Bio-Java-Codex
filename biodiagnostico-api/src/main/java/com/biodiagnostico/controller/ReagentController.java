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
    public ResponseEntity<ReagentLotResponse> createLot(@Valid @RequestBody ReagentLotRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ResponseMapper.toReagentLotResponse(reagentService.createLot(request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ReagentLotResponse> updateLot(@PathVariable UUID id, @Valid @RequestBody ReagentLotRequest request) {
        return ResponseEntity.ok(ResponseMapper.toReagentLotResponse(reagentService.updateLot(id, request)));
    }

    @DeleteMapping("/{id}")
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
    public ResponseEntity<StockMovementResponse> createMovement(
        @PathVariable UUID id,
        @Valid @RequestBody StockMovementRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ResponseMapper.toStockMovementResponse(reagentService.createMovement(id, request)));
    }

    @DeleteMapping("/movements/{movId}")
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
}

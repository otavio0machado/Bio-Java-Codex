package com.biodiagnostico.controller;

import com.biodiagnostico.dto.request.ImmunologyControlSetRequest;
import com.biodiagnostico.dto.request.ImmunologyRunRequest;
import com.biodiagnostico.dto.response.ImmunologyControlSetResponse;
import com.biodiagnostico.dto.response.ImmunologyRunResponse;
import com.biodiagnostico.service.ImmunologyQcService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
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
@RequestMapping("/api/qc/imunologia")
public class ImmunologyController {

    private final ImmunologyQcService immunologyQcService;

    public ImmunologyController(ImmunologyQcService immunologyQcService) {
        this.immunologyQcService = immunologyQcService;
    }

    @GetMapping("/control-sets")
    public ResponseEntity<List<ImmunologyControlSetResponse>> getControlSets(
        @RequestParam(required = false) String analito
    ) {
        return ResponseEntity.ok(immunologyQcService.getControlSets(analito));
    }

    @PostMapping("/control-sets")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('QC_WRITE')")
    public ResponseEntity<ImmunologyControlSetResponse> createControlSet(
        @Valid @RequestBody ImmunologyControlSetRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(immunologyQcService.createControlSet(request));
    }

    @PutMapping("/control-sets/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('QC_WRITE')")
    public ResponseEntity<ImmunologyControlSetResponse> updateControlSet(
        @PathVariable UUID id,
        @Valid @RequestBody ImmunologyControlSetRequest request
    ) {
        return ResponseEntity.ok(immunologyQcService.updateControlSet(id, request));
    }

    @DeleteMapping("/control-sets/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('QC_WRITE')")
    public ResponseEntity<Void> deactivateControlSet(@PathVariable UUID id) {
        immunologyQcService.deactivateControlSet(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/runs")
    public ResponseEntity<List<ImmunologyRunResponse>> getRuns(
        @RequestParam(required = false) String analito,
        @RequestParam(required = false) UUID controlSetId,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return ResponseEntity.ok(immunologyQcService.getRuns(analito, controlSetId, startDate, endDate));
    }

    @PostMapping("/runs")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('QC_WRITE')")
    public ResponseEntity<ImmunologyRunResponse> createRun(@Valid @RequestBody ImmunologyRunRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(immunologyQcService.createRun(request));
    }
}

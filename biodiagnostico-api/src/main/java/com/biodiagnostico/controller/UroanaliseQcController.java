package com.biodiagnostico.controller;

import com.biodiagnostico.dto.request.UroSedimentRunRequest;
import com.biodiagnostico.dto.request.UroStripControlSetRequest;
import com.biodiagnostico.dto.request.UroStripRunRequest;
import com.biodiagnostico.dto.response.UroSedimentRunResponse;
import com.biodiagnostico.dto.response.UroStripControlSetResponse;
import com.biodiagnostico.dto.response.UroStripRunResponse;
import com.biodiagnostico.service.UroanaliseQcService;
import jakarta.validation.Valid;
import java.security.Principal;
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
@RequestMapping("/api/qc/uroanalise")
public class UroanaliseQcController {

    private final UroanaliseQcService uroanaliseQcService;

    public UroanaliseQcController(UroanaliseQcService uroanaliseQcService) {
        this.uroanaliseQcService = uroanaliseQcService;
    }

    // ==========================================
    // CONTROLES DE FITA
    // ==========================================

    @GetMapping("/control-sets")
    @PreAuthorize("hasRole('ADMIN') or hasRole('FUNCIONARIO') or hasRole('VIGILANCIA_SANITARIA') or hasRole('VISUALIZADOR') or hasAuthority('QC_VIEW')")
    public ResponseEntity<List<UroStripControlSetResponse>> getControlSets(
        @RequestParam(defaultValue = "false") boolean includeInactive
    ) {
        return ResponseEntity.ok(uroanaliseQcService.getControlSets(includeInactive));
    }

    @PostMapping("/control-sets")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('QC_AREAS_WRITE') or hasAuthority('QC_WRITE')")
    public ResponseEntity<UroStripControlSetResponse> createControlSet(
        @Valid @RequestBody UroStripControlSetRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(uroanaliseQcService.createControlSet(request));
    }

    @PutMapping("/control-sets/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('QC_AREAS_WRITE') or hasAuthority('QC_WRITE')")
    public ResponseEntity<UroStripControlSetResponse> updateControlSet(
        @PathVariable UUID id,
        @Valid @RequestBody UroStripControlSetRequest request
    ) {
        return ResponseEntity.ok(uroanaliseQcService.updateControlSet(id, request));
    }

    @DeleteMapping("/control-sets/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('QC_AREAS_WRITE') or hasAuthority('QC_WRITE')")
    public ResponseEntity<Void> deactivateControlSet(@PathVariable UUID id) {
        uroanaliseQcService.deactivateControlSet(id);
        return ResponseEntity.noContent().build();
    }

    // ==========================================
    // CORRIDAS DE FITA REATIVA
    // ==========================================

    @GetMapping("/strip/runs")
    @PreAuthorize("hasRole('ADMIN') or hasRole('FUNCIONARIO') or hasRole('VIGILANCIA_SANITARIA') or hasRole('VISUALIZADOR') or hasAuthority('QC_VIEW')")
    public ResponseEntity<List<UroStripRunResponse>> getStripRuns(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return ResponseEntity.ok(uroanaliseQcService.getStripRuns(startDate, endDate));
    }

    @PostMapping("/strip/runs")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('QC_AREAS_WRITE') or hasAuthority('QC_WRITE')")
    public ResponseEntity<UroStripRunResponse> createStripRun(
        @Valid @RequestBody UroStripRunRequest request,
        Principal principal
    ) {
        String loggedUsername = principal != null ? principal.getName() : "Sistema";
        return ResponseEntity.status(HttpStatus.CREATED).body(uroanaliseQcService.createStripRun(request, loggedUsername));
    }

    @DeleteMapping("/strip/runs/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('QC_AREAS_WRITE') or hasAuthority('QC_WRITE')")
    public ResponseEntity<Void> deleteStripRun(@PathVariable UUID id) {
        uroanaliseQcService.deleteStripRun(id);
        return ResponseEntity.noContent().build();
    }

    // ==========================================
    // CORRIDAS DE SEDIMENTO URINÁRIO
    // ==========================================

    @GetMapping("/sediment/runs")
    @PreAuthorize("hasRole('ADMIN') or hasRole('FUNCIONARIO') or hasRole('VIGILANCIA_SANITARIA') or hasRole('VISUALIZADOR') or hasAuthority('QC_VIEW')")
    public ResponseEntity<List<UroSedimentRunResponse>> getSedimentRuns(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return ResponseEntity.ok(uroanaliseQcService.getSedimentRuns(startDate, endDate));
    }

    @PostMapping("/sediment/runs")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('QC_AREAS_WRITE') or hasAuthority('QC_WRITE')")
    public ResponseEntity<UroSedimentRunResponse> createSedimentRun(
        @Valid @RequestBody UroSedimentRunRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(uroanaliseQcService.createSedimentRun(request));
    }

    @DeleteMapping("/sediment/runs/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('QC_AREAS_WRITE') or hasAuthority('QC_WRITE')")
    public ResponseEntity<Void> deleteSedimentRun(@PathVariable UUID id) {
        uroanaliseQcService.deleteSedimentRun(id);
        return ResponseEntity.noContent().build();
    }
}

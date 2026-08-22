package com.biodiagnostico.controller;

import com.biodiagnostico.dto.request.TemperatureLocationRequest;
import com.biodiagnostico.dto.request.TemperatureOcrRequest;
import com.biodiagnostico.dto.request.TemperatureRecordRequest;
import com.biodiagnostico.dto.response.TemperatureLocationResponse;
import com.biodiagnostico.dto.response.TemperatureOcrResponse;
import com.biodiagnostico.dto.response.TemperatureRecordResponse;
import com.biodiagnostico.dto.response.TemperatureSummaryResponse;
import com.biodiagnostico.entity.TemperatureLocation;
import com.biodiagnostico.entity.TemperatureRecord;
import com.biodiagnostico.service.TemperatureService;
import com.biodiagnostico.util.ResponseMapper;
import jakarta.validation.Valid;
import java.security.Principal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
@RequestMapping("/api/temperature")
public class TemperatureController {

    private final TemperatureService temperatureService;

    public TemperatureController(TemperatureService temperatureService) {
        this.temperatureService = temperatureService;
    }

    // ========================================================================
    // LOCATIONS / PONTOS DE MONITORAMENTO
    // ========================================================================

    @GetMapping("/locations")
    public ResponseEntity<List<TemperatureLocationResponse>> getLocations(
        @RequestParam(required = false) String area,
        @RequestParam(required = false) Boolean active
    ) {
        List<TemperatureLocationResponse> list = temperatureService.getLocations(area, active)
            .stream()
            .map(ResponseMapper::toTemperatureLocationResponse)
            .toList();
        return ResponseEntity.ok(list);
    }

    @GetMapping("/locations/{id}")
    public ResponseEntity<TemperatureLocationResponse> getLocationById(@PathVariable UUID id) {
        TemperatureLocation loc = temperatureService.getLocationById(id);
        return ResponseEntity.ok(ResponseMapper.toTemperatureLocationResponse(loc));
    }

    @PostMapping("/locations")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('TEMPERATURE_WRITE') or hasAuthority('MAINTENANCE_WRITE')")
    public ResponseEntity<TemperatureLocationResponse> createLocation(
        @Valid @RequestBody TemperatureLocationRequest request
    ) {
        TemperatureLocation created = temperatureService.createLocation(request);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ResponseMapper.toTemperatureLocationResponse(created));
    }

    @PutMapping("/locations/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('TEMPERATURE_WRITE') or hasAuthority('MAINTENANCE_WRITE')")
    public ResponseEntity<TemperatureLocationResponse> updateLocation(
        @PathVariable UUID id,
        @Valid @RequestBody TemperatureLocationRequest request
    ) {
        TemperatureLocation updated = temperatureService.updateLocation(id, request);
        return ResponseEntity.ok(ResponseMapper.toTemperatureLocationResponse(updated));
    }

    @DeleteMapping("/locations/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteLocation(@PathVariable UUID id) {
        temperatureService.deleteLocation(id);
        return ResponseEntity.noContent().build();
    }

    // ========================================================================
    // RECORDS / MEDIÇÕES DIÁRIAS
    // ========================================================================

    @GetMapping("/records")
    public ResponseEntity<List<TemperatureRecordResponse>> getRecords(
        @RequestParam(required = false) UUID locationId,
        @RequestParam(required = false) Integer month,
        @RequestParam(required = false) Integer year,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
        @RequestParam(required = false) String status
    ) {
        List<TemperatureRecordResponse> list = temperatureService.getRecords(locationId, month, year, startDate, endDate, status)
            .stream()
            .map(ResponseMapper::toTemperatureRecordResponse)
            .toList();
        return ResponseEntity.ok(list);
    }

    @GetMapping("/records/{id}")
    public ResponseEntity<TemperatureRecordResponse> getRecordById(@PathVariable UUID id) {
        TemperatureRecord record = temperatureService.getRecordById(id);
        return ResponseEntity.ok(ResponseMapper.toTemperatureRecordResponse(record));
    }

    @PostMapping("/records")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('TEMPERATURE_WRITE') or hasAuthority('QC_WRITE') or hasAuthority('MAINTENANCE_WRITE')")
    public ResponseEntity<TemperatureRecordResponse> createRecord(
        @Valid @RequestBody TemperatureRecordRequest request,
        Principal principal
    ) {
        String username = principal != null ? principal.getName() : null;
        TemperatureRecord created = temperatureService.createRecord(request, username);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ResponseMapper.toTemperatureRecordResponse(created));
    }

    @PutMapping("/records/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('TEMPERATURE_WRITE') or hasAuthority('QC_WRITE') or hasAuthority('MAINTENANCE_WRITE')")
    public ResponseEntity<TemperatureRecordResponse> updateRecord(
        @PathVariable UUID id,
        @Valid @RequestBody TemperatureRecordRequest request,
        Principal principal
    ) {
        String username = principal != null ? principal.getName() : null;
        TemperatureRecord updated = temperatureService.updateRecord(id, request, username);
        return ResponseEntity.ok(ResponseMapper.toTemperatureRecordResponse(updated));
    }

    @DeleteMapping("/records/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('TEMPERATURE_WRITE')")
    public ResponseEntity<Void> deleteRecord(@PathVariable UUID id) {
        temperatureService.deleteRecord(id);
        return ResponseEntity.noContent().build();
    }

    // ========================================================================
    // OCR & SUMMARY & EXPORTS
    // ========================================================================

    @PostMapping("/ocr")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('TEMPERATURE_WRITE') or hasAuthority('QC_WRITE') or hasAuthority('MAINTENANCE_WRITE')")
    public ResponseEntity<TemperatureOcrResponse> processPhoto(@Valid @RequestBody TemperatureOcrRequest request) {
        TemperatureOcrResponse response = temperatureService.processThermometerPhoto(
            request.imageBase64(),
            request.mimeType(),
            request.locationId()
        );
        return ResponseEntity.ok(response);
    }

    @GetMapping("/summary")
    public ResponseEntity<TemperatureSummaryResponse> getSummary() {
        return ResponseEntity.ok(temperatureService.getSummary());
    }

    @GetMapping("/export/excel")
    public ResponseEntity<byte[]> exportExcel(
        @RequestParam(required = false) UUID locationId,
        @RequestParam(defaultValue = "8") int month,
        @RequestParam(defaultValue = "2026") int year
    ) {
        byte[] bytes = temperatureService.exportToExcel(locationId, month, year);
        String filename = String.format("Controle_Temperatura_%02d_%d.csv", month, year);

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
            .body(bytes);
    }

    @GetMapping("/export/pdf")
    public ResponseEntity<byte[]> exportPdf(
        @RequestParam(required = false) UUID locationId,
        @RequestParam(defaultValue = "8") int month,
        @RequestParam(defaultValue = "2026") int year
    ) {
        byte[] bytes = temperatureService.generateMonthlyPdfReport(locationId, month, year);
        String filename = String.format("Relatorio_Temperatura_%02d_%d.pdf", month, year);

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.APPLICATION_PDF)
            .body(bytes);
    }
}

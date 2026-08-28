package com.biodiagnostico.controller;

import com.biodiagnostico.dto.response.DashboardAlertsResponse;
import com.biodiagnostico.dto.response.DashboardKpiResponse;
import com.biodiagnostico.dto.response.QcRecordResponse;
import com.biodiagnostico.service.DashboardService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/kpis")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN') or hasRole('VIGILANCIA_SANITARIA') or hasRole('VISUALIZADOR') or hasAuthority('DASHBOARD_VIEW')")
    public ResponseEntity<DashboardKpiResponse> getKpis(@RequestParam(required = false) String area) {
        return ResponseEntity.ok(dashboardService.getKpis(area));
    }

    @GetMapping("/alerts")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN') or hasRole('VIGILANCIA_SANITARIA') or hasRole('VISUALIZADOR') or hasAuthority('DASHBOARD_VIEW')")
    public ResponseEntity<DashboardAlertsResponse> getAlerts() {
        return ResponseEntity.ok(dashboardService.getAlerts());
    }

    @GetMapping("/recent-records")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN') or hasRole('VIGILANCIA_SANITARIA') or hasRole('VISUALIZADOR') or hasAuthority('DASHBOARD_VIEW')")
    public ResponseEntity<List<QcRecordResponse>> getRecentRecords(
        @RequestParam(required = false) String area,
        @RequestParam(defaultValue = "10") int limit
    ) {
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        return ResponseEntity.ok(dashboardService.getRecentRecords(area, safeLimit));
    }
}

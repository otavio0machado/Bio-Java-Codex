package com.biodiagnostico.dto.response;

public record TemperatureSummaryResponse(
    long totalLocations,
    long activeLocations,
    long recordedToday,
    long pendingToday,
    long nonCompliantToday,
    long nonCompliantMonth,
    long expiringCalibrationsCount
) {
}

package com.biodiagnostico.service.reports.v2.util;

import java.text.Normalizer;
import java.util.Locale;

public final class WestgardSeverity {

    private WestgardSeverity() {
    }

    public static boolean isRejection(String severity) {
        String normalized = normalize(severity);
        return "REJECTION".equals(normalized)
            || "REJEICAO".equals(normalized)
            || "CRITICAL".equals(normalized)
            || "CRITICO".equals(normalized);
    }

    public static boolean isWarning(String severity) {
        String normalized = normalize(severity);
        return "WARNING".equals(normalized)
            || "WARN".equals(normalized)
            || "ADVERTENCIA".equals(normalized)
            || "ALERTA".equals(normalized);
    }

    public static boolean matchesFilter(String severity, String filter) {
        if (filter == null || filter.isBlank()) {
            return true;
        }
        if (isRejection(filter)) {
            return isRejection(severity);
        }
        if (isWarning(filter)) {
            return isWarning(severity);
        }
        return normalize(severity).equals(normalize(filter));
    }

    public static String display(String severity) {
        if (isRejection(severity)) {
            return "REJEICAO";
        }
        if (isWarning(severity)) {
            return "ADVERTENCIA";
        }
        return severity == null || severity.isBlank() ? "-" : severity;
    }

    private static String normalize(String value) {
        if (value == null) {
            return "";
        }
        String upper = value.trim().toUpperCase(Locale.ROOT);
        return Normalizer.normalize(upper, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }
}

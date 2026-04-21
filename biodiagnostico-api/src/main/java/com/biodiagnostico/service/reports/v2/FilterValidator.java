package com.biodiagnostico.service.reports.v2;

import com.biodiagnostico.service.reports.v2.catalog.ReportFilterField;
import com.biodiagnostico.service.reports.v2.catalog.ReportFilterFieldType;
import com.biodiagnostico.service.reports.v2.catalog.ReportFilterSpec;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Valida um mapa cru de filtros ({@code Map<String, Object>}) contra uma
 * {@link ReportFilterSpec}. Coleta todas as violacoes e as agrega em uma
 * unica {@link InvalidFilterException} para que o cliente consiga corrigir
 * tudo de uma vez.
 *
 * <p>Chaves nao declaradas sao ignoradas (apenas logadas em nivel DEBUG);
 * isso permite evoluir a spec de forma retrocompativel.
 */
@Component
public class FilterValidator {

    private static final Logger LOG = LoggerFactory.getLogger(FilterValidator.class);

    public void validate(ReportFilterSpec spec, Map<String, Object> rawValues) {
        if (spec == null) {
            throw new IllegalArgumentException("ReportFilterSpec obrigatorio");
        }
        Map<String, Object> values = rawValues == null ? Map.of() : rawValues;
        List<String> violations = new ArrayList<>();
        Set<String> declaredKeys = new HashSet<>();

        for (ReportFilterField field : spec.fields()) {
            declaredKeys.add(field.key());
            Object rawValue = values.get(field.key());
            boolean present = rawValue != null && !(rawValue instanceof String s && s.isBlank());

            if (!present) {
                if (field.required()) {
                    violations.add("Filtro '" + field.key() + "' e obrigatorio");
                }
                continue;
            }

            validateField(field, rawValue, violations);
        }

        for (String key : values.keySet()) {
            if (!declaredKeys.contains(key)) {
                LOG.debug("Filtro '{}' nao declarado na spec — ignorado", key);
            }
        }

        // Cross-field rules (Ressalva 4): examIds so e suportado em area=bioquimica.
        // Outros geradores (hematologia, generic area) ignoram silenciosamente —
        // entao bloqueamos upstream para nao gerar laudo enganoso.
        validateExamIdsOnlyForBioquimica(values, declaredKeys, violations);

        if (!violations.isEmpty()) {
            throw new InvalidFilterException(violations);
        }
    }

    /**
     * {@code examIds} e um filtro declarado na spec de CQ_OPERATIONAL_V2 mas hoje
     * apenas o generator de bioquimica respeita. Para evitar que o usuario peca
     * filtro em hematologia/imunologia/outros e receba um laudo sem filtrar
     * (comportamento confuso), bloqueamos upstream com 422.
     */
    private void validateExamIdsOnlyForBioquimica(
        Map<String, Object> values, Set<String> declaredKeys, List<String> violations
    ) {
        if (!declaredKeys.contains("examIds") || !declaredKeys.contains("area")) {
            return;
        }
        Object examIdsRaw = values.get("examIds");
        boolean examIdsProvided = examIdsRaw instanceof List<?> list && !list.isEmpty();
        if (!examIdsProvided) return;

        Object areaRaw = values.get("area");
        String area = areaRaw == null ? null : areaRaw.toString();
        if (!"bioquimica".equals(area)) {
            violations.add(
                "Filtro 'examIds' so e suportado para area=bioquimica (recebido area="
                + (area == null ? "null" : area) + ")"
            );
        }
    }

    private void validateField(ReportFilterField field, Object rawValue, List<String> violations) {
        switch (field.type()) {
            case STRING_ENUM -> {
                String asString = rawValue.toString();
                if (!field.allowedValues().isEmpty() && !field.allowedValues().contains(asString)) {
                    violations.add("Filtro '" + field.key() + "' deve ser um de " + field.allowedValues()
                        + " (recebido: " + asString + ")");
                }
            }
            case INTEGER -> {
                Integer value = coerceInteger(rawValue);
                if (value == null) {
                    violations.add("Filtro '" + field.key() + "' deve ser inteiro (recebido: " + rawValue + ")");
                    return;
                }
                if ("month".equals(field.key()) && (value < 1 || value > 12)) {
                    violations.add("Filtro 'month' deve estar entre 1 e 12");
                }
                if ("year".equals(field.key()) && (value < 2000 || value > 2100)) {
                    violations.add("Filtro 'year' deve estar entre 2000 e 2100");
                }
            }
            case DATE -> {
                if (coerceDate(rawValue) == null) {
                    violations.add("Filtro '" + field.key() + "' deve ser uma data ISO yyyy-MM-dd (recebido: " + rawValue + ")");
                }
            }
            case DATE_RANGE -> {
                if (!(rawValue instanceof Map)) {
                    violations.add("Filtro '" + field.key() + "' deve ser um objeto {from, to}");
                }
            }
            case UUID -> {
                if (coerceUuid(rawValue) == null) {
                    violations.add("Filtro '" + field.key() + "' deve ser um UUID valido (recebido: " + rawValue + ")");
                }
            }
            case UUID_LIST -> {
                if (!(rawValue instanceof List<?> list)) {
                    violations.add("Filtro '" + field.key() + "' deve ser uma lista de UUIDs");
                    return;
                }
                for (Object item : list) {
                    if (coerceUuid(item) == null) {
                        violations.add("Filtro '" + field.key() + "' contem UUID invalido: " + item);
                        break;
                    }
                }
            }
            case BOOLEAN -> {
                if (!(rawValue instanceof Boolean) && !(rawValue instanceof String)) {
                    violations.add("Filtro '" + field.key() + "' deve ser booleano");
                }
            }
        }
    }

    private Integer coerceInteger(Object raw) {
        if (raw instanceof Integer i) return i;
        if (raw instanceof Number n) return n.intValue();
        if (raw instanceof String s) {
            try {
                return Integer.parseInt(s.trim());
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        return null;
    }

    private LocalDate coerceDate(Object raw) {
        if (raw instanceof LocalDate ld) return ld;
        if (raw instanceof String s) {
            try {
                return LocalDate.parse(s.trim());
            } catch (Exception ex) {
                return null;
            }
        }
        return null;
    }

    private UUID coerceUuid(Object raw) {
        if (raw instanceof UUID u) return u;
        if (raw instanceof String s) {
            try {
                return UUID.fromString(s.trim());
            } catch (IllegalArgumentException ex) {
                return null;
            }
        }
        return null;
    }
}

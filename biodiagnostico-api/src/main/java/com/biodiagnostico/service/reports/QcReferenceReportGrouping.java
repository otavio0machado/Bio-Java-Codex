package com.biodiagnostico.service.reports;

import com.biodiagnostico.entity.QcRecord;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;

/** Presentation-only grouping of persisted QC references and measurement snapshots. */
public final class QcReferenceReportGrouping {

    public static final String REFERENCE_METADATA_NOTE =
        "Nome da referência conforme cadastro atual; valores e decisão conforme registro da medição.";

    private static final Comparator<String> TEXT_ORDER = Comparator.nullsLast(Comparator.naturalOrder());
    private static final Comparator<UUID> ID_ORDER =
        Comparator.nullsLast(Comparator.comparing(UUID::toString));

    private QcReferenceReportGrouping() {}

    public record ReferenceKey(UUID referenceId, String examName, String level, String lotNumber) {}

    public record Group<T>(QcRecord record, List<T> items) {}

    public static ReferenceKey key(QcRecord record) {
        UUID referenceId = record == null || record.getReference() == null
            ? null : record.getReference().getId();
        if (referenceId != null) {
            return new ReferenceKey(referenceId, null, null, null);
        }
        return new ReferenceKey(null,
            record == null ? null : record.getExamName(),
            record == null ? null : record.getLevel(),
            record == null ? null : record.getLotNumber());
    }

    public static String referenceLabel(QcRecord record) {
        UUID id = key(record).referenceId();
        if (id == null) return "Sem referência vinculada";
        return display(record.getReference().getName()) + " | ID: " + id;
    }

    public static String referenceContext(QcRecord record) {
        String prefix = key(record).referenceId() == null ? "" : "Contexto do registro usado no cabeçalho: ";
        return prefix + "Exame: " + display(record == null ? null : record.getExamName())
            + " | Nível: " + display(record == null ? null : record.getLevel())
            + " | Lote: " + display(record == null ? null : record.getLotNumber());
    }

    public static List<Group<QcRecord>> groups(List<QcRecord> records) {
        return groups(records, Function.identity(), QcRecord::getDate, QcRecord::getCreatedAt, QcRecord::getId);
    }

    public static <T> List<Group<T>> groups(
        List<T> items,
        Function<T, QcRecord> record,
        Function<T, LocalDate> date,
        Function<T, Instant> createdAt,
        Function<T, UUID> id
    ) {
        Objects.requireNonNull(items, "items");
        Objects.requireNonNull(record, "record");
        Objects.requireNonNull(date, "date");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(id, "id");
        Map<ReferenceKey, List<T>> byReference = new LinkedHashMap<>();
        Map<ReferenceKey, QcRecord> representatives = new LinkedHashMap<>();
        for (T item : items) {
            Objects.requireNonNull(item, "item");
            QcRecord measurement = record.apply(item);
            ReferenceKey key = key(measurement);
            if (!byReference.containsKey(key)) {
                // Retain the original representative: existing statistics and chart
                // target/SD selection must not change when presentation is reordered.
                representatives.put(key, measurement);
                byReference.put(key, new ArrayList<>());
            }
            byReference.get(key).add(item);
        }
        Comparator<T> itemOrder = Comparator
            .comparing(date, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(createdAt, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(id, ID_ORDER);
        Comparator<ReferenceKey> groupOrder = Comparator
            .comparing((ReferenceKey k) -> k.referenceId() == null)
            .thenComparing(k -> k.referenceId() == null ? null
                : representatives.get(k).getReference().getName(), TEXT_ORDER)
            .thenComparing(ReferenceKey::referenceId, ID_ORDER)
            .thenComparing(ReferenceKey::examName, TEXT_ORDER)
            .thenComparing(ReferenceKey::level, TEXT_ORDER)
            .thenComparing(ReferenceKey::lotNumber, TEXT_ORDER);
        return byReference.keySet().stream().sorted(groupOrder)
            .map(k -> new Group<>(representatives.get(k), byReference.get(k).stream().sorted(itemOrder).toList()))
            .toList();
    }

    private static String display(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }
}

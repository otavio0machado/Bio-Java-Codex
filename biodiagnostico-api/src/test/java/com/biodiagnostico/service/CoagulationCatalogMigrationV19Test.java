package com.biodiagnostico.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CoagulationCatalogMigrationV19Test {

    private static final Path V19 = Path.of(
        "src/main/resources/db/migration/V19__seed_coagulation_qc_exams.sql");

    private String readMigration() throws IOException {
        return Files.readString(V19);
    }

    @Test
    @DisplayName("V19 deve semear somente o catálogo canônico de coagulação")
    void shouldSeedOnlyCanonicalCoagulationCatalog() throws IOException {
        String sql = readMigration();

        assertThat(sql).contains("'Atividade (%)', 'coagulacao', '%'");
        assertThat(sql).contains("'INR', 'coagulacao', NULL");
        assertThat(sql).contains("'TTPA', 'coagulacao', 's'");
        assertThat(sql).doesNotContainIgnoringCase("fibrinog");
        assertThat(sql).doesNotContain("INSERT INTO qc_reference_values");
    }

    @Test
    @DisplayName("V19 deve garantir os três UUIDs fixos idempotentemente")
    void shouldUseFixedUuidsAndIdempotentGuards() throws IOException {
        String sql = readMigration();

        assertThat(sql).contains("c0a60000-0000-4000-8000-000000000001");
        assertThat(sql).contains("c0a60000-0000-4000-8000-000000000002");
        assertThat(sql).contains("c0a60000-0000-4000-8000-000000000003");
        assertThat(countOccurrences(sql, "ON CONFLICT (id) DO NOTHING")).isEqualTo(3);
    }

    @Test
    @DisplayName("V19 deve reatribuir referências antes de excluir duplicatas")
    void shouldReassignReferencesBeforeDeletingDuplicates() throws IOException {
        String sql = readMigration();
        int firstReferenceUpdate = sql.indexOf("UPDATE qc_reference_values");
        int firstDelete = sql.indexOf("DELETE FROM qc_exams");

        assertThat(firstReferenceUpdate).isGreaterThanOrEqualTo(0).isLessThan(firstDelete);
        assertThat(countOccurrences(sql, "UPDATE qc_reference_values")).isEqualTo(3);
        assertThat(countOccurrences(sql, "DELETE FROM qc_exams")).isEqualTo(3);
        assertThat(sql).contains("SET exam_id = CAST('c0a60000-0000-4000-8000-000000000001' AS UUID)");
        assertThat(sql).contains("SET exam_id = CAST('c0a60000-0000-4000-8000-000000000002' AS UUID)");
        assertThat(sql).contains("SET exam_id = CAST('c0a60000-0000-4000-8000-000000000003' AS UUID)");
    }

    @Test
    @DisplayName("V19 deve normalizar os canônicos e criar índice único parcial")
    void shouldNormalizeCanonicalRowsAndCreatePartialUniqueIndex() throws IOException {
        String sql = readMigration();

        assertThat(countOccurrences(sql, "UPDATE qc_exams")).isEqualTo(3);
        assertThat(sql).contains("SET name = 'Atividade (%)', area = 'coagulacao', unit = '%', is_active = TRUE");
        assertThat(sql).contains("SET name = 'INR', area = 'coagulacao', unit = NULL, is_active = TRUE");
        assertThat(sql).contains("SET name = 'TTPA', area = 'coagulacao', unit = 's', is_active = TRUE");
        assertThat(sql).contains("CREATE UNIQUE INDEX IF NOT EXISTS uq_qc_exams_coagulacao_name");
        assertThat(sql).contains("ON qc_exams (LOWER(TRIM(name)))");
        assertThat(sql).contains("WHERE LOWER(TRIM(area)) = 'coagulacao'");
    }

    private long countOccurrences(String value, String token) {
        return value.lines().filter(line -> line.contains(token)).count();
    }
}

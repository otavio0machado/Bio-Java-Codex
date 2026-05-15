package com.biodiagnostico.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Teste estatico do conteudo da migracao V16.
 *
 * <p>Sem Testcontainers no pom, validamos o contrato textual da migracao: a
 * unicidade de reagentes deixa de ser (lot_number, manufacturer) e passa a ser
 * (lot_number, manufacturer, name), onde {@code name} e a etiqueta exposta como
 * {@code label} no contrato HTTP/UI.</p>
 */
class ReagentMigrationV16Test {

    private static final Path V16 = Path.of(
        "src/main/resources/db/migration/V16__reagent_lot_unique_natural_key.sql");

    private String readMigration() throws IOException {
        return Files.readString(V16);
    }

    @Test
    @DisplayName("V16: remove indice antigo por lote + fabricante")
    void v16_removeIndiceAntigo() throws IOException {
        String sql = readMigration();

        assertThat(sql).contains("DROP INDEX IF EXISTS idx_reagent_lot_manufacturer");
    }

    @Test
    @DisplayName("V16: cria indice unico por lote + fabricante + etiqueta")
    void v16_criaIndiceNaturalComEtiqueta() throws IOException {
        String sql = readMigration();

        assertThat(sql).contains("CREATE UNIQUE INDEX IF NOT EXISTS idx_reagent_lot_natural_key");
        assertThat(sql).contains("LOWER(TRIM(lot_number))");
        assertThat(sql).contains("LOWER(TRIM(COALESCE(manufacturer, '')))");
        assertThat(sql).contains("LOWER(TRIM(name))");
    }

    @Test
    @DisplayName("V16: documenta name como label operacional")
    void v16_documentaNameComoLabel() throws IOException {
        String sql = readMigration();

        assertThat(sql).containsIgnoringCase("label");
        assertThat(sql).containsIgnoringCase("etiqueta");
    }
}

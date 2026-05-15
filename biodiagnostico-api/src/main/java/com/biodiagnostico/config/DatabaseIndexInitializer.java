package com.biodiagnostico.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DatabaseIndexInitializer {

    private static final Logger log = LoggerFactory.getLogger(DatabaseIndexInitializer.class);

    private final JdbcTemplate jdbcTemplate;

    public DatabaseIndexInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void createPartialIndexes() {
        try {
            jdbcTemplate.execute("DROP INDEX IF EXISTS idx_reagent_lot_manufacturer");
            jdbcTemplate.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_reagent_lot_natural_key "
                    + "ON reagent_lots ("
                    + "LOWER(TRIM(lot_number)), "
                    + "LOWER(TRIM(COALESCE(manufacturer, ''))), "
                    + "LOWER(TRIM(name)))"
            );
            log.info("Indice unico idx_reagent_lot_natural_key verificado/criado com sucesso.");
        } catch (Exception e) {
            log.warn("Falha ao criar indice unico idx_reagent_lot_natural_key: {}", e.getMessage());
        }
    }
}

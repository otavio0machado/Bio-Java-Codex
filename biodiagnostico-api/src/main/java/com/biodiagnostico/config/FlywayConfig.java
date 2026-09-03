package com.biodiagnostico.config;

import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FlywayConfig {

    private static final Logger log = LoggerFactory.getLogger(FlywayConfig.class);

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return (Flyway flyway) -> {
            log.info("Executando flyway.repair() para sanitizar histórico de migrações e alinhar checksums...");
            try {
                flyway.repair();
                log.info("flyway.repair() concluído com sucesso.");
            } catch (Exception e) {
                log.warn("flyway.repair() retornou aviso/erro: {}", e.getMessage());
            }

            log.info("Executando flyway.migrate()...");
            flyway.migrate();
            log.info("flyway.migrate() concluído com sucesso.");
        };
    }
}

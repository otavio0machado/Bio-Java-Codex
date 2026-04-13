package com.biodiagnostico.config;

import com.biodiagnostico.entity.Role;
import com.biodiagnostico.entity.User;
import com.biodiagnostico.repository.UserRepository;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@Profile("prod")
public class ProdDataConfig {

    private static final Logger log = LoggerFactory.getLogger(ProdDataConfig.class);

    @Value("${app.admin.username:evandro}")
    private String adminUsername;

    @Value("${app.admin.name:Evandro Torres Machado}")
    private String adminName;

    @Value("${ADMIN_INITIAL_PASSWORD:eva123}")
    private String adminInitialPassword;

    @Bean
    CommandLineRunner prodAdminSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.existsByUsername(adminUsername)) {
                log.info("Admin user '{}' already exists, skipping seed.", adminUsername);
                return;
            }
            if (adminInitialPassword == null || adminInitialPassword.isBlank()) {
                log.warn("ADMIN_INITIAL_PASSWORD not set — skipping admin seed. Set it to create the initial admin.");
                return;
            }

            User admin = User.builder()
                .username(adminUsername)
                .name(adminName)
                .passwordHash(passwordEncoder.encode(adminInitialPassword))
                .role(Role.ADMIN)
                .permissions(Set.of())
                .isActive(true)
                .build();

            userRepository.save(admin);
            log.info("Admin user '{}' created successfully.", adminUsername);
        };
    }
}

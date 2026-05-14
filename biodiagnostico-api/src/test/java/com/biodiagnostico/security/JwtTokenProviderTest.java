package com.biodiagnostico.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.biodiagnostico.entity.Permission;
import com.biodiagnostico.entity.Role;
import com.biodiagnostico.entity.User;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class JwtTokenProviderTest {

    private static final String TEST_JWT_SECRET = "testsecretkeythatisfarlongerthanthirtytwobytesforjwt";

    @Test
    void shouldIncludeUserPermissionsInAccessTokenDetails() {
        JwtTokenProvider provider = new JwtTokenProvider(TEST_JWT_SECRET, "test-issuer", 900_000, 604_800_000);
        User user = User.builder()
            .id(UUID.randomUUID())
            .username("ana")
            .role(Role.FUNCIONARIO)
            .permissions(Set.of(Permission.QC_WRITE, Permission.IMPORT))
            .build();

        String token = provider.generateAccessToken(user);
        JwtTokenProvider.TokenDetails details = provider.validateAccessToken(token);

        assertThat(details.role()).isEqualTo("FUNCIONARIO");
        assertThat(details.permissions()).containsExactly("IMPORT", "QC_WRITE");
    }
}

package com.biodiagnostico.security;

import com.biodiagnostico.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenProvider {

    private final SecretKey secretKey;
    private final long accessTokenExpiry;
    private final long refreshTokenExpiry;

    public JwtTokenProvider(
        @Value("${jwt.secret}") String secret,
        @Value("${jwt.access-token-expiry}") long accessTokenExpiry,
        @Value("${jwt.refresh-token-expiry}") long refreshTokenExpiry
    ) {
        this.secretKey = buildKey(secret);
        this.accessTokenExpiry = accessTokenExpiry;
        this.refreshTokenExpiry = refreshTokenExpiry;
    }

    public String generateAccessToken(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(user.getId().toString())
            .claim("email", user.getEmail())
            .claim("role", user.getRole())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusMillis(accessTokenExpiry)))
            .signWith(secretKey)
            .compact();
    }

    public String generateRefreshToken(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(user.getId().toString())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusMillis(refreshTokenExpiry)))
            .signWith(secretKey)
            .compact();
    }

    public boolean isTokenValid(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException exception) {
            return false;
        }
    }

    public UUID getUserId(String token) {
        return UUID.fromString(parseClaims(token).getSubject());
    }

    public String getEmail(String token) {
        return parseClaims(token).get("email", String.class);
    }

    public String getRole(String token) {
        return parseClaims(token).get("role", String.class);
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
            .verifyWith(secretKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    private SecretKey buildKey(String secret) {
        String normalizedSecret = secret == null ? "" : secret.trim();
        byte[] keyBytes = normalizedSecret.getBytes(StandardCharsets.UTF_8);

        if (looksEncoded(normalizedSecret)) {
            try {
                keyBytes = Decoders.BASE64.decode(normalizedSecret);
            } catch (RuntimeException ignored) {
                try {
                    keyBytes = Decoders.BASE64URL.decode(normalizedSecret);
                } catch (RuntimeException ignoredAgain) {
                    keyBytes = normalizedSecret.getBytes(StandardCharsets.UTF_8);
                }
            }
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }

    private boolean looksEncoded(String secret) {
        return secret.length() >= 44 && secret.matches("^[A-Za-z0-9+/=_-]+$");
    }
}

package com.biodiagnostico.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final AccessTokenBlacklistService accessTokenBlacklistService;
    private final com.biodiagnostico.repository.UserRepository userRepository;

    public JwtAuthFilter(
        JwtTokenProvider jwtTokenProvider,
        AccessTokenBlacklistService accessTokenBlacklistService
    ) {
        this(jwtTokenProvider, accessTokenBlacklistService, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public JwtAuthFilter(
        JwtTokenProvider jwtTokenProvider,
        AccessTokenBlacklistService accessTokenBlacklistService,
        @org.springframework.context.annotation.Lazy com.biodiagnostico.repository.UserRepository userRepository
    ) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.accessTokenBlacklistService = accessTokenBlacklistService;
        this.userRepository = userRepository;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return (path != null && path.startsWith("/actuator/health"))
            || "/actuator/prometheus".equals(path)
            || "/api/auth/login".equals(path)
            || "/api/auth/refresh".equals(path)
            || "/api/auth/forgot-password".equals(path)
            || "/api/auth/reset-password".equals(path);
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtTokenProvider.isAccessTokenValid(token)) {
                JwtTokenProvider.TokenDetails details = jwtTokenProvider.validateAccessToken(token);
                if (!accessTokenBlacklistService.isBlacklisted(details.tokenId())) {
                    if (userRepository != null) {
                        com.biodiagnostico.entity.User user = userRepository.findById(details.userId()).orElse(null);
                        if (user != null && Boolean.TRUE.equals(user.getIsActive())) {
                            List<SimpleGrantedAuthority> authorities = new ArrayList<>();
                            authorities.add(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
                            user.getEffectivePermissions().stream()
                                .map(p -> new SimpleGrantedAuthority(p.name()))
                                .forEach(authorities::add);
                            UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(
                                    user.getUsername(),
                                    null,
                                    authorities
                                );
                            authentication.setDetails(user.getId());
                            SecurityContextHolder.getContext().setAuthentication(authentication);
                        }
                    } else {
                        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
                        authorities.add(new SimpleGrantedAuthority("ROLE_" + details.role()));
                        details.permissions().stream()
                            .map(SimpleGrantedAuthority::new)
                            .forEach(authorities::add);
                        UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(
                                details.username(),
                                null,
                                authorities
                            );
                        authentication.setDetails(details.userId());
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    }
                }
            }
        }
        filterChain.doFilter(request, response);
    }
}

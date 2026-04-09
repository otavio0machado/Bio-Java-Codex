# 04 — Autenticação e Segurança

## Visão Geral

O sistema atual usa Supabase Auth (email/senha com cookies de 7 dias). O novo sistema usa **Spring Security + JWT** no backend e **sessionStorage** no frontend.

## Fluxo de Autenticação

```
1. Usuário entra email/senha no React
2. React envia POST /api/auth/login
3. Backend valida com BCrypt
4. Backend retorna { accessToken, refreshToken, user }
5. React salva tokens em memória (sessionStorage)
6. Toda request inclui header: Authorization: Bearer <accessToken>
7. Quando accessToken expira (15min), React chama POST /api/auth/refresh
8. Se refreshToken expirou (7 dias), redireciona para /login
```

## Backend: Spring Security

### SecurityConfig.java
```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtAuthFilter jwtFilter) {
        return http
            .csrf(csrf -> csrf.disable())
            .cors(Customizer.withDefaults())
            .sessionManagement(sm -> sm.sessionCreationPolicy(STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

### Roles
- **ADMIN**: Tudo (criar usuários, deletar registros, configurações)
- **ANALYST**: CRUD de CQ, reagentes, manutenção
- **VIEWER**: Apenas leitura (dashboard, relatórios)

### JWT Tokens
- **Access Token**: 15 minutos, contém userId + email + role
- **Refresh Token**: 7 dias, apenas userId

## Frontend: Proteção de Rotas

```tsx
// components/layout/PrivateRoute.tsx
function PrivateRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" />;

  return <Outlet />;
}
```

### useAuth Hook
```tsx
function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Na montagem: verificar se tem token válido
  // Login: POST /api/auth/login → salvar tokens
  // Logout: limpar tokens → redirecionar
  // Auto-refresh: timer antes do accessToken expirar
}
```

## Comparação com o Sistema Atual

| Aspecto | Atual (Supabase Auth) | Novo (Spring Security) |
|---|---|---|
| Provedor | Supabase gerencia tudo | Nós controlamos tudo |
| Senha | Supabase hash | BCrypt (Spring) |
| Token | Cookie httpOnly (7 dias) | JWT em sessionStorage |
| Refresh | Supabase automático | Endpoint /api/auth/refresh |
| Roles | Não implementado | ADMIN, ANALYST, VIEWER |
| Auditoria | Não tem | audit_log com user_id |

## Variáveis de Ambiente Necessárias

```bash
# Backend (Railway)
JWT_SECRET=chave-secreta-longa-e-aleatoria-min-256-bits
DB_HOST=db.xxxxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=sua-senha-supabase

# Frontend (Railway)
VITE_API_URL=https://biodiagnostico-api.up.railway.app/api
PUBLIC_SITE_URL=https://biodiagnostico-web.up.railway.app
```

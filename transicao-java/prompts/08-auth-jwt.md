# Prompt 08 — Autenticação Spring Security + JWT

Cole este prompt inteiro no Claude:

---

Crie o sistema de autenticação completo para o Biodiagnóstico 4.0 usando Spring Security + JWT. Pacotes: `com.biodiagnostico.security`, `com.biodiagnostico.service`, `com.biodiagnostico.controller`, `com.biodiagnostico.config`.

## Contexto:
O sistema atual usa Supabase Auth com cookies de 7 dias. Estamos migrando para autenticação própria com JWT. O frontend React armazena tokens em sessionStorage e envia no header Authorization.

## Arquivos necessários:

### 1. JwtTokenProvider.java (security/)
- Gerar access token (15 min): contém userId, email, role no claims
- Gerar refresh token (7 dias): contém apenas userId
- Validar token: verificar assinatura e expiração
- Extrair claims: getUserId(), getEmail(), getRole()
- Usar io.jsonwebtoken (jjwt) library
- Secret key lida do application.yml (jwt.secret)
- Tempos de expiração lidos do yml

### 2. JwtAuthFilter.java (security/)
- Extends OncePerRequestFilter
- Para cada request:
  1. Extrair token do header Authorization: "Bearer <token>"
  2. Se token existe e é válido → criar UsernamePasswordAuthenticationToken
  3. Setar no SecurityContextHolder
  4. Se não tem token ou é inválido → seguir sem autenticação (Spring Security trata)
- Não filtrar rotas /api/auth/** e /actuator/health

### 3. SecurityConfig.java (config/)
- CSRF desabilitado (API stateless)
- CORS habilitado (usa CorsConfig)
- Session management: STATELESS
- Rotas públicas: /api/auth/**, /actuator/health
- Todas as outras: authenticated
- Adicionar JwtAuthFilter antes do UsernamePasswordAuthenticationFilter
- PasswordEncoder: BCryptPasswordEncoder

### 4. AuthService.java (service/)

**login(LoginRequest) → AuthResponse**
1. Buscar user por email
2. Verificar se isActive
3. Verificar senha com passwordEncoder.matches()
4. Se inválido → lançar BusinessException("Credenciais inválidas")
5. Gerar accessToken e refreshToken
6. Retornar AuthResponse(accessToken, refreshToken, UserResponse)

**refreshToken(RefreshTokenRequest) → AuthResponse**
1. Validar refreshToken
2. Extrair userId
3. Buscar user
4. Gerar novos tokens
5. Retornar

**register(RegisterRequest) → UserResponse** (admin only)
1. Verificar se email já existe
2. Hash da senha com BCrypt
3. Salvar user
4. Retornar UserResponse (sem passwordHash)

### 5. AuthController.java (controller/)
```
POST /api/auth/login    → login(@Valid LoginRequest)    → 200 + AuthResponse
POST /api/auth/refresh  → refresh(@Valid RefreshRequest) → 200 + AuthResponse
POST /api/auth/register → register(@Valid RegisterRequest) → 201 + UserResponse
```
Register deve ser protegido: apenas ADMIN pode criar usuários. Use `@PreAuthorize("hasRole('ADMIN')")`.

### 6. DTOs:
- LoginRequest: email (NotBlank, Email), password (NotBlank, Size min 6)
- RefreshTokenRequest: refreshToken (NotBlank)
- RegisterRequest: email, password, name, role
- AuthResponse: accessToken, refreshToken, user (UserResponse)
- UserResponse: id, email, name, role, isActive

## Dependência Maven para jjwt:
```xml
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.5</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.5</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.12.5</version>
    <scope>runtime</scope>
</dependency>
```

## Regras:
- NUNCA retorne passwordHash em responses
- Tokens devem ser seguros e não previsíveis
- Trate todos os edge cases (user não encontrado, user inativo, token expirado)
- Gere TODOS os arquivos completos

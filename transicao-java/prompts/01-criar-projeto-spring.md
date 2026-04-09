# Prompt 01 — Criar Projeto Spring Boot

Cole este prompt inteiro no Claude:

---

Crie um projeto Spring Boot 3 completo para o backend do Biodiagnóstico 4.0, um sistema de controle de qualidade laboratorial.

## Requisitos do projeto:

- **Java 21**, **Maven**, **Spring Boot 3.3.x**
- Group: `com.biodiagnostico`, Artifact: `biodiagnostico-api`
- Dependencies: Spring Web, Spring Data JPA, Spring Security, PostgreSQL Driver, Validation, Lombok, Actuator, DevTools

## Arquivos que preciso:

### 1. pom.xml
Com todas as dependências listadas + jjwt (io.jsonwebtoken) para JWT.

### 2. application.yml
```yaml
spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST}:${DB_PORT:5432}/${DB_NAME}
    username: ${DB_USER}
    password: ${DB_PASSWORD}
  jpa:
    hibernate.ddl-auto: validate
    show-sql: false
    properties.hibernate.dialect: org.hibernate.dialect.PostgreSQLDialect
  jackson:
    default-property-inclusion: non_null
    serialization.write-dates-as-timestamps: false

server:
  port: ${PORT:8080}

jwt:
  secret: ${JWT_SECRET}
  access-token-expiry: 900000
  refresh-token-expiry: 604800000

gemini:
  api-key: ${GEMINI_API_KEY}
  model: gemini-1.5-flash

cors:
  allowed-origins: ${CORS_ORIGINS:http://localhost:5173}
```

### 3. CorsConfig.java
Configurar CORS com as origins do yml, permitir GET/POST/PUT/DELETE, permitir Authorization header.

### 4. GlobalExceptionHandler.java
`@RestControllerAdvice` que trata:
- `ResourceNotFoundException` → 404
- `BusinessException` → 400
- `MethodArgumentNotValidException` → 400 com detalhes dos campos
- `Exception` genérica → 500

### 5. ResourceNotFoundException.java e BusinessException.java
Exceções customizadas simples.

### 6. Dockerfile
Multi-stage: build com eclipse-temurin:21-jdk, run com eclipse-temurin:21-jre.

### 7. BiodiagnosticoApplication.java
Classe main padrão.

Gere TODOS os arquivos completos e funcionais, prontos para rodar. Não pule nenhum.

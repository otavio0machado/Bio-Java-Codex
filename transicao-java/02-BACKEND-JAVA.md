# 02 — Backend Java (Spring Boot 3)

## Pré-requisitos

- Java 21 (instalar via SDKMAN: `sdk install java 21-tem`)
- Maven (vem com o Spring Initializr)
- IntelliJ IDEA ou VS Code com Extension Pack for Java

## Passo 1 — Criar o Projeto

Usar o Spring Initializr: https://start.spring.io

```
Project: Maven
Language: Java
Spring Boot: 3.3.x (mais recente estável)
Group: com.biodiagnostico
Artifact: biodiagnostico-api
Name: biodiagnostico-api
Package: com.biodiagnostico
Java: 21

Dependencies:
  - Spring Web
  - Spring Data JPA
  - Spring Security
  - PostgreSQL Driver
  - Validation (Bean Validation)
  - Lombok
  - Spring Boot Actuator
  - Spring Boot DevTools
```

Baixar, descompactar e abrir no IDE.

## Passo 2 — application.yml

Substituir `application.properties` por `application.yml`:

```yaml
spring:
  application:
    name: biodiagnostico-api

  datasource:
    url: jdbc:postgresql://${DB_HOST}:${DB_PORT:5432}/${DB_NAME}
    username: ${DB_USER}
    password: ${DB_PASSWORD}
    driver-class-name: org.postgresql.Driver

  jpa:
    hibernate:
      ddl-auto: validate  # Não auto-criar tabelas, usamos o schema SQL
    show-sql: false
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
        format_sql: true

  jackson:
    default-property-inclusion: non_null
    serialization:
      write-dates-as-timestamps: false

server:
  port: ${PORT:8080}

# JWT Config
jwt:
  secret: ${JWT_SECRET}
  access-token-expiry: 900000      # 15 minutos em ms
  refresh-token-expiry: 604800000  # 7 dias em ms

# Gemini
gemini:
  api-key: ${GEMINI_API_KEY}
  model: gemini-1.5-flash

# CORS
cors:
  allowed-origins: ${CORS_ORIGINS:http://localhost:5173}
```

## Passo 3 — Estrutura de Pacotes

```
src/main/java/com/biodiagnostico/
├── config/
│   ├── CorsConfig.java
│   ├── SecurityConfig.java
│   └── JwtConfig.java
├── controller/
│   ├── AuthController.java
│   ├── QcRecordController.java
│   ├── QcReferenceController.java
│   ├── QcExamController.java
│   ├── ReagentController.java
│   ├── MaintenanceController.java
│   ├── HematologyController.java
│   ├── DashboardController.java
│   ├── ReportController.java
│   └── AiController.java
├── dto/
│   ├── request/
│   │   ├── LoginRequest.java
│   │   ├── QcRecordRequest.java
│   │   ├── ReagentLotRequest.java
│   │   └── ...
│   └── response/
│       ├── AuthResponse.java
│       ├── QcRecordResponse.java
│       ├── DashboardKpiResponse.java
│       └── ...
├── entity/
│   ├── User.java
│   ├── QcExam.java
│   ├── QcReferenceValue.java
│   ├── QcRecord.java
│   ├── WestgardViolation.java
│   ├── PostCalibrationRecord.java
│   ├── ReagentLot.java
│   ├── StockMovement.java
│   ├── MaintenanceRecord.java
│   ├── HematologyQcParameter.java
│   ├── HematologyQcMeasurement.java
│   ├── HematologyBioRecord.java
│   ├── ImunologiaRecord.java
│   └── AuditLog.java
├── repository/
│   ├── UserRepository.java
│   ├── QcRecordRepository.java
│   ├── QcReferenceValueRepository.java
│   ├── ReagentLotRepository.java
│   ├── MaintenanceRecordRepository.java
│   └── ...
├── service/
│   ├── AuthService.java
│   ├── JwtService.java
│   ├── QcService.java
│   ├── WestgardEngine.java
│   ├── ReagentService.java
│   ├── MaintenanceService.java
│   ├── HematologyQcService.java
│   ├── DashboardService.java
│   ├── ReportService.java
│   └── GeminiAiService.java
├── exception/
│   ├── GlobalExceptionHandler.java
│   ├── ResourceNotFoundException.java
│   └── BusinessException.java
├── security/
│   ├── JwtAuthFilter.java
│   └── JwtTokenProvider.java
├── util/
│   └── NumericUtils.java
└── BiodiagnosticoApplication.java
```

## Passo 4 — Ordem de Implementação

Use os prompts na pasta `prompts/` nesta ordem:

1. **`01-criar-projeto-spring.md`** → Projeto base com configs
2. **`02-entities-jpa.md`** → Todas as entities mapeando as tabelas
3. **`03-repositories.md`** → Interfaces de acesso ao banco
4. **`04-westgard-engine.md`** → Motor de regras (coração do sistema)
5. **`05-services-qc.md`** → Services de CQ
6. **`06-services-reagentes-manutencao.md`** → Services de reagentes e manutenção
7. **`07-controllers-rest.md`** → Endpoints REST
8. **`08-auth-jwt.md`** → Autenticação completa
9. **`09-testes-backend.md`** → Testes automatizados

## Endpoints da API

### Autenticação
| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login (retorna JWT) |
| POST | `/api/auth/refresh` | Renovar token |
| POST | `/api/auth/register` | Criar usuário (admin only) |

### Controle de Qualidade
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/qc/records` | Listar registros (filtros: exam, date, area) |
| POST | `/api/qc/records` | Criar registro + verificar Westgard |
| POST | `/api/qc/records/batch` | Criar registros em lote |
| GET | `/api/qc/records/{id}` | Buscar registro |
| PUT | `/api/qc/records/{id}` | Atualizar registro |
| DELETE | `/api/qc/records/{id}` | Excluir registro |
| GET | `/api/qc/levey-jennings` | Dados para gráfico (30 dias) |
| GET | `/api/qc/statistics/today` | Contagem de registros hoje |
| GET | `/api/qc/statistics/month` | Contagem do mês |
| GET | `/api/qc/statistics/approval-rate` | Taxa de aprovação |

### Exames
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/qc/exams` | Listar exames |
| POST | `/api/qc/exams` | Criar exame |
| PUT | `/api/qc/exams/{id}` | Atualizar |
| DELETE | `/api/qc/exams/{id}` | Excluir |

### Referências
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/qc/references` | Listar referências |
| POST | `/api/qc/references` | Criar referência |
| PUT | `/api/qc/references/{id}` | Atualizar |
| DELETE | `/api/qc/references/{id}` | Excluir |

### Reagentes
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/reagents` | Listar lotes |
| POST | `/api/reagents` | Criar lote |
| PUT | `/api/reagents/{id}` | Atualizar lote |
| DELETE | `/api/reagents/{id}` | Excluir lote |
| GET | `/api/reagents/{id}/movements` | Movimentações |
| POST | `/api/reagents/{id}/movements` | Criar movimentação |

### Manutenção
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/maintenance` | Listar registros |
| POST | `/api/maintenance` | Criar registro |
| PUT | `/api/maintenance/{id}` | Atualizar |
| DELETE | `/api/maintenance/{id}` | Excluir |

### Hematologia
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/hematology/parameters` | Parâmetros CQ |
| POST | `/api/hematology/parameters` | Criar parâmetro |
| GET | `/api/hematology/measurements` | Medições |
| POST | `/api/hematology/measurements` | Criar medição |
| GET | `/api/hematology/bio-records` | Registros Bio x CI |
| POST | `/api/hematology/bio-records` | Criar registro |

### Dashboard
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/dashboard/kpis` | KPIs consolidados |
| GET | `/api/dashboard/alerts` | Alertas ativos |
| GET | `/api/dashboard/recent-records` | Registros recentes |

### Relatórios e IA
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/reports/qc-pdf` | Gerar PDF de CQ |
| GET | `/api/reports/reagents-pdf` | Gerar PDF de reagentes |
| POST | `/api/ai/analyze` | Análise com Gemini |

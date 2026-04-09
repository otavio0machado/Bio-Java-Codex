# Prompt 02 — Entities JPA

Cole este prompt inteiro no Claude:

---

Crie TODAS as entities JPA para o Biodiagnóstico 4.0 (sistema de controle de qualidade laboratorial em Java/Spring Boot 3). Pacote: `com.biodiagnostico.entity`.

Use Lombok (`@Data`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor`) e JPA annotations.

## Tabelas do banco (PostgreSQL):

### 1. User (tabela `users`)
- id: UUID (PK, gerado)
- email: String (unique, not null)
- passwordHash: String (not null)
- name: String (not null)
- role: String (default "ANALYST") — valores: ADMIN, ANALYST, VIEWER
- isActive: boolean (default true)
- createdAt, updatedAt: Instant

### 2. QcExam (tabela `qc_exams`)
- id: UUID (PK)
- name: String (not null)
- area: String (default "bioquimica") — bioquimica, hematologia, imunologia, parasitologia, microbiologia, uroanalise
- unit: String (nullable)
- isActive: boolean
- createdAt, updatedAt: Instant

### 3. QcReferenceValue (tabela `qc_reference_values`)
- id: UUID (PK)
- exam: QcExam (ManyToOne, LAZY, FK exam_id)
- name, level, lotNumber, manufacturer: String
- targetValue, targetSd, cvMaxThreshold: Double
- validFrom, validUntil: LocalDate
- isActive: boolean
- notes: String (TEXT)
- createdAt, updatedAt: Instant

### 4. QcRecord (tabela `qc_records`)
- id: UUID (PK)
- reference: QcReferenceValue (ManyToOne, LAZY, FK reference_id, nullable)
- examName, area: String
- date: LocalDate
- level, lotNumber: String
- value, targetValue, targetSd, cv, cvLimit, zScore: Double
- equipment, analyst: String
- status: String (APROVADO/REPROVADO/ALERTA)
- needsCalibration: boolean
- violations: List<WestgardViolation> (OneToMany, mappedBy "qcRecord", CASCADE ALL)
- createdAt, updatedAt: Instant

### 5. WestgardViolation (tabela `westgard_violations`)
- id: UUID (PK)
- qcRecord: QcRecord (ManyToOne, LAZY, FK qc_record_id)
- rule: String (1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10x)
- description: String (TEXT)
- severity: String (WARNING/REJECTION)
- createdAt: Instant

### 6. PostCalibrationRecord (tabela `post_calibration_records`)
- id: UUID (PK)
- qcRecord: QcRecord (ManyToOne, LAZY, FK qc_record_id)
- date: LocalDate
- examName: String
- originalValue, originalCv, postCalibrationValue, postCalibrationCv, targetValue: Double
- analyst: String
- notes: String
- createdAt: Instant

### 7. ReagentLot (tabela `reagent_lots`)
- id: UUID (PK)
- name, lotNumber, manufacturer, category: String
- expiryDate, startDate, endDate: LocalDate
- quantityValue, currentStock, estimatedConsumption: Double
- stockUnit: String (default "unidades")
- storageTemp: String
- status: String (ativo/em_uso/inativo/vencido)
- alertThresholdDays: Integer (default 7)
- movements: List<StockMovement> (OneToMany, mappedBy "reagentLot", CASCADE ALL)
- createdAt, updatedAt: Instant

### 8. StockMovement (tabela `stock_movements`)
- id: UUID (PK)
- reagentLot: ReagentLot (ManyToOne, LAZY)
- type: String (ENTRADA/SAIDA/AJUSTE)
- quantity: Double
- responsible, notes: String
- createdAt: Instant

### 9. MaintenanceRecord (tabela `maintenance_records`)
- id: UUID (PK)
- equipment, type: String
- date, nextDate: LocalDate
- technician, notes: String
- createdAt: Instant

### 10. HematologyQcParameter (tabela `hematology_qc_parameters`)
- id: UUID (PK)
- analito, equipamento, loteControle, nivelControle: String
- modo: String (INTERVALO/PERCENTUAL)
- alvoValor, minValor, maxValor, toleranciaPercentual: Double
- isActive: boolean
- measurements: List<HematologyQcMeasurement> (OneToMany)
- createdAt, updatedAt: Instant

### 11. HematologyQcMeasurement (tabela `hematology_qc_measurements`)
- id: UUID (PK)
- parameter: HematologyQcParameter (ManyToOne, LAZY)
- dataMedicao: LocalDate
- analito: String
- valorMedido, minAplicado, maxAplicado: Double
- modoUsado, status, observacao: String
- createdAt: Instant

### 12. HematologyBioRecord (tabela `hematology_bio_records`)
- id: UUID (PK)
- dataBio, dataPad: LocalDate
- registroBio, registroPad: String
- modoCi: String (bio/intervalo/porcentagem)
- Todos os campos bio_*, pad_*, ci_min_*, ci_max_*, ci_pct_* como Double (default 0)
- createdAt: Instant

### 13. ImunologiaRecord (tabela `imunologia_records`)
- id: UUID (PK)
- controle, fabricante, lote: String
- data: LocalDate
- resultado: String
- createdAt: Instant

### 14. AuditLog (tabela `audit_log`)
- id: UUID (PK)
- user: User (ManyToOne, LAZY, nullable)
- action: String (CREATE/UPDATE/DELETE)
- entityType, ipAddress: String
- entityId: UUID
- details: String (mapeado para JSONB com @JdbcTypeCode)
- createdAt: Instant

## Regras:
- Use `@Column(name = "...")` quando o nome Java difere do SQL (camelCase → snake_case)
- Use `@GeneratedValue(strategy = GenerationType.UUID)` para IDs
- Use `@CreationTimestamp` e `@UpdateTimestamp` do Hibernate para timestamps
- Todas as entities devem ter `@Entity` e `@Table(name = "...")`
- Gere TODAS as 14 entities completas, sem pular nenhuma

# Prompt 03 — Spring Data JPA Repositories

Cole este prompt inteiro no Claude:

---

Crie todos os Spring Data JPA Repositories para o Biodiagnóstico 4.0. Pacote: `com.biodiagnostico.repository`.

Cada repository estende `JpaRepository<Entity, UUID>` e contém queries customizadas com `@Query` onde necessário.

## Repositories necessários:

### 1. UserRepository
- `findByEmail(String email)` → Optional<User>
- `existsByEmail(String email)` → boolean

### 2. QcExamRepository
- `findByAreaAndIsActiveTrue(String area)` → List<QcExam>
- `findByIsActiveTrue()` → List<QcExam>

### 3. QcReferenceValueRepository
- `findByExamIdAndIsActiveTrue(UUID examId)` → List<QcReferenceValue>
- `findByIsActiveTrue()` → List<QcReferenceValue>
- `findByExam_NameAndLevelAndIsActiveTrue(String examName, String level)` → Optional<QcReferenceValue>

### 4. QcRecordRepository
- `findByAreaOrderByDateDesc(String area)` → List<QcRecord>
- `findByExamNameAndAreaOrderByDateDesc(String examName, String area)` → List<QcRecord>
- `findByDateBetweenAndArea(LocalDate start, LocalDate end, String area)` → List<QcRecord>
- `countByDate(LocalDate date)` → long (para estatísticas hoje)
- `countByDateBetween(LocalDate start, LocalDate end)` → long (para estatísticas mês)
- `@Query` para taxa de aprovação do mês: contar APROVADO / total onde date entre início e fim do mês
- `@Query` para dados do Levey-Jennings: buscar por examName + level + area, últimos 30 registros, ordenado por date ASC
- `findByExamNameAndLevelAndAreaOrderByDateDesc(String examName, String level, String area, Pageable pageable)` → para histórico do Westgard (últimos 10)
- `findTop10ByOrderByCreatedAtDesc()` → para registros recentes no dashboard

### 5. WestgardViolationRepository
- `findByQcRecordId(UUID qcRecordId)` → List<WestgardViolation>

### 6. PostCalibrationRecordRepository
- `findByQcRecordId(UUID qcRecordId)` → Optional<PostCalibrationRecord>

### 7. ReagentLotRepository
- `findAllByOrderByCreatedAtDesc()` → List<ReagentLot>
- `findByCategory(String category)` → List<ReagentLot>
- `findByStatus(String status)` → List<ReagentLot>
- `@Query` para lotes vencendo nos próximos N dias: WHERE expiry_date BETWEEN now() AND now() + interval 'N days' AND status != 'vencido'
- `@Query` para agrupar por name (tag): count total, ativos, em_uso, inativos, vencidos

### 8. StockMovementRepository
- `findByReagentLotIdOrderByCreatedAtDesc(UUID lotId)` → List<StockMovement>

### 9. MaintenanceRecordRepository
- `findAllByOrderByDateDesc()` → List<MaintenanceRecord>
- `findByEquipment(String equipment)` → List<MaintenanceRecord>
- `@Query` para manutenções pendentes: WHERE next_date <= CURRENT_DATE AND next_date IS NOT NULL

### 10. HematologyQcParameterRepository
- `findByIsActiveTrue()` → List<HematologyQcParameter>
- `findByAnalitoAndIsActiveTrue(String analito)` → List<HematologyQcParameter>

### 11. HematologyQcMeasurementRepository
- `findByParameterIdOrderByDataMedicaoDesc(UUID parameterId)` → List
- `findByDataMedicaoBetween(LocalDate start, LocalDate end)` → List

### 12. HematologyBioRecordRepository
- `findAllByOrderByDataBioDesc()` → List

### 13. ImunologiaRecordRepository
- `findAllByOrderByDataDesc()` → List

### 14. AuditLogRepository
- `findByEntityTypeAndEntityId(String entityType, UUID entityId)` → List<AuditLog>
- `findByUserIdOrderByCreatedAtDesc(UUID userId)` → List<AuditLog>

## Regras:
- Use JPQL (não SQL nativo) quando possível
- Para queries complexas, use `@Query("SELECT ...")`
- Gere TODOS os 14 repositories completos

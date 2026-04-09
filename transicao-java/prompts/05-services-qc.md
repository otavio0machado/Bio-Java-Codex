# Prompt 05 — Services de Controle de Qualidade

> Status deste prompt: referência auxiliar de migração.
> Para o módulo de CQ, a autoridade operacional congelada está em `PLANS.md` (`Fase CQ-01`) e `AGENTS.md`.
> Este prompt não deve ser usado isoladamente para resolver política de referência, recorte histórico ou semântica de pós-calibração.

Cole este prompt inteiro no Claude:

---

Crie os services de Controle de Qualidade para o Biodiagnóstico 4.0. Pacote: `com.biodiagnostico.service`. Estes services contêm a lógica de negócio principal do sistema.

## Services necessários:

### 1. QcService.java

Dependências injetadas: QcRecordRepository, QcReferenceValueRepository, WestgardEngine, QcExamRepository

Métodos:

**createRecord(QcRecordRequest request) → QcRecordResponse**
1. Buscar referência ativa pelo examName + level (se existir)
2. Calcular CV: `cv = (|value - targetValue| / targetValue) * 100`
3. Calcular z-score: `zScore = (value - targetValue) / targetSd` (se targetSd > 0)
4. Determinar se precisa calibração: `needsCalibration = cv > cvLimit`
5. Determinar status: se WestgardEngine retorna violations com severity REJECTION → REPROVADO, se WARNING → ALERTA, senão → APROVADO
6. Buscar histórico dos últimos 10 registros do mesmo exame/nível/área para o Westgard
7. Salvar o QcRecord + WestgardViolations em cascata
8. Retornar QcRecordResponse com violations incluídas

**createRecordsBatch(List<QcRecordRequest>) → List<QcRecordResponse>**
Mesmo que createRecord mas em lote.

**getRecords(String area, String examName, LocalDate startDate, LocalDate endDate) → List<QcRecordResponse>**
Filtros opcionais. Ordenar por date DESC.

**getRecord(UUID id) → QcRecordResponse**
Buscar por ID ou lançar ResourceNotFoundException.

**updateRecord(UUID id, QcRecordRequest request) → QcRecordResponse**
Recalcular CV, z-score, Westgard. Salvar.

**deleteRecord(UUID id) → void**
Verificar existência, deletar.

**getStatisticsToday() → Map<String, Object>**
Retorna: totalToday, totalMonth, approvalRate

**getLeveyJenningsData(String examName, String level, String area) → List<LeveyJenningsResponse>**
Retorna últimos 30 registros com: date, value, target, sd, cv, status, zScore, upper2sd, lower2sd, upper3sd, lower3sd

### 2. QcExamService.java

Dependências: QcExamRepository

**getExams(String area) → List<QcExam>** (filtro opcional por área)
**createExam(QcExamRequest) → QcExam**
**updateExam(UUID id, QcExamRequest) → QcExam**
**deleteExam(UUID id) → void**

### 3. QcReferenceService.java

Dependências: QcReferenceValueRepository

**getReferences(UUID examId, Boolean activeOnly) → List<QcReferenceValue>**
**createReference(QcReferenceRequest) → QcReferenceValue**
**updateReference(UUID id, QcReferenceRequest) → QcReferenceValue**
**deleteReference(UUID id) → void**

### 4. PostCalibrationService.java

Dependências: PostCalibrationRecordRepository, QcRecordRepository

**createPostCalibration(UUID qcRecordId, PostCalibrationRequest) → PostCalibrationRecord**
1. Buscar QcRecord original
2. Salvar medição pós-calibração
3. Atualizar QcRecord.needsCalibration = false
4. Retornar

**getByQcRecord(UUID qcRecordId) → Optional<PostCalibrationRecord>**

## DTOs necessários:

### Request DTOs (pacote com.biodiagnostico.dto.request):
- QcRecordRequest: examName, area, date, level, lotNumber, value, targetValue, targetSd, cvLimit, equipment, analyst, referenceId (opcional)
- QcExamRequest: name, area, unit
- QcReferenceRequest: examId, name, level, lotNumber, manufacturer, targetValue, targetSd, cvMaxThreshold, validFrom, validUntil, notes
- PostCalibrationRequest: date, postCalibrationValue, analyst, notes

### Response DTOs (pacote com.biodiagnostico.dto.response):
- QcRecordResponse: todos os campos do QcRecord + violations como lista de ViolationResponse
- ViolationResponse: rule, description, severity
- LeveyJenningsResponse: date, value, target, sd, cv, status, zScore, upper2sd, lower2sd, upper3sd, lower3sd

## Regras:
- Use `@Service` e `@Transactional` onde necessário
- Use `@Valid` nos requests para Bean Validation
- Lance `ResourceNotFoundException` quando entidade não existir
- Lance `BusinessException` para erros de negócio
- Gere TODOS os services e DTOs completos

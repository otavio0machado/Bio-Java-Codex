# Prompt 07 — Controllers REST

Cole este prompt inteiro no Claude:

---

Crie TODOS os REST Controllers para o Biodiagnóstico 4.0. Pacote: `com.biodiagnostico.controller`.

Cada controller usa `@RestController` e `@RequestMapping`. Injeta o service correspondente.

## Controllers:

### 1. QcRecordController (@RequestMapping("/api/qc/records"))
```
GET  /                     → getRecords(@RequestParam area, examName, startDate, endDate — todos opcionais)
POST /                     → createRecord(@Valid @RequestBody QcRecordRequest)
POST /batch                → createRecordsBatch(@Valid @RequestBody List<QcRecordRequest>)
GET  /{id}                 → getRecord(@PathVariable UUID id)
PUT  /{id}                 → updateRecord(@PathVariable UUID id, @Valid @RequestBody QcRecordRequest)
DELETE /{id}               → deleteRecord(@PathVariable UUID id)
GET  /statistics            → getStatistics() → retorna totalToday, totalMonth, approvalRate
GET  /levey-jennings       → getLeveyJenningsData(@RequestParam examName, level, area)
```

### 2. QcExamController (@RequestMapping("/api/qc/exams"))
```
GET  /                     → getExams(@RequestParam(required=false) area)
POST /                     → createExam(@Valid @RequestBody QcExamRequest)
PUT  /{id}                 → updateExam(UUID id, QcExamRequest)
DELETE /{id}               → deleteExam(UUID id)
```

### 3. QcReferenceController (@RequestMapping("/api/qc/references"))
```
GET  /                     → getReferences(@RequestParam(required=false) examId, activeOnly)
POST /                     → createReference(@Valid @RequestBody QcReferenceRequest)
PUT  /{id}                 → updateReference(UUID id, QcReferenceRequest)
DELETE /{id}               → deleteReference(UUID id)
```

### 4. ReagentController (@RequestMapping("/api/reagents"))
```
GET  /                     → getLots(@RequestParam(required=false) category, status)
POST /                     → createLot(@Valid @RequestBody ReagentLotRequest)
PUT  /{id}                 → updateLot(UUID id, ReagentLotRequest)
DELETE /{id}               → deleteLot(UUID id)
GET  /{id}/movements       → getMovements(@PathVariable UUID id)
POST /{id}/movements       → createMovement(UUID id, @Valid StockMovementRequest)
DELETE /movements/{movId}  → deleteMovement(UUID movId)
GET  /expiring             → getExpiringLots(@RequestParam(defaultValue="30") int days)
GET  /tags                 → getTagSummaries()
```

### 5. MaintenanceController (@RequestMapping("/api/maintenance"))
```
GET  /                     → getRecords(@RequestParam(required=false) equipment)
POST /                     → createRecord(@Valid MaintenanceRequest)
PUT  /{id}                 → updateRecord(UUID id, MaintenanceRequest)
DELETE /{id}               → deleteRecord(UUID id)
GET  /pending              → getPendingMaintenances()
```

### 6. HematologyController (@RequestMapping("/api/hematology"))
```
GET  /parameters           → getParameters(@RequestParam(required=false) analito)
POST /parameters           → createParameter(@Valid HematologyParameterRequest)
PUT  /parameters/{id}      → updateParameter(UUID id, HematologyParameterRequest)
DELETE /parameters/{id}    → deleteParameter(UUID id)
GET  /measurements         → getMeasurements(@RequestParam(required=false) parameterId)
POST /measurements         → createMeasurement(@Valid HematologyMeasurementRequest)
GET  /bio-records          → getBioRecords()
POST /bio-records          → createBioRecord(@Valid HematologyBioRequest)
```

### 7. DashboardController (@RequestMapping("/api/dashboard"))
```
GET  /kpis                 → getKpis()
GET  /alerts               → getAlerts()
GET  /recent-records       → getRecentRecords(@RequestParam(defaultValue="10") int limit)
```

### 8. ReportController (@RequestMapping("/api/reports"))
```
GET  /qc-pdf               → generateQcPdf(@RequestParam area, month, year) → ResponseEntity<byte[]> com Content-Type application/pdf
GET  /reagents-pdf          → generateReagentsPdf() → ResponseEntity<byte[]>
```
(Nota: a geração real do PDF será implementada depois. Por ora retorne 501 Not Implemented.)

### 9. AiController (@RequestMapping("/api/ai"))
```
POST /analyze              → analyze(@RequestBody AiAnalysisRequest) → ResponseEntity<String>
```

## Regras:
- Use `@Valid` em todos os `@RequestBody`
- Retorne `ResponseEntity` com status codes corretos (200, 201, 204)
- POST retorna 201 (Created)
- DELETE retorna 204 (No Content)
- Use `@CrossOrigin` NÃO — o CORS está configurado globalmente no CorsConfig
- Gere TODOS os controllers completos, sem placeholders

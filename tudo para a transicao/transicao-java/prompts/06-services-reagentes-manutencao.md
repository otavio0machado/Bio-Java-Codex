# Prompt 06 — Services de Reagentes, Manutenção, Hematologia e Dashboard

Cole este prompt inteiro no Claude:

---

Crie os services complementares do Biodiagnóstico 4.0. Pacote: `com.biodiagnostico.service`.

## 1. ReagentService.java

Dependências: ReagentLotRepository, StockMovementRepository

**getLots(String category, String status) → List<ReagentLotResponse>**
Filtros opcionais. Para cada lote, calcular campos derivados:
- `daysLeft`: dias até expiryDate (se null → -1)
- `stockPct`: (currentStock / quantityValue) * 100
- `daysToRupture`: se estimatedConsumption > 0 → currentStock / estimatedConsumption

**createLot(ReagentLotRequest) → ReagentLot**
**updateLot(UUID id, ReagentLotRequest) → ReagentLot**
**deleteLot(UUID id) → void**

**getMovements(UUID lotId) → List<StockMovement>**
**createMovement(UUID lotId, StockMovementRequest) → StockMovement**
Ao criar movimento: atualizar currentStock do lote (ENTRADA soma, SAIDA subtrai, AJUSTE define)

**deleteMovement(UUID movementId) → void**
Reverter o efeito no currentStock do lote.

**getExpiringLots(int days) → List<ReagentLot>**
Lotes que vencem nos próximos N dias.

**getTagSummaries() → List<ReagentTagSummary>**
Agrupar por name (tag): contar total, ativos, em_uso, inativos, vencidos.

## 2. MaintenanceService.java

Dependências: MaintenanceRecordRepository

**getRecords(String equipment) → List<MaintenanceRecord>**
**createRecord(MaintenanceRequest) → MaintenanceRecord**
**updateRecord(UUID id, MaintenanceRequest) → MaintenanceRecord**
**deleteRecord(UUID id) → void**
**getPendingMaintenances() → List<MaintenanceRecord>**
Manutenções onde nextDate <= hoje.

## 3. HematologyQcService.java

Dependências: HematologyQcParameterRepository, HematologyQcMeasurementRepository, HematologyBioRecordRepository

**getParameters(String analito) → List<HematologyQcParameter>**
**createParameter(HematologyParameterRequest) → HematologyQcParameter**
**updateParameter(UUID id, HematologyParameterRequest) → HematologyQcParameter**
**deleteParameter(UUID id) → void**

**getMeasurements(UUID parameterId) → List<HematologyQcMeasurement>**
**createMeasurement(HematologyMeasurementRequest) → HematologyQcMeasurement**
1. Buscar parâmetro
2. Determinar min/max aplicados baseado no modo (INTERVALO usa min/max direto, PERCENTUAL calcula a partir de alvoValor ± tolerância%)
3. Determinar status: valor entre min e max → APROVADO, senão → REPROVADO
4. Salvar

**getBioRecords() → List<HematologyBioRecord>**
**createBioRecord(HematologyBioRequest) → HematologyBioRecord**

## 4. DashboardService.java

Dependências: QcRecordRepository, ReagentLotRepository, MaintenanceRecordRepository, WestgardViolationRepository

**getKpis() → DashboardKpiResponse**
Retorna:
- totalToday: contagem de QC records de hoje
- totalMonth: contagem do mês atual
- approvalRate: percentual de APROVADO no mês
- hasAlerts: true se qualquer alerta abaixo > 0
- alertsCount: soma de todos os alertas

**getAlerts() → DashboardAlertsResponse**
Retorna:
- expiringReagents: lotes que vencem em 30 dias (count + lista resumida)
- pendingMaintenances: manutenções vencidas (count + lista)
- westgardViolations: registros do mês com violations de REJECTION (count + lista)

**getRecentRecords(int limit) → List<QcRecordResponse>**
Últimos N registros ordenados por createdAt DESC.

## 5. GeminiAiService.java

Dependências: application.yml (gemini.api-key, gemini.model)

**analyze(String prompt, String context) → String**
1. Montar request para Google Gemini API
2. Enviar via HTTP (RestTemplate ou WebClient)
3. Retornar texto da resposta
4. Tratar timeout (30s) e erros de API

**analyzeQcData(List<QcRecord> records) → String**
1. Formatar registros como contexto para o Gemini
2. Prompt: "Analise estes dados de controle de qualidade laboratorial e identifique tendências, problemas e recomendações: {context}"
3. Chamar analyze()

## DTOs necessários:

### Requests:
- ReagentLotRequest: name, lotNumber, manufacturer, category, expiryDate, quantityValue, stockUnit, currentStock, estimatedConsumption, storageTemp, startDate, alertThresholdDays
- StockMovementRequest: type (ENTRADA/SAIDA/AJUSTE), quantity, responsible, notes
- MaintenanceRequest: equipment, type, date, nextDate, technician, notes
- HematologyParameterRequest: analito, equipamento, loteControle, nivelControle, modo, alvoValor, minValor, maxValor, toleranciaPercentual
- HematologyMeasurementRequest: parameterId, dataMedicao, analito, valorMedido, observacao
- HematologyBioRequest: (todos os campos da entity menos id e createdAt)
- AiAnalysisRequest: prompt, context (opcional)

### Responses:
- ReagentLotResponse: todos campos + daysLeft, stockPct, daysToRupture
- ReagentTagSummary: name, total, ativos, emUso, inativos, vencidos
- DashboardKpiResponse: totalToday, totalMonth, approvalRate, hasAlerts, alertsCount
- DashboardAlertsResponse: expiringReagents, pendingMaintenances, westgardViolations (cada um com count + items)

## Regras:
- `@Service` + `@Transactional` onde modifica dados
- Gere TODOS os services e DTOs completos

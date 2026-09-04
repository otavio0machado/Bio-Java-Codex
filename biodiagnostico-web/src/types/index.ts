export type Role = 'ADMIN' | 'FUNCIONARIO' | 'VIGILANCIA_SANITARIA' | 'VISUALIZADOR'

export type Permission =
  | 'DASHBOARD_VIEW'
  | 'QC_VIEW'
  | 'QC_WRITE'
  | 'QC_AREAS_WRITE'
  | 'QC_IMPORT'
  | 'QC_EXPORT'
  | 'REAGENTS_VIEW'
  | 'REAGENTS_WRITE'
  | 'REAGENTS_DELETE'
  | 'MAINTENANCE_VIEW'
  | 'MAINTENANCE_WRITE'
  | 'TEMPERATURE_VIEW'
  | 'TEMPERATURE_WRITE'
  | 'REPORTS_VIEW'
  | 'REPORTS_GENERATE'
  | 'REPORTS_DOWNLOAD'

export interface PermissionMetadata {
  name: string
  label: string
  description: string
  module: string
  action: string
  impliedPermissions: string[]
}

export interface ModuleGroup {
  moduleId: string
  moduleName: string
  description: string
  permissions: PermissionMetadata[]
}

export interface PermissionCatalogResponse {
  modules: ModuleGroup[]
  allPermissions: PermissionMetadata[]
}

export type QcStatus = 'APROVADO' | 'REPROVADO' | 'ALERTA'
export type ViolationSeverity = 'WARNING' | 'REJECTION'
export type LabArea =
  | 'bioquimica'
  | 'coagulacao'
  | 'hematologia'
  | 'imunologia'
  | 'parasitologia'
  | 'microbiologia'
  | 'uroanalise'

export interface User {
  id: string
  username: string
  email?: string | null
  name: string
  role: Role
  isActive: boolean
  permissions: string[]
  createdAt?: string | null
  lastLoginAt?: string | null
  mustChangePassword?: boolean
}

export interface AuthResponse {
  accessToken: string
  refreshToken?: string | null
  user: User
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface PasswordResetResponse {
  message: string
  resetUrl?: string | null
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  newPassword: string
}

export interface RegisterRequest {
  username: string
  password: string
  name: string
  role: Role
  email?: string
}

export interface AdminUserRequest {
  username: string
  password: string
  name: string
  role: string
  email?: string
  permissions?: string[]
  mustChangePassword?: boolean
}

export interface AdminUpdateUserRequest {
  username?: string
  name?: string
  role?: string
  isActive?: boolean
  email?: string
  permissions?: string[]
  mustChangePassword?: boolean
}

export interface AdminResetPasswordRequest {
  newPassword: string
  mustChangePassword?: boolean
}

export interface AdminDeleteUserResponse {
  status: 'DELETED' | 'DEACTIVATED'
  message: string
}

export interface WestgardViolation {
  rule: string
  description: string
  severity: ViolationSeverity
}

export interface QcRecord {
  id: string
  referenceId: string | null
  examName: string
  area: LabArea | string
  date: string
  level: string
  lotNumber: string | null
  value: number
  targetValue: number
  targetSd: number
  cv: number
  cvLimit: number
  zScore: number
  equipment: string | null
  analyst: string | null
  status: QcStatus
  needsCalibration: boolean
  violations: WestgardViolation[]
  createdAt: string
  updatedAt: string
  referenceWarning?: string | null
  postCalibrationValue?: number | null
  postCalibrationCv?: number | null
  postCalibrationStatus?: 'APROVADO' | 'REPROVADO' | null
}

export interface QcRecordPage {
  items: QcRecord[]
  nextCursor: string | null
  hasNext: boolean
  size: number
}

export interface QcRecordPageFilters {
  area?: string
  examName?: string
  startDate?: string
  endDate?: string
  status?: QcStatus
  level?: string
  cursor?: string
  size?: number
}

export interface QcRecordRequest {
  examName: string
  area: string
  date: string
  level: string
  lotNumber?: string
  value: number
  targetValue: number
  targetSd: number
  cvLimit: number
  equipment?: string
  analyst?: string
  referenceId?: string
}

export interface QcReferenceValue {
  id: string
  exam: QcExam
  name: string
  level: string
  lotNumber?: string
  manufacturer?: string
  targetValue: number
  targetSd: number
  cvMaxThreshold: number
  validFrom?: string
  validUntil?: string
  isActive: boolean
  notes?: string
}

export interface QcReferenceRequest {
  examId: string
  name: string
  level: string
  lotNumber?: string
  manufacturer?: string
  targetValue: number
  targetSd: number
  cvMaxThreshold: number
  validFrom?: string
  validUntil?: string
  notes?: string
}

export interface QcExam {
  id: string
  name: string
  area: string
  unit?: string
  isActive?: boolean
}

export interface QcExamRequest {
  name: string
  area: string
  unit?: string
}

export interface LeveyJenningsPoint {
  date: string
  value: number
  target: number
  sd: number
  cv: number
  status: QcStatus
  zScore: number
  upper2sd: number
  lower2sd: number
  upper3sd: number
  lower3sd: number
}

export interface PostCalibrationRequest {
  date: string
  postCalibrationValue: number
  analyst?: string
  notes?: string
}

export interface PostCalibrationRecord {
  id: string
  date: string
  examName: string
  originalValue: number
  originalCv: number
  postCalibrationValue: number
  postCalibrationCv: number
  targetValue: number
  analyst?: string
  notes?: string
}

/**
 * Conjunto canonico do status de lote pos refator v3.
 *
 * Mudancas v3:
 * - DROP {@code fora_de_estoque}.
 * - ADD {@code inativo} (terminal manual via endpoint {@code /archive}).
 *
 * Regra de derivacao no backend:
 * - {@code inativo} preserva (estado manual).
 * - {@code expiry < hoje} forca {@code vencido}.
 * - {@code unitsInUse > 0} → {@code em_uso}.
 * - {@code unitsInStock > 0} → {@code em_estoque}.
 */
export type ReagentStatus = 'em_estoque' | 'em_uso' | 'vencido' | 'inativo'

export interface ReagentLot {
  id: string
  /** Substitui o antigo {@code name} no contrato HTTP (backend mantem coluna {@code name}). */
  label: string
  lotNumber: string
  manufacturer: string
  category?: string
  expiryDate: string
  /** Unidades fechadas, prontas para abrir. Substitui {@code currentStock} (drop em V14). */
  unitsInStock: number
  /** Unidades abertas, sendo consumidas. */
  unitsInUse: number
  /** Soma derivada {@code unitsInStock + unitsInUse}. */
  totalUnits: number
  storageTemp?: string
  status: ReagentStatus | string
  createdAt: string
  updatedAt: string
  daysLeft: number
  nearExpiry: boolean
  // Rastreabilidade
  location?: string | null
  supplier?: string | null
  receivedDate?: string | null
  openedDate?: string | null
  // Arquivamento manual (v3)
  archivedAt?: string | null
  archivedBy?: string | null
  /** Lote vindo da migracao V14 com estoque potencialmente nao classificado. */
  needsStockReview?: boolean
  usedInQcRecently?: boolean
  traceabilityComplete?: boolean
  traceabilityIssues?: string[]
  canReceiveEntry?: boolean
  allowedMovementTypes?: StockMovementRequest['type'][]
  movementWarning?: string | null
}

export interface ReagentLotRequest {
  // 10 obrigatorios canonicos
  label: string
  lotNumber: string
  manufacturer: string
  category: string
  unitsInStock: number
  unitsInUse: number
  status: Exclude<ReagentStatus, 'inativo'> | string
  expiryDate: string
  location: string
  storageTemp: string
  // 3 opcionais (Detalhes adicionais)
  supplier?: string
  receivedDate?: string
  openedDate?: string
}

/**
 * Payload do endpoint {@code POST /api/reagents/{id}/archive}.
 * {@code archivedBy} e o {@code username} do responsavel (decisao audit 1.1).
 */
export interface ArchiveReagentLotRequest {
  archivedAt: string
  archivedBy: string
}

export interface UnarchiveReagentLotRequest {
  reason?: string
}

export interface DeleteReagentLotRequest {
  confirmLotNumber: string
}

/**
 * Shape minimo de usuario para combobox de responsavel.
 * Endpoint: {@code GET /api/users/responsibles}.
 */
export interface ResponsibleSummary {
  id: string
  name: string
  username: string
  role: string
}

export type MovementReason =
  | 'CONTAGEM_FISICA'
  | 'QUEBRA'
  | 'CONTAMINACAO'
  | 'CORRECAO'
  | 'REVERSAO_ABERTURA'
  | 'VENCIMENTO'
  | 'OUTRO'

export interface ReportRun {
  id: string
  type: 'QC_PDF' | 'REAGENTS_PDF' | string
  area?: string | null
  periodType?: string | null
  month?: number | null
  year?: number | null
  reportNumber?: string | null
  sha256?: string | null
  sizeBytes?: number | null
  durationMs?: number | null
  status: 'SUCCESS' | 'FAILURE' | string
  errorMessage?: string | null
  username?: string | null
  createdAt: string
}

/**
 * Tipos de movimento aceitos em escrita pos refator v3.
 *
 * - {@code ENTRADA}: aumenta {@code unitsInStock} (compra/recebimento).
 * - {@code ABERTURA}: -1 unitsInStock, +1 unitsInUse. Quantity sempre 1.
 * - {@code FECHAMENTO}: reverte abertura por engano. -1 unitsInUse, +1 unitsInStock.
 * - {@code CONSUMO}: diminui {@code unitsInUse} (uso real).
 * - {@code AJUSTE}: seta {@code targetUnitsInStock} e {@code targetUnitsInUse}.
 *
 * {@code SAIDA} legado existe apenas em leitura (movimentos pre-V14 conservam o tipo).
 */
export type MovementType = 'ENTRADA' | 'ABERTURA' | 'FECHAMENTO' | 'CONSUMO' | 'AJUSTE'

export interface StockMovement {
  id: string
  /** Aceita {@link MovementType} mais {@code 'SAIDA'} para movimentos legados. */
  type: MovementType | 'SAIDA' | string
  quantity: number
  responsible?: string
  notes?: string
  /** Estoque total antes do movimento (movimentos pre-V14). NULL apos V14. */
  previousStock?: number | null
  /** Unidades fechadas antes do movimento (apenas movimentos pos-V14). NULL antes. */
  previousUnitsInStock?: number | null
  /** Unidades abertas antes do movimento (apenas movimentos pos-V14). NULL antes. */
  previousUnitsInUse?: number | null
  /** True quando {@code previousStock != null AND previousUnitsInStock == null}. */
  isLegacy?: boolean
  reason?: MovementReason | string | null
  /**
   * Data declarada pelo operador para o evento (LocalDate ISO "YYYY-MM-DD").
   * Refator v3.1: ABERTURA usa para gravar {@code lot.openedDate};
   * CONSUMO persiste como data de fim de uso. NULL quando nao informado.
   */
  eventDate?: string | null
  createdAt: string
}

export interface StockMovementRequest {
  type: MovementType
  quantity: number
  responsible: string
  notes?: string
  reason?: MovementReason | null
  /** Obrigatorio para AJUSTE; ignorado para outros tipos. */
  targetUnitsInStock?: number
  targetUnitsInUse?: number
  /**
   * Refator v3.1: data declarada do evento (LocalDate ISO "YYYY-MM-DD").
   * - ABERTURA: usado para preencher {@code lot.openedDate} (default = hoje).
   * - CONSUMO: persiste como data de fim de uso (default = hoje).
   * Backend valida {@code eventDate <= today}.
   */
  eventDate?: string
}

/**
 * Resumo agregado de lotes por etiqueta. Endpoint: {@code GET /api/reagents/labels}.
 *
 * Refator v3: campo {@code foraDeEstoque} renomeado para {@code inativos} (espelha
 * drop de status {@code fora_de_estoque} e add de {@code inativo}).
 */
export interface ReagentLabelSummary {
  label: string
  total: number
  emEstoque: number
  emUso: number
  inativos: number
  vencidos: number
}

export interface MaintenanceRecord {
  id: string
  equipment: string
  type: string
  date: string
  nextDate?: string
  technician?: string
  notes?: string
  createdAt: string
}

export interface MaintenanceRequest {
  equipment: string
  type: string
  date: string
  nextDate?: string
  technician?: string
  notes?: string
}

export interface HematologyQcParameter {
  id: string
  analito: string
  equipamento?: string
  loteControle?: string
  nivelControle?: string
  modo: 'INTERVALO' | 'PERCENTUAL' | string
  alvoValor: number
  minValor: number
  maxValor: number
  toleranciaPercentual: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface HematologyParameterRequest {
  analito: string
  equipamento?: string
  loteControle?: string
  nivelControle?: string
  modo: 'INTERVALO' | 'PERCENTUAL'
  alvoValor?: number
  minValor?: number
  maxValor?: number
  toleranciaPercentual?: number
}

export interface HematologyQcMeasurement {
  id: string
  parameterId: string
  parameterEquipamento?: string
  parameterLoteControle?: string
  parameterNivelControle?: string
  dataMedicao: string
  analito: string
  valorMedido: number
  modoUsado?: string
  minAplicado: number
  maxAplicado: number
  status: 'APROVADO' | 'REPROVADO'
  observacao?: string
  createdAt?: string
}

export interface HematologyMeasurementRequest {
  parameterId: string
  dataMedicao: string
  analito: string
  valorMedido: number
  observacao?: string
}

export interface HematologyBioRecord {
  id: string
  dataBio: string
  dataPad?: string
  registroBio?: string
  registroPad?: string
  modoCi?: string
  bioHemacias: number
  bioHematocrito: number
  bioHemoglobina: number
  bioLeucocitos: number
  bioPlaquetas: number
  bioRdw: number
  bioVpm: number
  padHemacias: number
  padHematocrito: number
  padHemoglobina: number
  padLeucocitos: number
  padPlaquetas: number
  padRdw: number
  padVpm: number
  ciMinHemacias: number
  ciMaxHemacias: number
  ciMinHematocrito: number
  ciMaxHematocrito: number
  ciMinHemoglobina: number
  ciMaxHemoglobina: number
  ciMinLeucocitos: number
  ciMaxLeucocitos: number
  ciMinPlaquetas: number
  ciMaxPlaquetas: number
  ciMinRdw: number
  ciMaxRdw: number
  ciMinVpm: number
  ciMaxVpm: number
  ciPctHemacias: number
  ciPctHematocrito: number
  ciPctHemoglobina: number
  ciPctLeucocitos: number
  ciPctPlaquetas: number
  ciPctRdw: number
  ciPctVpm: number
}

export type HematologyBioRequest = Omit<HematologyBioRecord, 'id'>

export interface DashboardKpi {
  totalToday: number
  totalMonth: number
  approvalRate: number
  hasAlerts: boolean
  alertsCount: number
}

export interface AlertSection<T> {
  count: number
  items: T[]
}

export interface DashboardAlerts {
  expiringReagents: AlertSection<ReagentLot>
  pendingMaintenances: AlertSection<MaintenanceRecord>
  westgardViolations: AlertSection<QcRecord>
}

export interface AiAnalysisRequest {
  prompt: string
  context?: string
  area?: string
  examName?: string
  days?: number
}

/**
 * Recursos de IA assistiva (Onda 1). Todos os endpoints sao apoio a decisao,
 * nao substituem avaliacao tecnica e nao alteram regra de CQ/Westgard.
 */

/** A1 — POST /ai/qc/explain. {@code recordId} e o UUID do registro de CQ. */
export interface ExplainQcRequest {
  recordId: string
}

export interface ExplainQcResponse {
  explanation: string
}

/** A2 — POST /ai/qc/interpret-trend. Mesmos parametros do Levey-Jennings exibido. */
export interface InterpretTrendRequest {
  examName: string
  level: string
  area: string
  days?: number
}

export interface InterpretTrendResponse {
  interpretation: string
}

/**
 * B5 — POST /ai/validate-batch. Validacao assistiva (read-only) de um lote de
 * importacao de CQ ANTES de submeter. Devolve apenas SUGESTOES para revisao
 * humana; nao importa, nao grava e nao decide aprovar/reprovar.
 */

/** Categoria do problema apontado pela validacao do lote. */
export type BatchValidationIssue =
  | 'TYPO'
  | 'UNKNOWN_EXAM'
  | 'OUT_OF_RANGE'
  | 'MISSING'
  | 'SUSPECT_VALUE'

/**
 * Uma linha do lote a validar. Todos os campos sao anulaveis: a propria
 * validacao sinaliza ausencias/implausibilidades. Espelha os campos de uma
 * linha de importacao de CQ (mesmos nomes que o backend espera).
 */
export interface ValidateBatchRow {
  examName: string | null
  level: string | null
  value: number | null
  targetValue: number | null
  targetSd: number | null
  cvLimit: number | null
}

export interface ValidateBatchRequest {
  /** Area de CQ das linhas (ex.: "bioquimica"); resolve a lista de exames ativos. */
  area: string
  rows: ValidateBatchRow[]
}

/** Uma sugestao de correcao para uma linha do lote (apoio a decisao). */
export interface BatchSuggestion {
  /** Indice 0-based da linha na lista enviada. */
  row: number
  /** Campo afetado (ex.: "examName", "value", "targetSd", "cvLimit"). */
  field: string
  issue: BatchValidationIssue | string
  /** Texto PT-BR para revisao humana; para TYPO de exame, vem da lista cadastrada. */
  suggestion: string
  /** Confianca da sugestao, em [0,1]. */
  confidence: number
}

export interface ValidateBatchResponse {
  suggestions: BatchSuggestion[]
  /** Fracao de linhas SEM problema, em [0,1]. Indicador de prontidao, nao aprovacao. */
  readinessScore: number
}

export type SuggestObservationKind = 'post-calibration' | 'maintenance' | 'reagent' | 'qc'

/** C8 — POST /ai/suggest-observation. {@code kind} restrito ao conjunto aceito pelo backend. */
export interface SuggestObservationRequest {
  kind: SuggestObservationKind | string
  context: string
}

export interface SuggestObservationResponse {
  suggestion: string
}

/**
 * Recursos de IA assistiva (Onda 3). Todos os endpoints sao apoio a decisao
 * (read-only), nao substituem avaliacao tecnica e nao alteram regra de
 * CQ/Westgard, media, DP, CV, calibracao ou pos-calibracao no frontend.
 *
 * Observacao geral: estes endpoints podem devolver um texto de fallback
 * amigavel (HTTP 200) quando a IA falha; nesse caso a resposta e tratada como
 * texto normal.
 */

/** C9 — GET /ai/dashboard/summary. {@code summary} e a narrativa executiva PT-BR. */
export interface DashboardSummaryRequest {
  /** Area de CQ opcional (ex.: "bioquimica"); ausente = visao geral. */
  area?: string
  /** Janela em dias (default backend = 7). */
  days?: number
}

export interface DashboardSummaryResponse {
  summary: string
}

/**
 * C10 — GET /ai/audit/summary. Restrito a ADMIN (403 para nao-admin).
 * {@code summary} resume os audit logs do periodo por categoria + anomalias.
 */
export interface AuditSummaryRequest {
  /** Janela em dias (default backend = 7). */
  days?: number
  /** UUID de usuario para filtrar; ausente = todos. */
  userId?: string
}

export interface AuditSummaryResponse {
  summary: string
}

/** A3 — POST /ai/qc/root-cause. {@code recordId} e o UUID do registro de CQ. */
export interface RootCauseRequest {
  recordId: string
}

export interface RootCauseResponse {
  analysis: string
}

/** D12 — categoria de um item priorizado (determinada pelo backend). */
export type PriorityCategory = 'REAGENTE' | 'MANUTENCAO' | 'CQ'

/** D12 — urgencia heuristica de um item priorizado (determinada pelo backend). */
export type PriorityUrgency = 'ALTA' | 'MEDIA' | 'BAIXA'

/**
 * D12 — um item candidato a prioridade. A lista e DETERMINISTICA (heuristica de
 * urgencia no backend, sem IA). O frontend apenas exibe; nao reordena nem
 * recalcula urgencia.
 */
export interface PriorityItem {
  category: PriorityCategory | string
  title: string
  urgency: PriorityUrgency | string
  detail: string
}

export interface PrioritiesResponse {
  items: PriorityItem[]
  /** Narrativa priorizada da IA; pode vir vazia (degradacao graciosa). */
  recommendation: string
}

/**
 * D11 — GET /ai/drift. Deteccao PREVENTIVA de drift, SOB DEMANDA (read-only).
 *
 * A DETECCAO dos candidatos e DETERMINISTICA (estatistica pura no backend:
 * sequencias e inclinacao de regressao linear, sem IA) sobre series que AINDA
 * NAO violaram a regra de rejeicao Westgard. A IA apenas INTERPRETA os
 * candidatos ja encontrados (campo {@code detail}). O frontend so EXIBE: nao
 * reclassifica padrao/severidade, nao recalcula media/DP/CV nem reimplementa
 * Westgard. A fonte de verdade de status e violacoes continua no backend.
 *
 * {@code alerts} vazio = nenhum candidato a drift (estado positivo).
 */

/** Padrao de drift classificado pelo backend (estatistica deterministica). */
export type DriftPattern = 'DRIFT_UP' | 'DRIFT_DOWN' | 'SHIFT' | 'RUN'

/** Severidade heuristica do alerta de drift (determinada pelo backend). */
export type DriftSeverity = 'ALTA' | 'MEDIA' | 'BAIXA'

/**
 * Um alerta preventivo de drift para uma serie exame+nivel. Espelha
 * {@code DriftResponse.DriftAlert} do backend.
 */
export interface DriftAlert {
  examName: string
  /** Nivel do controle (ex.: "N1", "N2"). */
  level: string
  pattern: DriftPattern | string
  severity: DriftSeverity | string
  /**
   * Interpretacao textual da IA (recomendacao para revisao humana). Pode vir
   * vazia em degradacao graciosa quando a IA falha — tratar como texto normal.
   */
  detail: string
}

export interface DriftResponse {
  alerts: DriftAlert[]
}

export interface VoiceToFormRequest {
  audioBase64: string
  formType: 'registro' | 'referencia' | 'reagente' | 'manutencao'
  mimeType?: string
}

export type VoiceFormData = Record<string, string | number | null>

export interface AreaQcParameter {
  id: string
  area: LabArea | string
  analito: string
  equipamento?: string | null
  loteControle?: string | null
  nivelControle?: string | null
  modo: 'INTERVALO' | 'PERCENTUAL' | string
  alvoValor: number
  minValor?: number | null
  maxValor?: number | null
  toleranciaPercentual?: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AreaQcParameterRequest {
  analito: string
  equipamento?: string
  loteControle?: string
  nivelControle?: string
  modo: 'INTERVALO' | 'PERCENTUAL'
  alvoValor: number
  minValor?: number
  maxValor?: number
  toleranciaPercentual?: number
}

export interface AreaQcMeasurement {
  id: string
  parameterId?: string | null
  parameterEquipamento?: string | null
  parameterLoteControle?: string | null
  parameterNivelControle?: string | null
  area: LabArea | string
  dataMedicao: string
  analito: string
  valorMedido: number
  modoUsado: 'INTERVALO' | 'PERCENTUAL' | string
  minAplicado: number
  maxAplicado: number
  status: 'APROVADO' | 'REPROVADO'
  observacao?: string | null
  createdAt: string
}

export interface AreaQcMeasurementRequest {
  dataMedicao: string
  analito: string
  valorMedido: number
  parameterId?: string
  equipamento?: string
  loteControle?: string
  nivelControle?: string
  observacao?: string
}

export type ImmunologyResult = 'REAGENTE' | 'NAO_REAGENTE'

export interface ImmunologyControlItem {
  id: string
  name: string
  expectedResult: ImmunologyResult | string
  displayOrder: number
}

export interface ImmunologyControlSet {
  id: string
  analito: string
  manufacturer: string
  lotNumber: string
  validUntil: string
  isActive: boolean
  expired: boolean
  createdAt: string
  updatedAt: string
  controls: ImmunologyControlItem[]
}

export interface ImmunologyControlItemRequest {
  name: string
  expectedResult: ImmunologyResult | string
}

export interface ImmunologyControlSetRequest {
  analito: string
  manufacturer: string
  lotNumber: string
  validUntil: string
  controls: ImmunologyControlItemRequest[]
}

export interface ImmunologyRunResultRequest {
  controlItemId: string
  observedResult: ImmunologyResult | string
}

export interface ImmunologyRunRequest {
  dataMedicao: string
  reagentLotId: string
  controlSetId: string
  results: ImmunologyRunResultRequest[]
  analyst?: string
  notes?: string
}

export interface ImmunologyRunResult {
  id: string
  controlItemId?: string | null
  controlName: string
  expectedResult: ImmunologyResult | string
  observedResult: ImmunologyResult | string
  status: 'APROVADO' | 'REPROVADO'
  displayOrder: number
}

export interface ImmunologyRun {
  id: string
  controlSetId: string
  reagentLotId?: string | null
  reagentLabel?: string | null
  reagentManufacturer?: string | null
  reagentLotNumber?: string | null
  reagentValidUntil?: string | null
  reagentStatus?: string | null
  reagentUnitsInStock?: number | null
  reagentUnitsInUse?: number | null
  reagentStorageTemp?: string | null
  reagentLocation?: string | null
  dataMedicao: string
  analito: string
  manufacturer: string
  lotNumber: string
  validUntil: string
  status: 'APROVADO' | 'REPROVADO'
  analyst?: string | null
  notes?: string | null
  createdAt: string
  results: ImmunologyRunResult[]
}

export interface UroStripControlSet {
  id: string
  controlLotNumber: string
  manufacturer: string
  validUntil: string
  expectedPhMin?: number | null
  expectedPhMax?: number | null
  expectedDensityMin?: number | null
  expectedDensityMax?: number | null
  expectedProteins: string
  expectedGlucose: string
  expectedKetones: string
  expectedBlood: string
  expectedUrobilinogen: string
  expectedNitrite: string
  expectedBilirubin: string
  expectedLeukocytes: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UroStripControlSetRequest {
  controlLotNumber: string
  manufacturer: string
  validUntil: string
  expectedPhMin?: number | null
  expectedPhMax?: number | null
  expectedDensityMin?: number | null
  expectedDensityMax?: number | null
  expectedProteins?: string
  expectedGlucose?: string
  expectedKetones?: string
  expectedBlood?: string
  expectedUrobilinogen?: string
  expectedNitrite?: string
  expectedBilirubin?: string
  expectedLeukocytes?: string
}

export interface UroStripRun {
  id: string
  controlSetId: string
  dataMedicao: string
  controlLotSnapshot: string
  controlValidUntilSnapshot: string
  reagentLotId?: string | null
  reagentLabelSnapshot?: string | null
  reagentManufacturerSnapshot?: string | null
  reagentLotNumberSnapshot?: string | null
  reagentValidUntilSnapshot?: string | null
  measuredPh?: number | null
  statusPh: 'APROVADO' | 'REPROVADO'
  measuredDensity?: number | null
  statusDensity: 'APROVADO' | 'REPROVADO'
  measuredProteins: string
  statusProteins: 'APROVADO' | 'REPROVADO'
  measuredGlucose: string
  statusGlucose: 'APROVADO' | 'REPROVADO'
  measuredKetones: string
  statusKetones: 'APROVADO' | 'REPROVADO'
  measuredBlood: string
  statusBlood: 'APROVADO' | 'REPROVADO'
  measuredUrobilinogen: string
  statusUrobilinogen: 'APROVADO' | 'REPROVADO'
  measuredNitrite: string
  statusNitrite: 'APROVADO' | 'REPROVADO'
  statusGeral: 'APROVADO' | 'REPROVADO'
  correctiveAction?: string | null
  analyst?: string | null
  notes?: string | null
  createdAt: string
}

export interface UroStripRunRequest {
  controlSetId: string
  dataMedicao: string
  reagentLotId?: string | null
  measuredPh?: number | null
  measuredDensity?: number | null
  measuredProteins?: string
  measuredGlucose?: string
  measuredKetones?: string
  measuredBlood?: string
  measuredUrobilinogen?: string
  measuredNitrite?: string
  correctiveAction?: string | null
  analyst?: string | null
  notes?: string | null
}

export interface UroSedimentRun {
  id: string
  dataMedicao: string
  patientCode: string
  analyst1Id?: string | null
  analyst1Name: string
  analyst2Id?: string | null
  analyst2Name: string
  leukocytesA1: number
  leukocytesA2: number
  leukocytesCv: number
  statusLeukocytes: 'APROVADO' | 'REPROVADO'
  erythrocytesA1: number
  erythrocytesA2: number
  erythrocytesCv: number
  statusErythrocytes: 'APROVADO' | 'REPROVADO'
  bacteriaA1: string
  bacteriaA2: string
  statusBacteria: 'APROVADO' | 'REPROVADO'
  epithelialCellsA1: string
  epithelialCellsA2: string
  statusEpithelialCells: 'APROVADO' | 'REPROVADO'
  mucusThreadsA1: string
  mucusThreadsA2: string
  statusMucusThreads: 'APROVADO' | 'REPROVADO'
  crystalsA1: string
  crystalsA2: string
  statusCrystals: 'APROVADO' | 'REPROVADO'
  othersA1: string
  othersA2: string
  statusOthers: 'APROVADO' | 'REPROVADO'
  statusGeral: 'APROVADO' | 'REPROVADO'
  correctiveAction?: string | null
  notes?: string | null
  createdAt: string
}

export interface UroSedimentRunRequest {
  dataMedicao: string
  patientCode: string
  analyst1Id?: string | null
  analyst1Name?: string | null
  analyst2Id?: string | null
  analyst2Name?: string | null
  leukocytesA1: number
  leukocytesA2: number
  erythrocytesA1: number
  erythrocytesA2: number
  bacteriaA1: string
  bacteriaA2: string
  epithelialCellsA1: string
  epithelialCellsA2: string
  mucusThreadsA1: string
  mucusThreadsA2: string
  crystalsA1: string
  crystalsA2: string
  othersA1: string
  othersA2: string
  correctiveAction?: string | null
  notes?: string | null
  maxCv?: number
  leukocytesCv?: number
  erythrocytesCv?: number
}

export * from './temperature'

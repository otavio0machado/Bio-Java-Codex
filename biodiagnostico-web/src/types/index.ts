export type Role = 'ADMIN' | 'ANALYST' | 'VIEWER'
export type QcStatus = 'APROVADO' | 'REPROVADO' | 'ALERTA'
export type ViolationSeverity = 'WARNING' | 'REJECTION'
export type LabArea =
  | 'bioquimica'
  | 'hematologia'
  | 'imunologia'
  | 'parasitologia'
  | 'microbiologia'
  | 'uroanalise'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  isActive: boolean
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export interface LoginRequest {
  email: string
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
  email: string
  password: string
  name: string
  role: Role
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

export interface ReagentLot {
  id: string
  name: string
  lotNumber: string
  manufacturer?: string
  category?: string
  expiryDate?: string
  quantityValue: number
  stockUnit: string
  currentStock: number
  estimatedConsumption: number
  storageTemp?: string
  startDate?: string
  endDate?: string
  status: 'ativo' | 'em_uso' | 'inativo' | 'vencido' | string
  alertThresholdDays: number
  createdAt: string
  updatedAt: string
  daysLeft: number
  stockPct: number
  daysToRupture: number | null
  nearExpiry: boolean
}

export interface ReagentLotRequest {
  name: string
  lotNumber: string
  manufacturer?: string
  category?: string
  expiryDate?: string
  quantityValue?: number
  stockUnit?: string
  currentStock?: number
  estimatedConsumption?: number
  storageTemp?: string
  startDate?: string
  alertThresholdDays?: number
  status?: string
}

export interface StockMovement {
  id: string
  type: 'ENTRADA' | 'SAIDA' | 'AJUSTE' | string
  quantity: number
  responsible?: string
  notes?: string
  createdAt: string
}

export interface StockMovementRequest {
  type: 'ENTRADA' | 'SAIDA' | 'AJUSTE'
  quantity: number
  responsible?: string
  notes?: string
}

export interface ReagentTagSummary {
  name: string
  total: number
  ativos: number
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

export interface ImportedQcPreviewRow extends QcRecordRequest {
  previewId: string
}

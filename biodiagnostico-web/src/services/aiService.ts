import { api } from './api'
import type {
  AiAnalysisRequest,
  AuditSummaryRequest,
  AuditSummaryResponse,
  DashboardSummaryRequest,
  DashboardSummaryResponse,
  ExplainQcResponse,
  InterpretTrendRequest,
  InterpretTrendResponse,
  PrioritiesResponse,
  RootCauseResponse,
  SuggestObservationRequest,
  SuggestObservationResponse,
  ValidateBatchRequest,
  ValidateBatchResponse,
  VoiceFormData,
  VoiceToFormRequest,
} from '../types'

export const aiService = {
  async analyze(request: AiAnalysisRequest) {
    const response = await api.post<{ response: string }>('/ai/analyze', request)
    return response.data.response
  },
  async voiceToForm(request: VoiceToFormRequest) {
    const response = await api.post<VoiceFormData>('/ai/voice-to-form', request)
    return response.data
  },
  /** A1 — explica o resultado/violacao de um registro de CQ (assistivo, read-only). */
  async explainQc(recordId: string) {
    const response = await api.post<ExplainQcResponse>('/ai/qc/explain', { recordId })
    return response.data.explanation
  },
  /** A2 — interpreta a tendencia Levey-Jennings de exame+nivel+area no periodo. */
  async interpretTrend(request: InterpretTrendRequest) {
    const response = await api.post<InterpretTrendResponse>('/ai/qc/interpret-trend', request)
    return response.data.interpretation
  },
  /** C8 — sugere observacao/justificativa padronizada para o operador editar. */
  async suggestObservation(request: SuggestObservationRequest) {
    const response = await api.post<SuggestObservationResponse>('/ai/suggest-observation', request)
    return response.data.suggestion
  },
  /**
   * B5 — valida (read-only) um lote de importacao de CQ antes de submeter.
   * Devolve sugestoes estruturais e um readinessScore; nao importa nem grava.
   */
  async validateBatch(request: ValidateBatchRequest) {
    const response = await api.post<ValidateBatchResponse>('/ai/validate-batch', request)
    return response.data
  },
  /**
   * C9 — resumo executivo do dashboard (read-only). Geracao sob demanda; passa
   * {@code area}/{@code days} apenas quando informados (backend usa defaults).
   */
  async dashboardSummary(request: DashboardSummaryRequest = {}) {
    const params: Record<string, string | number> = {}
    if (request.area) params.area = request.area
    if (request.days != null) params.days = request.days
    const response = await api.get<DashboardSummaryResponse>('/ai/dashboard/summary', {
      params: Object.keys(params).length > 0 ? params : undefined,
    })
    return response.data.summary
  },
  /**
   * C10 — sumarizacao de audit logs (read-only; ADMIN). Geracao sob demanda.
   * O backend devolve 403 para nao-admin; o chamador trata o erro.
   */
  async auditSummary(request: AuditSummaryRequest = {}) {
    const params: Record<string, string | number> = {}
    if (request.days != null) params.days = request.days
    if (request.userId) params.userId = request.userId
    const response = await api.get<AuditSummaryResponse>('/ai/audit/summary', {
      params: Object.keys(params).length > 0 ? params : undefined,
    })
    return response.data.summary
  },
  /** A3 — analise de causa-raiz correlacionada de um registro de CQ (read-only). */
  async rootCause(recordId: string) {
    const response = await api.post<RootCauseResponse>('/ai/qc/root-cause', { recordId })
    return response.data.analysis
  },
  /**
   * D12 — priorizacao inteligente (read-only). Devolve a resposta completa
   * ({@code items} deterministicos + {@code recommendation} da IA). Passa
   * {@code area} apenas quando informada.
   */
  async priorities(area?: string) {
    const response = await api.get<PrioritiesResponse>('/ai/priorities', {
      params: area ? { area } : undefined,
    })
    return response.data
  },
}

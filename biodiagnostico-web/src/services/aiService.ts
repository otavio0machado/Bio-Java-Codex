import { api } from './api'
import type {
  AiAnalysisRequest,
  ExplainQcResponse,
  InterpretTrendRequest,
  InterpretTrendResponse,
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
}

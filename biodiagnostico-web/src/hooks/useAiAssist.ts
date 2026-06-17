import { useMutation } from '@tanstack/react-query'
import { aiService } from '../services/aiService'
import type { InterpretTrendRequest, SuggestObservationRequest } from '../types'

/**
 * Hooks de IA assistiva (Onda 1). Todos sao {@code useMutation} — disparam sob
 * acao explicita do operador. As respostas sao apoio a decisao e nunca alteram
 * status de CQ, calculo de Westgard, media, DP ou CV no frontend.
 */

/** A1 — explicacao inline de Westgard para um registro de CQ (por UUID). */
export function useExplainQc() {
  return useMutation({
    mutationFn: (recordId: string) => aiService.explainQc(recordId),
  })
}

/** A2 — interpretacao da tendencia Levey-Jennings exibida. */
export function useInterpretTrend() {
  return useMutation({
    mutationFn: (request: InterpretTrendRequest) => aiService.interpretTrend(request),
  })
}

/** C8 — sugestao de observacao/justificativa (operador edita antes de salvar). */
export function useSuggestObservation() {
  return useMutation({
    mutationFn: (request: SuggestObservationRequest) => aiService.suggestObservation(request),
  })
}

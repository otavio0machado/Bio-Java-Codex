import { useMutation } from '@tanstack/react-query'
import { aiService } from '../services/aiService'
import type {
  AuditSummaryRequest,
  DashboardSummaryRequest,
  InterpretTrendRequest,
  SuggestObservationRequest,
  ValidateBatchRequest,
} from '../types'

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

/**
 * B5 — validacao assistiva (read-only) de um lote de importacao de CQ antes de
 * submeter. Dispara sob acao explicita do operador; o resultado e apoio a
 * decisao (sugestoes + prontidao) e nunca importa, grava ou altera regra de CQ.
 */
export function useValidateBatch() {
  return useMutation({
    mutationFn: (request: ValidateBatchRequest) => aiService.validateBatch(request),
  })
}

/**
 * Hooks de IA assistiva (Onda 3). Tambem {@code useMutation} — inclusive os que
 * batem em endpoints GET — para que a geracao (e o custo de IA) ocorra apenas
 * sob clique do operador, nunca no load da pagina. Read-only e apoio a decisao.
 */

/** C9 — resumo executivo do dashboard (geracao sob demanda). */
export function useDashboardSummary() {
  return useMutation({
    mutationFn: (request: DashboardSummaryRequest = {}) => aiService.dashboardSummary(request),
  })
}

/** C10 — sumarizacao de audit logs (ADMIN; geracao sob demanda). */
export function useAuditSummary() {
  return useMutation({
    mutationFn: (request: AuditSummaryRequest = {}) => aiService.auditSummary(request),
  })
}

/** A3 — analise de causa-raiz de um registro de CQ (por UUID; sob demanda). */
export function useRootCause() {
  return useMutation({
    mutationFn: (recordId: string) => aiService.rootCause(recordId),
  })
}

/** D12 — priorizacao inteligente (geracao sob demanda); {@code area} opcional. */
export function usePriorities() {
  return useMutation({
    mutationFn: (area?: string) => aiService.priorities(area),
  })
}

/**
 * D11 — deteccao preventiva de drift (sob demanda; {@code area}/{@code days}
 * opcionais). {@code useMutation} para que a chamada (e o custo de IA) ocorra
 * somente ao clicar — nunca no load. Read-only: nao altera regra de CQ.
 */
export function useDriftDetection() {
  return useMutation({
    mutationFn: (params: { area?: string; days?: number } = {}) =>
      aiService.driftDetection(params.area, params.days),
  })
}

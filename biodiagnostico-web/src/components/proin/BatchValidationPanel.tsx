import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Sparkles, Wand2 } from 'lucide-react'
import type { BatchSuggestion } from '../../types'
import { AiAssistDisclaimer } from './AiAssistShared'
import {
  fieldLabel,
  formatConfidence,
  groupSuggestionsByRow,
  isApplicableExamTypo,
  issueLabel,
  resolveTypoExamName,
} from './batchValidationHelpers'

/**
 * B5 — Painel de validacao assistiva (read-only) do Modo Planilha de CQ.
 *
 * Mostra as sugestoes da IA agrupadas por linha ANTES de o operador submeter o
 * lote. Nada aqui importa, grava ou altera regra de CQ: e apoio a decisao. Para
 * sugestoes de digitacao de exame (TYPO em examName), oferece "Aplicar", que
 * apenas troca o examName daquela linha no formulario para revisao humana — a
 * importacao continua sendo um passo separado e manual. A logica pura
 * (rotulagem, agrupamento, casamento de nome) vive em {@code batchValidationHelpers}.
 */

interface BatchValidationPanelProps {
  isPending: boolean
  isError: boolean
  /** null antes da primeira validacao; objeto apos resposta (mesmo sem problemas). */
  result: { suggestions: BatchSuggestion[]; readinessScore: number } | null
  /** Nomes de exames cadastrados da area, para resolver o "Aplicar" de typo. */
  examOptions: string[]
  /** Aplica um nome de exame corrigido a uma linha (0-based na lista enviada). */
  onApplyExamName: (row: number, examName: string) => void
  /**
   * Converte o indice 0-based da linha (na lista enviada) no numero de linha
   * exibido ao operador. Default: {@code row + 1}. Permite alinhar o rotulo com
   * a posicao real no formulario quando linhas vazias foram filtradas no envio.
   */
  resolveLineNumber?: (row: number) => number
}

export function BatchValidationPanel({
  isPending,
  isError,
  result,
  examOptions,
  onApplyExamName,
  resolveLineNumber,
}: BatchValidationPanelProps) {
  const lineNumber = (row: number) => (resolveLineNumber ? resolveLineNumber(row) : row + 1)
  if (isPending) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-sm text-violet-900">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Validando a planilha com IA...</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
        <span>Não foi possível validar a planilha agora. Tente novamente.</span>
      </div>
    )
  }

  if (!result) {
    return null
  }

  const groups = groupSuggestionsByRow(result.suggestions)
  const readinessPct = Math.round(Math.max(0, Math.min(1, result.readinessScore)) * 100)

  // Sem sugestoes (lote plausivel). readinessScore 1 reforca "nada a revisar".
  if (groups.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Nenhum problema encontrado pela IA.
        </div>
        <p className="mt-1 text-sm text-green-700">
          A planilha parece pronta para registro. Revise os dados e registre quando quiser.
        </p>
        <AiAssistDisclaimer className="mt-3" />
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-2xl border border-violet-100 bg-violet-50/40 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-violet-900">
          <Sparkles className="h-5 w-5 text-violet-600" />
          Sugestões da IA para revisão
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
          Prontidão: {readinessPct}%
        </span>
      </div>
      <p className="mt-1 text-xs text-neutral-600">
        Sugestões para revisão humana — nada é importado automaticamente. Aplique ou ajuste antes de registrar.
      </p>

      <ul className="mt-3 space-y-3">
        {groups.map((group) => (
          <li key={group.row} className="rounded-xl border border-violet-100 bg-white px-3 py-2.5">
            <div className="text-sm font-semibold text-neutral-700">Linha {lineNumber(group.row)}</div>
            <ul className="mt-1.5 space-y-1.5">
              {group.suggestions.map((suggestion, idx) => {
                const applicableName = isApplicableExamTypo(suggestion)
                  ? resolveTypoExamName(suggestion.suggestion, examOptions)
                  : null
                return (
                  <li
                    key={`${suggestion.field}-${idx}`}
                    className="flex flex-wrap items-start justify-between gap-2 border-t border-neutral-100 pt-1.5 first:border-t-0 first:pt-0"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-500" />
                      <div className="min-w-0 text-sm text-neutral-700">
                        <span className="font-medium">{fieldLabel(suggestion.field)}</span>
                        <span className="text-neutral-500"> — {issueLabel(suggestion.issue)}</span>
                        <span className="text-neutral-400"> ({formatConfidence(suggestion.confidence)})</span>
                        <div className="text-sm text-neutral-600">{suggestion.suggestion}</div>
                      </div>
                    </div>
                    {applicableName ? (
                      <button
                        type="button"
                        onClick={() => onApplyExamName(group.row, applicableName)}
                        className="inline-flex flex-none items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50"
                        title={`Corrigir o exame da linha ${lineNumber(group.row)} para ${applicableName}`}
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        Aplicar: {applicableName}
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>

      <AiAssistDisclaimer className="mt-3" />
    </div>
  )
}

import type { BatchSuggestion, BatchValidationIssue } from '../../types'

/**
 * B5 — Helpers puros da validacao assistiva do Modo Planilha de CQ.
 *
 * Mantidos fora do componente (como {@code qcReferenceResolution}) para serem
 * testaveis isoladamente e nao quebrarem o fast-refresh do React. Nenhuma regra
 * de CQ aqui: apenas rotulagem PT-BR, agrupamento e casamento de nome de exame
 * sugerido contra a lista cadastrada. Read-only por construcao.
 */

/** Rotulo PT-BR amigavel para cada categoria de problema. */
const ISSUE_LABEL: Record<BatchValidationIssue, string> = {
  TYPO: 'Possível erro de digitação',
  UNKNOWN_EXAM: 'Exame não reconhecido',
  OUT_OF_RANGE: 'Valor fora da faixa esperada',
  MISSING: 'Campo ausente',
  SUSPECT_VALUE: 'Valor suspeito',
}

/** Rotulo PT-BR de um campo conhecido da planilha; fallback para o nome cru. */
const FIELD_LABEL: Record<string, string> = {
  examName: 'exame',
  level: 'nível',
  value: 'valor',
  targetValue: 'alvo',
  targetSd: 'DP',
  cvLimit: 'CV limite',
}

export function issueLabel(issue: string): string {
  return ISSUE_LABEL[issue as BatchValidationIssue] ?? issue
}

export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field
}

/** Confianca [0,1] formatada como percentual inteiro (ex.: 0.92 -> "92%"). */
export function formatConfidence(confidence: number): string {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100)
  return `${pct}%`
}

export interface SuggestionGroup {
  row: number
  suggestions: BatchSuggestion[]
}

/**
 * Agrupa as sugestoes por linha (mantendo a ordem de primeira aparicao da linha
 * e a ordem original das sugestoes dentro de cada linha). Determinista: nao
 * reordena por nada alem da chegada, para o operador conferir na mesma sequencia
 * das linhas digitadas.
 */
export function groupSuggestionsByRow(suggestions: BatchSuggestion[]): SuggestionGroup[] {
  const order: number[] = []
  const byRow = new Map<number, BatchSuggestion[]>()
  for (const suggestion of suggestions) {
    const list = byRow.get(suggestion.row)
    if (list) {
      list.push(suggestion)
    } else {
      byRow.set(suggestion.row, [suggestion])
      order.push(suggestion.row)
    }
  }
  return order.map((row) => ({ row, suggestions: byRow.get(row) ?? [] }))
}

/**
 * Resolve, para uma sugestao de TYPO de exame, qual nome cadastrado aplicar.
 *
 * O contrato garante que o nome sugerido vem SEMPRE da lista de exames da area
 * (a IA nunca inventa nome). Em vez de fazer parsing fragil do texto livre,
 * casamos o texto da sugestao contra os nomes conhecidos e devolvemos aquele que
 * aparece — assim so e possivel aplicar um exame real e cadastrado. Se nada
 * casar com seguranca (0 ou >1 candidatos), devolvemos null e nao oferecemos o
 * "Aplicar" (o operador corrige manualmente).
 */
export function resolveTypoExamName(suggestionText: string, examOptions: string[]): string | null {
  const haystack = suggestionText.toLocaleLowerCase('pt-BR')
  const matches = examOptions.filter((name) => {
    const needle = name.trim().toLocaleLowerCase('pt-BR')
    return needle.length > 0 && haystack.includes(needle)
  })
  if (matches.length !== 1) return null
  return matches[0]
}

/** True quando a sugestao e um typo de nome de exame passivel de "Aplicar". */
export function isApplicableExamTypo(suggestion: BatchSuggestion): boolean {
  return suggestion.issue === 'TYPO' && suggestion.field === 'examName'
}

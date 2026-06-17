import type { QcReferenceValue } from '../../types'

/**
 * "Hoje" no fuso LOCAL (YYYY-MM-DD). O lab opera em horario de Brasilia
 * (UTC-3); usar a data UTC (new Date().toISOString()) viraria o dia a partir
 * das 21h local e poderia mudar vigencia/ranking indevidamente. `en-CA`
 * formata como YYYY-MM-DD, comparavel lexicograficamente com validFrom/Until.
 */
function localToday(): string {
  return new Date().toLocaleDateString('en-CA')
}

export function getOperationalReferences(
  references: QcReferenceValue[],
  area: string,
  examName: string,
  date: string,
) {
  if (!examName) return []
  return references.filter((reference) =>
    reference.isActive &&
    reference.exam?.area === area &&
    reference.exam.name === examName &&
    (reference.level || 'Normal').toLowerCase() === 'normal' &&
    isRefValidOnDate(reference, date),
  )
}

function isRefValidOnDate(ref: QcReferenceValue, date: string) {
  const d = date || localToday()
  const from = ref.validFrom?.slice(0, 10)
  const until = ref.validUntil?.slice(0, 10)
  return (!from || from <= d) && (!until || until >= d)
}

/**
 * B4 — Resolucao deterministica de ambiguidade de referencia.
 *
 * Quando ha mais de uma referencia ativa e vigente para o mesmo exame+nivel,
 * em vez de bloquear o lancamento, ranqueamos as candidatas por uma heuristica
 * 100% deterministica (sem IA/LLM, sem chamada de rede) e recomendamos a mais
 * provavel. O usuario continua podendo trocar manualmente.
 *
 * Criterio de ordenacao (da mais para a menos provavel):
 *   (a) Vigencia hoje primeiro: validFrom <= data <= validUntil vem antes de
 *       qualquer nao-vigente. Observacao: quando a lista ja vem filtrada por
 *       getOperationalReferences (todas vigentes na data), este criterio fica
 *       neutro entre elas; mantemos a comparacao para ranquear de forma
 *       robusta tambem listas nao pre-filtradas.
 *   (b) Entre vigentes, a de validFrom MAIS RECENTE vem primeiro. Referencia
 *       cadastrada/iniciada mais recentemente representa o lote de controle
 *       atual em uso na bancada.
 *   (c) Desempate 1: validUntil MAIS DISTANTE (validade mais longa) vem antes;
 *       referencia sem validUntil e tratada como validade infinita.
 *   (d) Desempate 2: maior id (criacao mais recente). O id e string (UUID),
 *       entao usamos comparacao lexicografica estavel e determinstica; isso
 *       garante ordem total e estavel mesmo quando todos os campos de data
 *       empatam, sem inventar nenhum dado.
 *
 * Esta funcao NAO altera nenhuma regra de CQ/Westgard/calculo: apenas decide
 * QUAL referencia alimenta o calculo de alvo/DP/CV quando ha empate de
 * candidatas.
 */
export function rankOperationalReferences(
  references: QcReferenceValue[],
  date: string,
): QcReferenceValue[] {
  const d = date || localToday()
  return [...references].sort((a, b) => compareReferences(a, b, d))
}

/**
 * Retorna a referencia recomendada (topo do ranking) ou null se a lista
 * estiver vazia. Atalho de conveniencia sobre rankOperationalReferences.
 */
export function pickRecommendedReference(
  references: QcReferenceValue[],
  date: string,
): QcReferenceValue | null {
  if (references.length === 0) return null
  return rankOperationalReferences(references, date)[0]
}

function compareReferences(a: QcReferenceValue, b: QcReferenceValue, date: string): number {
  // (a) vigentes na data primeiro
  const aValid = isRefValidOnDate(a, date)
  const bValid = isRefValidOnDate(b, date)
  if (aValid !== bValid) return aValid ? -1 : 1

  // (b) validFrom mais recente primeiro (ausente = mais antigo possivel)
  const aFrom = a.validFrom?.slice(0, 10) ?? ''
  const bFrom = b.validFrom?.slice(0, 10) ?? ''
  if (aFrom !== bFrom) return aFrom < bFrom ? 1 : -1

  // (c) validUntil mais distante primeiro (ausente = validade infinita)
  const aUntil = a.validUntil?.slice(0, 10)
  const bUntil = b.validUntil?.slice(0, 10)
  const aUntilKey = aUntil && aUntil.length > 0 ? aUntil : '9999-12-31'
  const bUntilKey = bUntil && bUntil.length > 0 ? bUntil : '9999-12-31'
  if (aUntilKey !== bUntilKey) return aUntilKey < bUntilKey ? 1 : -1

  // (d) desempate estavel: maior id primeiro (criacao mais recente)
  if (a.id !== b.id) return a.id < b.id ? 1 : -1
  return 0
}

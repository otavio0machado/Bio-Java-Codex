import type { ComboboxOption } from '../../ui'
import type { ReagentLot, ReagentLotRequest, StockMovementRequest, User } from '../../../types'

export type ReagentSortMode = 'urgency' | 'name' | 'stock'
export type ReagentViewMode = 'list' | 'tags'
/**
 * Filtros operacionais aplicados pelo dashboard. Pos-refator v2 saem
 * {@code lowStock}, {@code ruptureRisk} e {@code expired} (este renomeado
 * para {@code vencidos}). Adicionados {@code emEstoque, emUso, foraDeEstoque}
 * para alinhar com os 5 cards de status canonicos.
 */
export type DashFilter =
  | 'emEstoque'
  | 'emUso'
  | 'foraDeEstoque'
  | 'vencidos'
  | 'expiring7d'
  | 'expiring30d'
  | 'noTraceability'
  | 'noValidity'

/**
 * Stats consumidos pelo {@code ReagentsDashboard}. Cinco contagens principais
 * (status canonicos) + alertas operacionais.
 */
export interface ReagentStats {
  total: number
  emEstoque: number
  emUso: number
  foraDeEstoque: number
  vencidos: number
  expiring7d: number
  expiring30d: number
  noTraceability: number
  noValidity: number
}

export interface ReagentFilters {
  searchTerm: string
  manufacturerFilter: string
  tempFilter: string
  alertsOnly: boolean
  dashFilter: DashFilter | null
  sortMode: ReagentSortMode
}

export function getResponsibleName(user: User | null | undefined) {
  return user?.name ?? user?.username ?? ''
}

/**
 * Form vazio para o {@code ReagentLotModal}. Reflete os 9 obrigatorios canonicos
 * + 3 opcionais (Detalhes adicionais). Status default = 'em_estoque' alinha com
 * o backend ({@code ReagentLot.status} default).
 */
export function createEmptyLotForm(): ReagentLotRequest {
  return {
    label: '',
    lotNumber: '',
    manufacturer: '',
    category: '',
    expiryDate: '',
    currentStock: 0,
    status: 'em_estoque',
    location: '',
    storageTemp: '',
    supplier: undefined,
    receivedDate: undefined,
    openedDate: undefined,
  }
}

export function createMovementForm(
  responsible = '',
  type: StockMovementRequest['type'] = 'ENTRADA',
): StockMovementRequest {
  return {
    type,
    quantity: 0,
    responsible,
    notes: '',
    reason: null,
  }
}

/**
 * Lista as chaves ASCII de campos de rastreabilidade pendentes. Quando o backend
 * envia {@code traceabilityIssues} no DTO, prevalece esse valor. Fallback recalcula
 * client-side para defesa em profundidade.
 */
export function getTraceabilityIssues(lot: ReagentLot) {
  if (Array.isArray(lot.traceabilityIssues)) {
    return lot.traceabilityIssues
  }

  const issues: string[] = []

  if (!lot.manufacturer?.trim()) issues.push('manufacturer')
  if (!lot.location?.trim()) issues.push('location')
  if (!lot.supplier?.trim()) issues.push('supplier')
  if (!lot.receivedDate) issues.push('receivedDate')

  return issues
}

export function getTraceabilityIssueLabels(lot: ReagentLot) {
  const labels: Record<string, string> = {
    manufacturer: 'fabricante',
    location: 'localização',
    supplier: 'fornecedor',
    receivedDate: 'recebimento',
  }

  return getTraceabilityIssues(lot).map((issue) => labels[issue] ?? issue)
}

/**
 * Politica canonica de aceitacao de ENTRADA pos-refator v2: somente
 * {@code vencido} bloqueia. Demais status ({@code em_estoque, em_uso,
 * fora_de_estoque}) aceitam ENTRADA — em particular {@code fora_de_estoque}
 * volta a {@code em_uso} via derivacao no backend.
 *
 * Bloqueante audit 4.2.2: fallback alinhado com a politica nova; usa
 * {@code lot.canReceiveEntry} sempre que o backend manda; senao testa
 * {@code status !== 'vencido'}.
 */
export function canReceiveEntry(lot: ReagentLot) {
  if (typeof lot.canReceiveEntry === 'boolean') {
    return lot.canReceiveEntry
  }
  return lot.status !== 'vencido'
}

/**
 * Constroi os 9 indicadores do dashboard. Cinco principais sao contagens
 * por status canonico; quatro de alerta operacional.
 */
export function buildReagentStats(lots: ReagentLot[]): ReagentStats {
  return {
    total: lots.length,
    emEstoque: lots.filter((lot) => lot.status === 'em_estoque').length,
    emUso: lots.filter((lot) => lot.status === 'em_uso').length,
    foraDeEstoque: lots.filter((lot) => lot.status === 'fora_de_estoque').length,
    vencidos: lots.filter((lot) => lot.status === 'vencido').length,
    expiring7d: lots.filter(
      (lot) => lot.status !== 'vencido' && lot.daysLeft >= 0 && lot.daysLeft <= 7,
    ).length,
    expiring30d: lots.filter(
      (lot) => lot.status !== 'vencido' && lot.daysLeft > 7 && lot.daysLeft <= 30,
    ).length,
    noTraceability: lots.filter((lot) => getTraceabilityIssues(lot).length > 0).length,
    noValidity: lots.filter((lot) => !lot.expiryDate).length,
  }
}

export function buildManufacturerOptions(lots: ReagentLot[]): ComboboxOption[] {
  const counts = new Map<string, number>()

  for (const lot of lots) {
    const manufacturer = lot.manufacturer?.trim()
    if (!manufacturer) continue
    counts.set(manufacturer, (counts.get(manufacturer) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({
      value,
      label: value,
      description: count > 1 ? `${count} lotes` : undefined,
    }))
}

/**
 * Aplica busca, filtros operacionais e ordenacao na lista de lotes.
 * Search consome agora {@code label} (e nao mais {@code name}).
 */
export function filterReagentLots(lots: ReagentLot[], filters: ReagentFilters) {
  let result = lots

  if (filters.searchTerm) {
    const normalizedTerm = filters.searchTerm.toLowerCase()
    result = result.filter(
      (lot) =>
        (lot.label ?? '').toLowerCase().includes(normalizedTerm) ||
        lot.lotNumber.toLowerCase().includes(normalizedTerm),
    )
  }

  if (filters.manufacturerFilter) {
    result = result.filter((lot) => (lot.manufacturer ?? '') === filters.manufacturerFilter)
  }

  if (filters.tempFilter) {
    result = result.filter((lot) => (lot.storageTemp ?? '') === filters.tempFilter)
  }

  if (filters.alertsOnly) {
    result = result.filter(
      (lot) =>
        lot.status === 'vencido' ||
        lot.daysLeft < 0 ||
        (lot.daysLeft >= 0 && lot.daysLeft <= 7) ||
        getTraceabilityIssues(lot).length > 0 ||
        !lot.expiryDate,
    )
  }

  if (filters.dashFilter === 'emEstoque') {
    result = result.filter((lot) => lot.status === 'em_estoque')
  } else if (filters.dashFilter === 'emUso') {
    result = result.filter((lot) => lot.status === 'em_uso')
  } else if (filters.dashFilter === 'foraDeEstoque') {
    result = result.filter((lot) => lot.status === 'fora_de_estoque')
  } else if (filters.dashFilter === 'vencidos') {
    result = result.filter((lot) => lot.status === 'vencido')
  } else if (filters.dashFilter === 'expiring7d') {
    result = result.filter(
      (lot) => lot.status !== 'vencido' && lot.daysLeft >= 0 && lot.daysLeft <= 7,
    )
  } else if (filters.dashFilter === 'expiring30d') {
    result = result.filter(
      (lot) => lot.status !== 'vencido' && lot.daysLeft > 7 && lot.daysLeft <= 30,
    )
  } else if (filters.dashFilter === 'noTraceability') {
    result = result.filter((lot) => getTraceabilityIssues(lot).length > 0)
  } else if (filters.dashFilter === 'noValidity') {
    result = result.filter((lot) => !lot.expiryDate)
  }

  const sorted = [...result]

  if (filters.sortMode === 'urgency') {
    sorted.sort((a, b) => {
      const aExpired = a.daysLeft < 0 ? 1 : 0
      const bExpired = b.daysLeft < 0 ? 1 : 0
      if (aExpired !== bExpired) return bExpired - aExpired

      const aDays = a.daysLeft ?? Number.MAX_SAFE_INTEGER
      const bDays = b.daysLeft ?? Number.MAX_SAFE_INTEGER
      return aDays - bDays
    })
  } else if (filters.sortMode === 'name') {
    sorted.sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''))
  } else if (filters.sortMode === 'stock') {
    sorted.sort((a, b) => a.currentStock - b.currentStock)
  }

  return sorted
}

/**
 * Estado visual derivado por lote para colorir cards (vencido, urgente, alerta).
 * Sem {@code stockPct}/{@code daysToRupture} pos refator v2.
 */
export function getLotVisualState(lot: ReagentLot) {
  const daysLeft = lot.daysLeft ?? 999
  const expired = lot.status === 'vencido'
  const archived = lot.status === 'fora_de_estoque'
  const urgent = !expired && daysLeft >= 0 && daysLeft <= 7
  const warning = !expired && daysLeft > 7 && daysLeft <= 30

  return {
    daysLeft,
    expired,
    archived,
    urgent,
    warning,
  }
}

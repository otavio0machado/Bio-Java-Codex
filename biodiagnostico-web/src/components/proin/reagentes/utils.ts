import type { ComboboxOption } from '../../ui'
import type { ReagentLot, ReagentLotRequest, StockMovementRequest, User } from '../../../types'
import { todayLocal } from '../../../utils/date'

export type ReagentSortMode = 'urgency' | 'name' | 'stock'
export type ReagentViewMode = 'list' | 'tags'
export type DashFilter =
  | 'expiring7d'
  | 'expiring30d'
  | 'ruptureRisk'
  | 'expired'
  | 'noTraceability'
  | 'noValidity'
  | 'lowStock'

export interface ReagentStats {
  total: number
  expiring7d: number
  expiring30d: number
  ruptureRisk: number
  expired: number
  noTraceability: number
  noValidity: number
  lowStock: number
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

export function createEmptyLotForm(): ReagentLotRequest {
  return {
    name: '',
    lotNumber: '',
    manufacturer: '',
    category: '',
    expiryDate: '',
    quantityValue: 0,
    stockUnit: 'unidades',
    currentStock: 0,
    estimatedConsumption: 0,
    storageTemp: '',
    startDate: todayLocal(),
    endDate: undefined,
    alertThresholdDays: 7,
    status: 'ativo',
    location: '',
    supplier: '',
    receivedDate: '',
    openedDate: '',
  }
}

export function createMovementForm(responsible = ''): StockMovementRequest {
  return {
    type: 'ENTRADA',
    quantity: 0,
    responsible,
    notes: '',
    reason: null,
  }
}

export function buildReagentStats(lots: ReagentLot[]): ReagentStats {
  return {
    total: lots.length,
    expiring7d: lots.filter((lot) => lot.daysLeft >= 0 && lot.daysLeft <= 7).length,
    expiring30d: lots.filter((lot) => lot.daysLeft > 7 && lot.daysLeft <= 30).length,
    ruptureRisk: lots.filter((lot) => lot.daysToRupture != null && lot.daysToRupture <= 5).length,
    expired: lots.filter((lot) => lot.daysLeft < 0 || lot.status === 'vencido').length,
    noTraceability: lots.filter((lot) => !lot.manufacturer || !lot.manufacturer.trim()).length,
    noValidity: lots.filter((lot) => !lot.expiryDate).length,
    lowStock: lots.filter((lot) => {
      const max = lot.quantityValue || 0
      if (max <= 0) return false
      return lot.currentStock / max <= 0.2
    }).length,
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

export function filterReagentLots(lots: ReagentLot[], filters: ReagentFilters) {
  let result = lots

  if (filters.searchTerm) {
    const normalizedTerm = filters.searchTerm.toLowerCase()
    result = result.filter(
      (lot) =>
        lot.name.toLowerCase().includes(normalizedTerm) ||
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
        lot.daysLeft < 0 ||
        (lot.daysLeft >= 0 && lot.daysLeft <= 7) ||
        (lot.daysToRupture != null && lot.daysToRupture <= 5) ||
        !lot.manufacturer ||
        !lot.expiryDate,
    )
  }

  if (filters.dashFilter === 'expiring7d') {
    result = result.filter((lot) => lot.daysLeft >= 0 && lot.daysLeft <= 7)
  } else if (filters.dashFilter === 'expiring30d') {
    result = result.filter((lot) => lot.daysLeft > 7 && lot.daysLeft <= 30)
  } else if (filters.dashFilter === 'ruptureRisk') {
    result = result.filter((lot) => lot.daysToRupture != null && lot.daysToRupture <= 5)
  } else if (filters.dashFilter === 'expired') {
    result = result.filter((lot) => lot.daysLeft < 0 || lot.status === 'vencido')
  } else if (filters.dashFilter === 'noTraceability') {
    result = result.filter((lot) => !lot.manufacturer || !lot.manufacturer.trim())
  } else if (filters.dashFilter === 'noValidity') {
    result = result.filter((lot) => !lot.expiryDate)
  } else if (filters.dashFilter === 'lowStock') {
    result = result.filter((lot) => {
      const max = lot.quantityValue || 0
      if (max <= 0) return false
      return lot.currentStock / max <= 0.2
    })
  }

  const sorted = [...result]

  if (filters.sortMode === 'urgency') {
    sorted.sort((a, b) => {
      const aExpired = a.daysLeft < 0 ? 1 : 0
      const bExpired = b.daysLeft < 0 ? 1 : 0
      if (aExpired !== bExpired) return bExpired - aExpired

      const aDays = a.daysLeft ?? Number.MAX_SAFE_INTEGER
      const bDays = b.daysLeft ?? Number.MAX_SAFE_INTEGER
      if (aDays !== bDays) return aDays - bDays

      const aRupture = a.daysToRupture ?? Number.MAX_SAFE_INTEGER
      const bRupture = b.daysToRupture ?? Number.MAX_SAFE_INTEGER
      return aRupture - bRupture
    })
  } else if (filters.sortMode === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name))
  } else if (filters.sortMode === 'stock') {
    sorted.sort((a, b) => a.currentStock - b.currentStock)
  }

  return sorted
}

export function getLotVisualState(lot: ReagentLot) {
  const daysLeft = lot.daysLeft ?? 999
  const expired = daysLeft < 0 || lot.status === 'vencido'
  const urgent = daysLeft >= 0 && daysLeft <= 7
  const warning = daysLeft > 7 && daysLeft <= 30
  const stockPct = lot.stockPct ?? 0

  return {
    daysLeft,
    expired,
    urgent,
    warning,
    stockPct,
  }
}

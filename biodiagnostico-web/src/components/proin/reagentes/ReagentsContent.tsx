import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Package,
  PackagePlus,
  Pencil,
  Thermometer,
} from 'lucide-react'
import type { ReagentLot, ReagentTagSummary, StockMovement } from '../../../types'
import { cn } from '../../../utils/cn'
import { formatLongBR } from '../../../utils/date'
import { Button, Card, EmptyState, StatusBadge } from '../../ui'
import { TAG_STATUS_TABS } from './constants'
import { getLotVisualState, type ReagentViewMode } from './utils'

interface ReagentsContentProps {
  viewMode: ReagentViewMode
  searchTerm: string
  tags: ReagentTagSummary[]
  lots: ReagentLot[]
  filteredLots: ReagentLot[]
  expandedTag: string | null
  tagStatusTab: string
  expandedLot: ReagentLot | null
  movements: StockMovement[]
  onExpandedTagChange: (tag: string | null) => void
  onTagStatusTabChange: (status: string) => void
  onExpandedLotChange: (lot: ReagentLot | null) => void
  onOpenMovement: (lot: ReagentLot) => void
  onOpenEdit: (lot: ReagentLot) => void
  onOpenCreate: () => void
}

export function ReagentsContent({
  viewMode,
  searchTerm,
  tags,
  lots,
  filteredLots,
  expandedTag,
  tagStatusTab,
  expandedLot,
  movements,
  onExpandedTagChange,
  onTagStatusTabChange,
  onExpandedLotChange,
  onOpenMovement,
  onOpenEdit,
  onOpenCreate,
}: ReagentsContentProps) {
  if (viewMode === 'tags') {
    return (
      <ReagentTagsView
        searchTerm={searchTerm}
        tags={tags}
        lots={lots}
        expandedTag={expandedTag}
        tagStatusTab={tagStatusTab}
        expandedLot={expandedLot}
        movements={movements}
        onExpandedTagChange={onExpandedTagChange}
        onTagStatusTabChange={onTagStatusTabChange}
        onExpandedLotChange={onExpandedLotChange}
        onOpenMovement={onOpenMovement}
        onOpenEdit={onOpenEdit}
      />
    )
  }

  if (filteredLots.length === 0) {
    return (
      <EmptyState
        icon={<PackagePlus className="h-8 w-8" />}
        title="Nenhum lote encontrado"
        description="Cadastre um lote ou limpe os filtros."
        action={{ label: 'Novo Lote', onClick: onOpenCreate }}
      />
    )
  }

  return (
    <div className="space-y-3">
      {filteredLots.map((lot) => (
        <ReagentListCard
          key={lot.id}
          lot={lot}
          isExpanded={expandedLot?.id === lot.id}
          movements={movements}
          onToggleHistory={() => onExpandedLotChange(expandedLot?.id === lot.id ? null : lot)}
          onOpenMovement={() => onOpenMovement(lot)}
          onOpenEdit={() => onOpenEdit(lot)}
        />
      ))}
    </div>
  )
}

function ReagentTagsView({
  searchTerm,
  tags,
  lots,
  expandedTag,
  tagStatusTab,
  expandedLot,
  movements,
  onExpandedTagChange,
  onTagStatusTabChange,
  onExpandedLotChange,
  onOpenMovement,
  onOpenEdit,
}: Omit<ReagentsContentProps, 'viewMode' | 'filteredLots' | 'onOpenCreate'>) {
  const filteredTags = tags.filter(
    (tag) => !searchTerm || tag.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (expandedTag === null) {
    if (filteredTags.length === 0) {
      return (
        <EmptyState
          icon={<Package className="h-8 w-8" />}
          title="Nenhuma etiqueta encontrada"
          description="Cadastre lotes com nomes para ver as etiquetas."
        />
      )
    }

    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTags.map((tag) => (
          <button
            key={tag.name}
            type="button"
            onClick={() => {
              onExpandedTagChange(tag.name)
              onTagStatusTabChange('todos')
            }}
            className="rounded-2xl border border-neutral-200 bg-white p-4 text-left transition-all hover:border-green-300 hover:shadow-md"
          >
            <p className="font-semibold text-lg text-neutral-800">{tag.name}</p>
            <p className="text-sm text-neutral-500">
              {tag.total} lote{tag.total !== 1 ? 's' : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tag.ativos > 0 ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                  {tag.ativos} ativo{tag.ativos !== 1 ? 's' : ''}
                </span>
              ) : null}
              {tag.emUso > 0 ? (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                  {tag.emUso} em uso
                </span>
              ) : null}
              {tag.inativos > 0 ? (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                  {tag.inativos} inativo{tag.inativos !== 1 ? 's' : ''}
                </span>
              ) : null}
              {tag.vencidos > 0 ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                  {tag.vencidos} vencido{tag.vencidos !== 1 ? 's' : ''}
                </span>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    )
  }

  const tagLots = lots.filter(
    (lot) => lot.name === expandedTag && (tagStatusTab === 'todos' || lot.status === tagStatusTab),
  )

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onExpandedTagChange(null)}
          className="text-green-700 hover:text-green-800 text-sm font-medium"
        >
          &larr; Voltar
        </button>
        <h3 className="text-xl font-bold text-neutral-800">{expandedTag}</h3>
      </div>

      <div className="mb-4 flex gap-2">
        {TAG_STATUS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTagStatusTabChange(tab)}
            className={cn(
              'rounded-full px-3 py-1 text-sm',
              tagStatusTab === tab
                ? 'bg-green-700 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
            )}
          >
            {tab === 'todos' ? 'Todos' : tab === 'em_uso' ? 'Em uso' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {tagLots.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-base text-neutral-500">
          Nenhum lote encontrado para este filtro.
        </div>
      ) : (
        <div className="space-y-3">
          {tagLots.map((lot) => (
            <ReagentTagCard
              key={lot.id}
              lot={lot}
              isExpanded={expandedLot?.id === lot.id}
              movements={movements}
              onToggleHistory={() => onExpandedLotChange(expandedLot?.id === lot.id ? null : lot)}
              onOpenMovement={() => onOpenMovement(lot)}
              onOpenEdit={() => onOpenEdit(lot)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ReagentListCard({
  lot,
  isExpanded,
  movements,
  onToggleHistory,
  onOpenMovement,
  onOpenEdit,
}: {
  lot: ReagentLot
  isExpanded: boolean
  movements: StockMovement[]
  onToggleHistory: () => void
  onOpenMovement: () => void
  onOpenEdit: () => void
}) {
  const { daysLeft, expired, urgent, warning, stockPct } = getLotVisualState(lot)

  return (
    <Card
      className={cn(
        'space-y-3',
        expired && 'border-red-200 bg-red-50/50',
        urgent && !expired && 'border-red-200 bg-red-50/30',
        warning && !expired && !urgent && 'border-amber-200 bg-amber-50/30',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-semibold text-neutral-900">{lot.name}</h4>
            <StatusBadge status={lot.status} />
            {lot.category ? (
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
                {lot.category}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
            <span>Lote: {lot.lotNumber}</span>
            {lot.manufacturer ? (
              <span>{lot.manufacturer}</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-3 w-3" /> Sem fabricante
              </span>
            )}
            {!lot.expiryDate ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-3 w-3" /> Sem validade
              </span>
            ) : null}
            {lot.storageTemp ? (
              <span className="flex items-center gap-1">
                <Thermometer className="h-3 w-3" />
                {lot.storageTemp}
              </span>
            ) : null}
            {lot.location ? <span className="text-neutral-500">📍 {lot.location}</span> : null}
            {lot.supplier ? <span className="text-neutral-500">Fornecedor: {lot.supplier}</span> : null}
            {lot.usedInQcRecently ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                title="Lote apareceu em CQ nos últimos 30 dias"
              >
                Em CQ recente
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-semibold',
              expired
                ? 'bg-red-600 text-white'
                : urgent
                  ? 'bg-red-100 text-red-800'
                  : warning
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-green-100 text-green-800',
            )}
          >
            {expired
              ? 'Vencido'
              : urgent
                ? `${daysLeft}d restantes`
                : warning
                  ? `${daysLeft}d`
                  : lot.expiryDate
                    ? formatLongBR(lot.expiryDate)
                    : '—'}
          </span>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium">
            {(lot.currentStock ?? 0).toFixed(0)} {lot.stockUnit}
          </span>
          <div className="flex items-center gap-3 text-neutral-500">
            {lot.daysToRupture != null && lot.daysToRupture <= 5 ? (
              <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                <AlertTriangle className="h-3 w-3" /> RISCO RUPTURA
              </span>
            ) : null}
            {lot.daysToRupture != null ? <span className="text-xs">{lot.daysToRupture}d até ruptura</span> : null}
            <span className="text-xs">{stockPct.toFixed(0)}%</span>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              stockPct <= 15 ? 'bg-red-500' : stockPct <= 50 ? 'bg-amber-500' : 'bg-green-600',
            )}
            style={{ width: `${Math.min(stockPct, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onOpenMovement}>
          Movimentar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleHistory}
          icon={isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        >
          {isExpanded ? 'Ocultar' : 'Histórico'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onOpenEdit} icon={<Pencil className="h-4 w-4" />}>
          Editar
        </Button>
      </div>

      {isExpanded ? <MovementHistoryPanel movements={movements} /> : null}
    </Card>
  )
}

function ReagentTagCard({
  lot,
  isExpanded,
  movements,
  onToggleHistory,
  onOpenMovement,
  onOpenEdit,
}: {
  lot: ReagentLot
  isExpanded: boolean
  movements: StockMovement[]
  onToggleHistory: () => void
  onOpenMovement: () => void
  onOpenEdit: () => void
}) {
  const { daysLeft, expired, urgent, warning, stockPct } = getLotVisualState(lot)

  return (
    <Card
      className={cn(
        'space-y-3',
        expired && 'border-red-200 bg-red-50/50',
        urgent && !expired && 'border-red-200 bg-red-50/30',
        warning && !expired && !urgent && 'border-amber-200 bg-amber-50/30',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-semibold text-neutral-900">{lot.name}</h4>
            <StatusBadge status={lot.status} />
            {lot.category ? (
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
                {lot.category}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
            <span>Lote: {lot.lotNumber}</span>
            <span>{lot.manufacturer || 'Sem fabricante'}</span>
            {lot.storageTemp ? (
              <span className="flex items-center gap-1">
                <Thermometer className="h-3 w-3" />
                {lot.storageTemp}
              </span>
            ) : null}
          </div>
        </div>
        <span
          className={cn(
            'rounded-full px-3 py-1.5 text-sm font-semibold',
            expired
              ? 'bg-red-600 text-white'
              : urgent
                ? 'bg-red-100 text-red-800'
                : warning
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-green-100 text-green-800',
          )}
        >
          {expired
            ? 'Vencido'
            : urgent
              ? `${daysLeft}d restantes`
              : warning
                ? `${daysLeft}d`
                : lot.expiryDate
                  ? formatLongBR(lot.expiryDate)
                  : '—'}
        </span>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium">
            {(lot.currentStock ?? 0).toFixed(0)} {lot.stockUnit}
          </span>
          <span className="text-xs text-neutral-500">{stockPct.toFixed(0)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              stockPct <= 15 ? 'bg-red-500' : stockPct <= 50 ? 'bg-amber-500' : 'bg-green-600',
            )}
            style={{ width: `${Math.min(stockPct, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onOpenMovement}>
          Movimentar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleHistory}
          icon={isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        >
          {isExpanded ? 'Ocultar' : 'Histórico'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onOpenEdit} icon={<Pencil className="h-4 w-4" />}>
          Editar
        </Button>
      </div>

      {isExpanded ? <MovementHistoryPanel movements={movements} /> : null}
    </Card>
  )
}

function MovementHistoryPanel({ movements }: { movements: StockMovement[] }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <CalendarClock className="h-4 w-4" /> Movimentações
      </div>
      {movements.length ? (
        movements.map((movement) => (
          <div
            key={movement.id}
            className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2">
              {movement.type === 'ENTRADA' ? (
                <ArrowDownLeft className="h-4 w-4 text-green-600" />
              ) : (
                <ArrowUpRight className="h-4 w-4 text-red-600" />
              )}
              <span
                className={cn(
                  'font-semibold',
                  movement.type === 'ENTRADA' ? 'text-green-700' : 'text-red-700',
                )}
              >
                {movement.type === 'ENTRADA' ? '+' : '-'}
                {movement.quantity}
              </span>
              {movement.responsible ? <span className="text-neutral-500">por {movement.responsible}</span> : null}
            </div>
            <span className="text-xs text-neutral-400">
              {new Date(movement.createdAt).toLocaleDateString('pt-BR')}
            </span>
          </div>
        ))
      ) : (
        <p className="text-sm text-neutral-500">Nenhuma movimentação.</p>
      )}
    </div>
  )
}

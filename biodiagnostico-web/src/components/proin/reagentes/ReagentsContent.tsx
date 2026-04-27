import {
  AlertTriangle,
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  MapPin,
  Package,
  PackagePlus,
  Pencil,
  ShieldCheck,
  Thermometer,
  Trash2,
  Truck,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { ReagentLot, ReagentTagSummary, StockMovement } from '../../../types'
import { cn } from '../../../utils/cn'
import { formatLongBR } from '../../../utils/date'
import { Button, Card, EmptyState, Skeleton, StatusBadge } from '../../ui'
import { MOVEMENT_REASONS, TAG_STATUS_TABS } from './constants'
import {
  getLotVisualState,
  getTraceabilityIssueLabels,
  getTraceabilityIssues,
  type ReagentViewMode,
} from './utils'

interface ReagentsContentProps {
  viewMode: ReagentViewMode
  isLoading?: boolean
  isError?: boolean
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
  onArchiveLot: (lot: ReagentLot) => void
  onOpenCreate: () => void
  onRetry?: () => void
}

export function ReagentsContent({
  viewMode,
  isLoading = false,
  isError = false,
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
  onArchiveLot,
  onOpenCreate,
  onRetry,
}: ReagentsContentProps) {
  if (isLoading) {
    return <ReagentListSkeleton />
  }

  if (isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-8 w-8" />}
        title="Não foi possível carregar reagentes"
        description="Tente novamente antes de registrar novas movimentações."
        action={onRetry ? { label: 'Tentar novamente', onClick: onRetry } : undefined}
      />
    )
  }

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
        onArchiveLot={onArchiveLot}
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
          onArchiveLot={() => onArchiveLot(lot)}
        />
      ))}
    </div>
  )
}

function ReagentListSkeleton() {
  return (
    <div className="space-y-3" aria-label="Carregando lotes de reagentes">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton width="14rem" height="1.25rem" />
              <Skeleton width="22rem" height="0.875rem" />
            </div>
            <Skeleton width="7rem" height="2rem" />
          </div>
          <Skeleton width="100%" height="0.5rem" />
          <div className="grid gap-2 sm:grid-cols-4">
            <Skeleton height="3rem" />
            <Skeleton height="3rem" />
            <Skeleton height="3rem" />
            <Skeleton height="3rem" />
          </div>
        </Card>
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
  onArchiveLot,
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
              onArchiveLot={() => onArchiveLot(lot)}
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
  onArchiveLot,
}: {
  lot: ReagentLot
  isExpanded: boolean
  movements: StockMovement[]
  onToggleHistory: () => void
  onOpenMovement: () => void
  onOpenEdit: () => void
  onArchiveLot: () => void
}) {
  const { daysLeft, expired, urgent, warning, stockPct } = getLotVisualState(lot)
  const traceabilityIssues = getTraceabilityIssues(lot)
  const traceabilityIssueLabels = getTraceabilityIssueLabels(lot)

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
            {lot.location ? (
              <span className="flex items-center gap-1 text-neutral-500">
                <MapPin className="h-3 w-3" />
                {lot.location}
              </span>
            ) : null}
            {lot.supplier ? <span className="text-neutral-500">Fornecedor: {lot.supplier}</span> : null}
            {traceabilityIssues.length > 0 ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                title={`Campos pendentes: ${traceabilityIssueLabels.join(', ')}`}
              >
                <ClipboardList className="h-3 w-3" /> Rastreabilidade incompleta
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                <ShieldCheck className="h-3 w-3" /> Rastreado
              </span>
            )}
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

      <LotOperationalDetails lot={lot} />

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
        <Button
          variant="ghost"
          size="sm"
          onClick={onArchiveLot}
          icon={lot.status === 'inativo' ? <Trash2 className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        >
          {lot.status === 'inativo' ? 'Remover' : 'Arquivar'}
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
  onArchiveLot,
}: {
  lot: ReagentLot
  isExpanded: boolean
  movements: StockMovement[]
  onToggleHistory: () => void
  onOpenMovement: () => void
  onOpenEdit: () => void
  onArchiveLot: () => void
}) {
  const { daysLeft, expired, urgent, warning, stockPct } = getLotVisualState(lot)
  const traceabilityIssues = getTraceabilityIssues(lot)
  const traceabilityIssueLabels = getTraceabilityIssueLabels(lot)

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
            {traceabilityIssues.length > 0 ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                title={`Campos pendentes: ${traceabilityIssueLabels.join(', ')}`}
              >
                <ClipboardList className="h-3 w-3" /> Rastreabilidade incompleta
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

      <LotOperationalDetails lot={lot} />

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
        <Button
          variant="ghost"
          size="sm"
          onClick={onArchiveLot}
          icon={lot.status === 'inativo' ? <Trash2 className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        >
          {lot.status === 'inativo' ? 'Remover' : 'Arquivar'}
        </Button>
      </div>

      {isExpanded ? <MovementHistoryPanel movements={movements} /> : null}
    </Card>
  )
}

function LotOperationalDetails({ lot }: { lot: ReagentLot }) {
  const expiryLabel = lot.expiryDate ? formatLongBR(lot.expiryDate) : 'Sem validade'
  const receivedLabel = lot.receivedDate ? formatLongBR(lot.receivedDate) : 'Recebimento pendente'
  const openedLabel = lot.openedDate ? formatLongBR(lot.openedDate) : 'Abertura pendente'
  const consumptionLabel =
    lot.estimatedConsumption && lot.estimatedConsumption > 0
      ? `${lot.estimatedConsumption} ${lot.stockUnit}/dia`
      : 'Sem consumo estimado'
  const ruptureLabel =
    lot.daysToRupture != null ? `${lot.daysToRupture}d até ruptura` : 'Ruptura não estimada'

  return (
    <div className="grid gap-2 rounded-xl bg-neutral-50 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <OperationalDetail
        icon={<Clock className="h-4 w-4" />}
        label="Validade"
        value={expiryLabel}
        tone={lot.status === 'vencido' ? 'danger' : lot.nearExpiry ? 'warning' : 'default'}
      />
      <OperationalDetail
        icon={<CalendarClock className="h-4 w-4" />}
        label="Recebimento / abertura"
        value={`${receivedLabel} · ${openedLabel}`}
      />
      <OperationalDetail
        icon={<Truck className="h-4 w-4" />}
        label="Fornecedor"
        value={lot.supplier?.trim() || 'Fornecedor pendente'}
      />
      <OperationalDetail
        icon={<Package className="h-4 w-4" />}
        label="Consumo"
        value={`${consumptionLabel} · ${ruptureLabel}`}
        tone={lot.daysToRupture != null && lot.daysToRupture <= 5 ? 'danger' : 'default'}
      />
    </div>
  )
}

function OperationalDetail({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: ReactNode
  label: string
  value: string
  tone?: 'default' | 'warning' | 'danger'
}) {
  return (
    <div className="min-w-0">
      <div
        className={cn(
          'mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide',
          tone === 'danger'
            ? 'text-red-700'
            : tone === 'warning'
              ? 'text-amber-700'
              : 'text-neutral-500',
        )}
      >
        {icon}
        {label}
      </div>
      <div className="break-words text-sm font-medium text-neutral-800">{value}</div>
    </div>
  )
}

function MovementHistoryPanel({ movements }: { movements: StockMovement[] }) {
  return (
    <div className="space-y-2 rounded-xl bg-neutral-50 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <CalendarClock className="h-4 w-4" /> Movimentações
      </div>
      {movements.length ? (
        movements.map((movement) => {
          const previousStock =
            typeof movement.previousStock === 'number' ? movement.previousStock : null
          let nextStock: number | null = null
          if (previousStock != null) {
            if (movement.type === 'ENTRADA') nextStock = previousStock + movement.quantity
            else if (movement.type === 'SAIDA') nextStock = previousStock - movement.quantity
            else if (movement.type === 'AJUSTE') nextStock = movement.quantity
          }
          const reasonLabel =
            MOVEMENT_REASONS.find((reason) => reason.value === movement.reason)?.label ??
            movement.reason
          const presentation =
            movement.type === 'ENTRADA'
              ? {
                  icon: <ArrowDownLeft className="h-4 w-4 text-green-600" />,
                  sign: '+',
                  className: 'text-green-700',
                }
              : movement.type === 'SAIDA'
                ? {
                    icon: <ArrowUpRight className="h-4 w-4 text-red-600" />,
                    sign: '-',
                    className: 'text-red-700',
                  }
                : {
                    icon: <Pencil className="h-4 w-4 text-blue-600" />,
                    sign: '=',
                    className: 'text-blue-700',
                  }

          return (
            <div key={movement.id} className="rounded-lg bg-white px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {presentation.icon}
                  <span className={cn('font-semibold', presentation.className)}>
                    {presentation.sign}
                    {movement.quantity}
                  </span>
                  {previousStock != null && nextStock != null ? (
                    <span className="font-mono text-xs text-neutral-500">
                      {previousStock} → {nextStock}
                    </span>
                  ) : null}
                  {movement.responsible ? (
                    <span className="text-neutral-500">por {movement.responsible}</span>
                  ) : null}
                  {reasonLabel ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {reasonLabel}
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-neutral-400">
                  {new Date(movement.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
              {movement.notes ? (
                <p className="mt-1 break-words text-xs text-neutral-500">{movement.notes}</p>
              ) : null}
            </div>
          )
        })
      ) : (
        <p className="text-sm text-neutral-500">Nenhuma movimentação.</p>
      )}
    </div>
  )
}

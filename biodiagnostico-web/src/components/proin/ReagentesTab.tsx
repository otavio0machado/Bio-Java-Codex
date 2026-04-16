import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarClock, ChevronDown, ChevronUp, Clock, Package, PackagePlus, Pencil, Search, Thermometer, TrendingDown, X } from 'lucide-react'
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useCreateReagentLot, useCreateStockMovement, useReagentLots, useReagentMovements, useUpdateReagentLot } from '../../hooks/useReagents'
import type { ReagentLot, ReagentLotRequest, ReagentTagSummary, StockMovement, StockMovementRequest } from '../../types'
import { Button, Card, Combobox, EmptyState, Input, Modal, Select, StatusBadge, useToast } from '../ui'
import { cn } from '../../utils/cn'
import { reagentService } from '../../services/reagentService'
import { reportService } from '../../services/reportService'
import { VoiceRecorderModal } from './VoiceRecorderModal'
import { formatLongBR, todayLocal } from '../../utils/date'
import { useAuth } from '../../hooks/useAuth'

/**
 * Motivos canonicos aceitos pelo backend (ver MovementReason.java).
 * Usado no Select do MovementModal para evitar texto livre.
 */
const MOVEMENT_REASONS: { value: string; label: string }[] = [
  { value: 'CONTAGEM_FISICA', label: 'Contagem física' },
  { value: 'QUEBRA', label: 'Quebra / perda' },
  { value: 'CONTAMINACAO', label: 'Contaminação' },
  { value: 'CORRECAO', label: 'Correção de lançamento' },
  { value: 'VENCIMENTO', label: 'Vencimento' },
  { value: 'OUTRO', label: 'Outro (ver observação)' },
]

const CATEGORIES = ['Bioquímica', 'Hematologia', 'Imunologia', 'Parasitologia', 'Microbiologia', 'Uroanálise', 'Kit Diagnóstico', 'Controle CQ', 'Calibrador', 'Geral']
const UNITS = ['mL', 'L', 'unidades', 'testes', 'frascos', 'kits', 'g', 'mg']
const TEMPS = ['2-8°C', '15-25°C (Ambiente)', '-20°C', '-80°C']

export function ReagentesTab() {
  const { toast } = useToast()
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedLot, setExpandedLot] = useState<ReagentLot | null>(null)
  const [isLotModalOpen, setIsLotModalOpen] = useState(false)
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)
  const [editingLot, setEditingLot] = useState<ReagentLot | null>(null)
  const [lotForm, setLotForm] = useState<ReagentLotRequest>(emptyLotForm())
  const [movementForm, setMovementForm] = useState<StockMovementRequest>({ type: 'ENTRADA', quantity: 0, responsible: '', notes: '', reason: null })
  const { user } = useAuth()
  const [dashFilter, setDashFilter] = useState<string | null>(null)
  const [manufacturerFilter, setManufacturerFilter] = useState('')
  const [tempFilter, setTempFilter] = useState('')
  const [alertsOnly, setAlertsOnly] = useState(false)
  const [sortMode, setSortMode] = useState<'urgency' | 'name' | 'stock'>('urgency')
  const [viewMode, setViewMode] = useState<'list' | 'tags'>('list')
  const [tags, setTags] = useState<ReagentTagSummary[]>([])
  const [expandedTag, setExpandedTag] = useState<string | null>(null)
  const [tagStatusTab, setTagStatusTab] = useState('todos')

  const { data: lots = [] } = useReagentLots(category || undefined, status || undefined)
  const createLot = useCreateReagentLot()
  const updateLot = useUpdateReagentLot()
  const createMovement = useCreateStockMovement(expandedLot?.id ?? '')
  const { data: movements = [] } = useReagentMovements(expandedLot?.id)

  // Load tags when switching to tags view
  useEffect(() => {
    if (viewMode === 'tags') {
      reagentService.getTagSummaries().then(setTags).catch(() => {})
    }
  }, [viewMode, lots])

  // Dashboard stats
  const stats = useMemo(() => {
    return {
      total: lots.length,
      expiring7d: lots.filter((l) => l.daysLeft >= 0 && l.daysLeft <= 7).length,
      expiring30d: lots.filter((l) => l.daysLeft > 7 && l.daysLeft <= 30).length,
      ruptureRisk: lots.filter((l) => l.daysToRupture != null && l.daysToRupture <= 5).length,
      expired: lots.filter((l) => l.daysLeft < 0 || l.status === 'vencido').length,
      // Rastreabilidade: lotes sem fabricante identificado
      noTraceability: lots.filter((l) => !l.manufacturer || !l.manufacturer.trim()).length,
      // Lotes sem data de validade preenchida
      noValidity: lots.filter((l) => !l.expiryDate).length,
      // Estoque baixo em uso — atual < 20% da quantidade inicial (ou sem estoque)
      lowStock: lots.filter((l) => {
        const max = l.quantityValue || 0
        if (max <= 0) return false
        return l.currentStock / max <= 0.2
      }).length,
    }
  }, [lots])

  // Sugestoes de fabricantes para o filtro (autocomplete)
  const manufacturerOptions = useMemo(() => {
    const set = new Map<string, number>()
    for (const lot of lots) {
      const m = lot.manufacturer?.trim()
      if (!m) continue
      set.set(m, (set.get(m) ?? 0) + 1)
    }
    return Array.from(set.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([m, c]) => ({ value: m, label: m, description: c > 1 ? `${c} lotes` : undefined }))
  }, [lots])

  // Filter lots
  const filtered = useMemo(() => {
    let result = lots
    if (searchTerm)
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          l.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    if (manufacturerFilter) result = result.filter((l) => (l.manufacturer ?? '') === manufacturerFilter)
    if (tempFilter) result = result.filter((l) => (l.storageTemp ?? '') === tempFilter)
    if (alertsOnly)
      result = result.filter(
        (l) =>
          l.daysLeft < 0 ||
          (l.daysLeft >= 0 && l.daysLeft <= 7) ||
          (l.daysToRupture != null && l.daysToRupture <= 5) ||
          !l.manufacturer ||
          !l.expiryDate,
      )
    if (dashFilter === 'expiring7d') result = result.filter((l) => l.daysLeft >= 0 && l.daysLeft <= 7)
    else if (dashFilter === 'expiring30d') result = result.filter((l) => l.daysLeft > 7 && l.daysLeft <= 30)
    else if (dashFilter === 'ruptureRisk') result = result.filter((l) => l.daysToRupture != null && l.daysToRupture <= 5)
    else if (dashFilter === 'expired') result = result.filter((l) => l.daysLeft < 0 || l.status === 'vencido')
    else if (dashFilter === 'noTraceability') result = result.filter((l) => !l.manufacturer || !l.manufacturer.trim())
    else if (dashFilter === 'noValidity') result = result.filter((l) => !l.expiryDate)
    else if (dashFilter === 'lowStock')
      result = result.filter((l) => {
        const max = l.quantityValue || 0
        if (max <= 0) return false
        return l.currentStock / max <= 0.2
      })

    // Ordenacao
    const sorted = [...result]
    if (sortMode === 'urgency') {
      // Prioriza vencidos, depois menor daysLeft, depois menor daysToRupture
      sorted.sort((a, b) => {
        const aExpired = a.daysLeft < 0 ? 1 : 0
        const bExpired = b.daysLeft < 0 ? 1 : 0
        if (aExpired !== bExpired) return bExpired - aExpired
        const aDays = a.daysLeft ?? Number.MAX_SAFE_INTEGER
        const bDays = b.daysLeft ?? Number.MAX_SAFE_INTEGER
        if (aDays !== bDays) return aDays - bDays
        const aRup = a.daysToRupture ?? Number.MAX_SAFE_INTEGER
        const bRup = b.daysToRupture ?? Number.MAX_SAFE_INTEGER
        return aRup - bRup
      })
    } else if (sortMode === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortMode === 'stock') {
      sorted.sort((a, b) => a.currentStock - b.currentStock)
    }
    return sorted
  }, [lots, searchTerm, dashFilter, manufacturerFilter, tempFilter, alertsOnly, sortMode])

  const handleOpenCreate = () => { setEditingLot(null); setLotForm(emptyLotForm()); setIsLotModalOpen(true) }
  const handleOpenEdit = (lot: ReagentLot) => {
    setEditingLot(lot)
    setLotForm({
      name: lot.name, lotNumber: lot.lotNumber, manufacturer: lot.manufacturer ?? '', category: lot.category ?? '',
      expiryDate: lot.expiryDate ?? '', quantityValue: lot.quantityValue, stockUnit: lot.stockUnit,
      currentStock: lot.currentStock, estimatedConsumption: lot.estimatedConsumption,
      storageTemp: lot.storageTemp ?? '', startDate: lot.startDate ?? '', endDate: lot.endDate ?? undefined, alertThresholdDays: lot.alertThresholdDays, status: lot.status,
      // Fase 3
      location: lot.location ?? '', supplier: lot.supplier ?? '', receivedDate: lot.receivedDate ?? '', openedDate: lot.openedDate ?? '',
    })
    setIsLotModalOpen(true)
  }
  const handleSaveLot = async () => {
    if (!lotForm.name || !lotForm.lotNumber) { toast.warning('Preencha nome e lote.'); return }
    // Fase 2: rastreabilidade obrigatoria
    if (!lotForm.manufacturer || !lotForm.manufacturer.trim()) {
      toast.warning('Informe o fabricante do lote.')
      return
    }
    if (!lotForm.expiryDate) {
      toast.warning('Informe a data de validade.')
      return
    }
    if (lotForm.expiryDate && lotForm.startDate && lotForm.expiryDate < lotForm.startDate) {
      toast.warning('A data de validade não pode ser anterior à data de início de uso.')
      return
    }
    try {
      if (editingLot) { await updateLot.mutateAsync({ id: editingLot.id, request: lotForm }); toast.success('Lote atualizado.') }
      else { await createLot.mutateAsync(lotForm); toast.success('Lote cadastrado.') }
      setIsLotModalOpen(false); setEditingLot(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar lote.'
      toast.error(msg)
    }
  }
  const handleMovement = async () => {
    if (!expandedLot || !movementForm.quantity) { toast.warning('Informe a quantidade.'); return }
    if (!movementForm.responsible || !movementForm.responsible.trim()) {
      toast.warning('Informe o responsável pela movimentação.')
      return
    }
    // Fase 2: motivo obrigatorio em AJUSTE e em SAIDA que zere o estoque
    const nextStock =
      movementForm.type === 'ENTRADA'
        ? (expandedLot.currentStock ?? 0) + movementForm.quantity
        : movementForm.type === 'SAIDA'
          ? (expandedLot.currentStock ?? 0) - movementForm.quantity
          : movementForm.quantity
    const zeroingSaida = movementForm.type === 'SAIDA' && nextStock === 0
    if ((movementForm.type === 'AJUSTE' || zeroingSaida) && !movementForm.reason) {
      toast.warning('Selecione um motivo: AJUSTE e saídas que zeram o estoque exigem justificativa.')
      return
    }
    try {
      await createMovement.mutateAsync(movementForm)
      toast.success('Movimentação registrada.')
      setMovementForm({ type: 'ENTRADA', quantity: 0, responsible: user?.name ?? user?.username ?? '', notes: '', reason: null })
      setIsMovementModalOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar movimentação.'
      toast.error(msg)
    }
  }
  const handlePdf = async () => {
    try {
      const blob = await reportService.getReagentsPdf()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'reagentes.pdf'; a.click()
    } catch { toast.error('Erro ao gerar PDF.') }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-neutral-900">Gestão de Reagentes</h3>
          <p className="text-base text-neutral-500">Controle de lotes, estoque e movimentações</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void handlePdf()}>PDF</Button>
          <Button variant="secondary" size="sm" onClick={async () => {
            try {
              const blob = await reagentService.exportCsv(category || undefined, status || undefined)
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = 'reagentes.csv'
              a.click()
              URL.revokeObjectURL(a.href)
            } catch { toast.error('Erro ao exportar CSV.') }
          }}>
            CSV
          </Button>
          <VoiceRecorderModal formType="reagente" title="Reagente por voz" onApply={(d) => {
            setLotForm((c) => ({
              ...c,
              name: typeof d.name === 'string' ? d.name : c.name,
              lotNumber: typeof d.lot_number === 'string' ? d.lot_number : c.lotNumber,
              expiryDate: typeof d.expiry_date === 'string' ? d.expiry_date : c.expiryDate,
              manufacturer: typeof d.manufacturer === 'string' ? d.manufacturer : c.manufacturer,
            }))
            setIsLotModalOpen(true)
          }} />
          <Button onClick={handleOpenCreate} icon={<PackagePlus className="h-4 w-4" />}>Novo Lote</Button>
        </div>
      </div>

      {/* Acao hoje — filas operacionais prioritarias */}
      {(stats.expiring7d > 0 || stats.ruptureRisk > 0 || stats.noTraceability > 0 || stats.noValidity > 0) ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <h4 className="text-base font-semibold text-amber-900">Ação hoje</h4>
            <p className="text-sm text-amber-800/80">Filas que precisam de intervenção imediata.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ActionQueueCard
              label="Vencem em 7 dias"
              value={stats.expiring7d}
              description="Planeje substituição ou descarte."
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="red"
              active={dashFilter === 'expiring7d'}
              onClick={() => setDashFilter(dashFilter === 'expiring7d' ? null : 'expiring7d')}
            />
            <ActionQueueCard
              label="Risco de ruptura"
              value={stats.ruptureRisk}
              description="Estoque acabará em ≤5 dias no ritmo atual."
              icon={<TrendingDown className="h-4 w-4" />}
              tone="red"
              active={dashFilter === 'ruptureRisk'}
              onClick={() => setDashFilter(dashFilter === 'ruptureRisk' ? null : 'ruptureRisk')}
            />
            <ActionQueueCard
              label="Sem rastreabilidade"
              value={stats.noTraceability}
              description="Lotes sem fabricante identificado."
              icon={<Package className="h-4 w-4" />}
              tone="amber"
              active={dashFilter === 'noTraceability'}
              onClick={() => setDashFilter(dashFilter === 'noTraceability' ? null : 'noTraceability')}
            />
            <ActionQueueCard
              label="Sem validade"
              value={stats.noValidity}
              description="Lotes sem data de validade preenchida."
              icon={<Clock className="h-4 w-4" />}
              tone="amber"
              active={dashFilter === 'noValidity'}
              onClick={() => setDashFilter(dashFilter === 'noValidity' ? null : 'noValidity')}
            />
          </div>
        </div>
      ) : null}

      {/* KPIs gerais — resumo de estoque */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <DashCard label="Total" value={stats.total} icon={<Package className="h-5 w-5" />} color="blue" active={dashFilter === null} onClick={() => setDashFilter(null)} />
        <DashCard label="Vencem 7d" value={stats.expiring7d} icon={<AlertTriangle className="h-5 w-5" />} color="red" active={dashFilter === 'expiring7d'} onClick={() => setDashFilter(dashFilter === 'expiring7d' ? null : 'expiring7d')} />
        <DashCard label="Vencem 30d" value={stats.expiring30d} icon={<Clock className="h-5 w-5" />} color="amber" active={dashFilter === 'expiring30d'} onClick={() => setDashFilter(dashFilter === 'expiring30d' ? null : 'expiring30d')} />
        <DashCard label="Baixo estoque" value={stats.lowStock} icon={<TrendingDown className="h-5 w-5" />} color="amber" active={dashFilter === 'lowStock'} onClick={() => setDashFilter(dashFilter === 'lowStock' ? null : 'lowStock')} />
        <DashCard label="Vencidos" value={stats.expired} icon={<X className="h-5 w-5" />} color="neutral" active={dashFilter === 'expired'} onClick={() => setDashFilter(dashFilter === 'expired' ? null : 'expired')} />
      </div>

      {/* Search + Filters + modo de visualizacao */}
      <Card className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Input placeholder="Buscar reagente ou lote..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Todas categorias</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Combobox
            placeholder="Todos fabricantes"
            value={manufacturerFilter}
            onChange={setManufacturerFilter}
            options={manufacturerOptions}
            allowCustom={false}
            emptyText="Nenhum fabricante cadastrado"
          />
          <Select value={tempFilter} onChange={(e) => setTempFilter(e.target.value)}>
            <option value="">Todas temperaturas</option>
            {TEMPS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos status</option>
            <option value="ativo">Ativo</option>
            <option value="em_uso">Em uso</option>
            <option value="inativo">Inativo</option>
            <option value="vencido">Vencido</option>
          </Select>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700">
            <input type="checkbox" checked={alertsOnly} onChange={(e) => setAlertsOnly(e.target.checked)} className="h-4 w-4 rounded" />
            Somente alertas
          </label>
          <div className="ml-auto flex items-center gap-2 text-sm text-neutral-500">
            <span>Ordenar:</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as 'urgency' | 'name' | 'stock')}
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-700"
            >
              <option value="urgency">Urgência</option>
              <option value="name">Nome</option>
              <option value="stock">Estoque atual</option>
            </select>
            <span className="mx-2 hidden h-4 w-px bg-neutral-200 sm:block" />
            <button
              type="button"
              onClick={() => { setViewMode((v) => (v === 'tags' ? 'list' : 'tags')); setExpandedTag(null) }}
              className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-50"
              title="Alternar visualização"
            >
              {viewMode === 'tags' ? 'Ver lista' : 'Ver etiquetas'}
            </button>
          </div>
          {(dashFilter || manufacturerFilter || tempFilter || alertsOnly) ? (
            <button
              onClick={() => { setDashFilter(null); setManufacturerFilter(''); setTempFilter(''); setAlertsOnly(false) }}
              className="text-sm text-green-700 underline"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      </Card>

      {/* Lot Cards / Tags View */}
      {viewMode === 'tags' ? (
        expandedTag === null ? (
          /* Tags overview */
          tags.filter(t => !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
            <EmptyState icon={<Package className="h-8 w-8" />} title="Nenhuma etiqueta encontrada" description="Cadastre lotes com nomes para ver as etiquetas." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tags.filter(t => !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase())).map(tag => (
                <button key={tag.name} onClick={() => { setExpandedTag(tag.name); setTagStatusTab('todos') }}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 text-left hover:border-green-300 hover:shadow-md transition-all">
                  <p className="font-semibold text-lg text-neutral-800">{tag.name}</p>
                  <p className="text-sm text-neutral-500">{tag.total} lote{tag.total !== 1 ? 's' : ''}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tag.ativos > 0 && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">{tag.ativos} ativo{tag.ativos !== 1 ? 's' : ''}</span>}
                    {tag.emUso > 0 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{tag.emUso} em uso</span>}
                    {tag.inativos > 0 && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{tag.inativos} inativo{tag.inativos !== 1 ? 's' : ''}</span>}
                    {tag.vencidos > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">{tag.vencidos} vencido{tag.vencidos !== 1 ? 's' : ''}</span>}
                  </div>
                </button>
              ))}
            </div>
          )
        ) : (
          /* Tag detail: lots filtered by tag name and status */
          <div>
            <div className="mb-4 flex items-center gap-3">
              <button onClick={() => setExpandedTag(null)} className="text-green-700 hover:text-green-800 text-sm font-medium">
                &larr; Voltar
              </button>
              <h3 className="text-xl font-bold text-neutral-800">{expandedTag}</h3>
            </div>
            <div className="mb-4 flex gap-2">
              {['todos', 'ativo', 'em_uso', 'inativo', 'vencido'].map(tab => (
                <button key={tab} onClick={() => setTagStatusTab(tab)}
                  className={`rounded-full px-3 py-1 text-sm ${tagStatusTab === tab ? 'bg-green-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                  {tab === 'todos' ? 'Todos' : tab === 'em_uso' ? 'Em uso' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            {(() => {
              const tagLots = lots.filter(l => l.name === expandedTag && (tagStatusTab === 'todos' || l.status === tagStatusTab))
              if (tagLots.length === 0) return (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-base text-neutral-500">Nenhum lote encontrado para este filtro.</div>
              )
              return (
                <div className="space-y-3">
                  {tagLots.map((lot) => {
                    const daysLeft = lot.daysLeft ?? 999
                    const expired = daysLeft < 0 || lot.status === 'vencido'
                    const urgent = daysLeft >= 0 && daysLeft <= 7
                    const warning = daysLeft > 7 && daysLeft <= 30
                    const stockPct = lot.stockPct ?? 0
                    const isExp = expandedLot?.id === lot.id
                    return (
                      <Card key={lot.id} className={cn(
                        'space-y-3',
                        expired && 'border-red-200 bg-red-50/50',
                        urgent && !expired && 'border-red-200 bg-red-50/30',
                        warning && !expired && !urgent && 'border-amber-200 bg-amber-50/30',
                      )}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-semibold text-neutral-900">{lot.name}</h4>
                              <StatusBadge status={lot.status} />
                              {lot.category && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">{lot.category}</span>}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                              <span>Lote: {lot.lotNumber}</span>
                              <span>{lot.manufacturer || 'Sem fabricante'}</span>
                              {lot.storageTemp && <span className="flex items-center gap-1"><Thermometer className="h-3 w-3" />{lot.storageTemp}</span>}
                            </div>
                          </div>
                          <span className={cn(
                            'rounded-full px-3 py-1.5 text-sm font-semibold',
                            expired ? 'bg-red-600 text-white' :
                            urgent ? 'bg-red-100 text-red-800' :
                            warning ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800',
                          )}>
                            {expired ? 'Vencido' : urgent ? `${daysLeft}d restantes` : warning ? `${daysLeft}d` : lot.expiryDate ? formatLongBR(lot.expiryDate) : '\u2014'}
                          </span>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium">{(lot.currentStock ?? 0).toFixed(0)} {lot.stockUnit}</span>
                            <span className="text-xs text-neutral-500">{stockPct.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
                            <div className={cn(
                              'h-full rounded-full transition-all',
                              stockPct <= 15 ? 'bg-red-500' : stockPct <= 50 ? 'bg-amber-500' : 'bg-green-600',
                            )} style={{ width: `${Math.min(stockPct, 100)}%` }} />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="secondary" size="sm" onClick={() => { setExpandedLot(lot); setMovementForm({ type: 'ENTRADA', quantity: 0, responsible: user?.name ?? user?.username ?? '', notes: '', reason: null }); setIsMovementModalOpen(true) }}>Movimentar</Button>
                          <Button variant="ghost" size="sm" onClick={() => setExpandedLot(isExp ? null : lot)}
                            icon={isExp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}>
                            {isExp ? 'Ocultar' : 'Hist\u00f3rico'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(lot)} icon={<Pencil className="h-4 w-4" />}>Editar</Button>
                        </div>
                        {isExp && (
                          <div className="rounded-xl bg-neutral-50 p-3 space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                              <CalendarClock className="h-4 w-4" /> Movimenta\u00e7\u00f5es
                            </div>
                            {movements.length ? movements.map((m) => (
                              <div key={m.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                                <div className="flex items-center gap-2">
                                  {m.type === 'ENTRADA' ? <ArrowDownLeft className="h-4 w-4 text-green-600" /> : <ArrowUpRight className="h-4 w-4 text-red-600" />}
                                  <span className={cn('font-semibold', m.type === 'ENTRADA' ? 'text-green-700' : 'text-red-700')}>
                                    {m.type === 'ENTRADA' ? '+' : '-'}{m.quantity}
                                  </span>
                                  {m.responsible && <span className="text-neutral-500">por {m.responsible}</span>}
                                </div>
                                <span className="text-xs text-neutral-400">{new Date(m.createdAt).toLocaleDateString('pt-BR')}</span>
                              </div>
                            )) : <p className="text-sm text-neutral-500">Nenhuma movimenta\u00e7\u00e3o.</p>}
                          </div>
                        )}
                      </Card>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )
      ) : filtered.length === 0 ? (
        <EmptyState icon={<PackagePlus className="h-8 w-8" />} title="Nenhum lote encontrado" description="Cadastre um lote ou limpe os filtros." action={{ label: 'Novo Lote', onClick: handleOpenCreate }} />
      ) : (
        <div className="space-y-3">
          {filtered.map((lot) => {
            const daysLeft = lot.daysLeft ?? 999
            const expired = daysLeft < 0 || lot.status === 'vencido'
            const urgent = daysLeft >= 0 && daysLeft <= 7
            const warning = daysLeft > 7 && daysLeft <= 30
            const stockPct = lot.stockPct ?? 0
            const isExpanded = expandedLot?.id === lot.id

            return (
              <Card key={lot.id} className={cn(
                'space-y-3',
                expired && 'border-red-200 bg-red-50/50',
                urgent && !expired && 'border-red-200 bg-red-50/30',
                warning && !expired && !urgent && 'border-amber-200 bg-amber-50/30',
              )}>
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-semibold text-neutral-900">{lot.name}</h4>
                      <StatusBadge status={lot.status} />
                      {lot.category && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">{lot.category}</span>}
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
                      {lot.storageTemp && <span className="flex items-center gap-1"><Thermometer className="h-3 w-3" />{lot.storageTemp}</span>}
                      {lot.location ? <span className="text-neutral-500">📍 {lot.location}</span> : null}
                      {lot.supplier ? <span className="text-neutral-500">Fornecedor: {lot.supplier}</span> : null}
                      {lot.usedInQcRecently ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800" title="Lote apareceu em CQ nos últimos 30 dias">
                          Em CQ recente
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Validade badge */}
                    <span className={cn(
                      'rounded-full px-3 py-1.5 text-sm font-semibold',
                      expired ? 'bg-red-600 text-white' :
                      urgent ? 'bg-red-100 text-red-800' :
                      warning ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800',
                    )}>
                      {expired ? 'Vencido' : urgent ? `${daysLeft}d restantes` : warning ? `${daysLeft}d` : lot.expiryDate ? formatLongBR(lot.expiryDate) : '—'}
                    </span>
                  </div>
                </div>

                {/* Stock bar */}
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{(lot.currentStock ?? 0).toFixed(0)} {lot.stockUnit}</span>
                    <div className="flex items-center gap-3 text-neutral-500">
                      {lot.daysToRupture != null && lot.daysToRupture <= 5 && (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                          <AlertTriangle className="h-3 w-3" /> RISCO RUPTURA
                        </span>
                      )}
                      {lot.daysToRupture != null && <span className="text-xs">{lot.daysToRupture}d até ruptura</span>}
                      <span className="text-xs">{stockPct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
                    <div className={cn(
                      'h-full rounded-full transition-all',
                      stockPct <= 15 ? 'bg-red-500' : stockPct <= 50 ? 'bg-amber-500' : 'bg-green-600',
                    )} style={{ width: `${Math.min(stockPct, 100)}%` }} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => { setExpandedLot(lot); setMovementForm({ type: 'ENTRADA', quantity: 0, responsible: user?.name ?? user?.username ?? '', notes: '', reason: null }); setIsMovementModalOpen(true) }}>
                    Movimentar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setExpandedLot(isExpanded ? null : lot)}
                    icon={isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}>
                    {isExpanded ? 'Ocultar' : 'Histórico'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(lot)} icon={<Pencil className="h-4 w-4" />}>Editar</Button>
                </div>

                {/* Expanded movements */}
                {isExpanded && (
                  <div className="rounded-xl bg-neutral-50 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                      <CalendarClock className="h-4 w-4" /> Movimentações
                    </div>
                    {movements.length ? movements.map((m) => (
                      <div key={m.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          {m.type === 'ENTRADA' ? <ArrowDownLeft className="h-4 w-4 text-green-600" /> : <ArrowUpRight className="h-4 w-4 text-red-600" />}
                          <span className={cn('font-semibold', m.type === 'ENTRADA' ? 'text-green-700' : 'text-red-700')}>
                            {m.type === 'ENTRADA' ? '+' : '-'}{m.quantity}
                          </span>
                          {m.responsible && <span className="text-neutral-500">por {m.responsible}</span>}
                        </div>
                        <span className="text-xs text-neutral-400">{new Date(m.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    )) : <p className="text-sm text-neutral-500">Nenhuma movimentação.</p>}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Modais */}
      <LotModal form={lotForm} isOpen={isLotModalOpen} isEditing={Boolean(editingLot)} isSaving={editingLot ? updateLot.isPending : createLot.isPending}
        onClose={() => { setIsLotModalOpen(false); setEditingLot(null) }} onSave={handleSaveLot} setForm={setLotForm} />
      <MovementModal form={movementForm} isOpen={isMovementModalOpen} isSaving={createMovement.isPending} lot={expandedLot}
        onClose={() => { setIsMovementModalOpen(false); setMovementForm({ type: 'ENTRADA', quantity: 0, responsible: '', notes: '' }) }}
        onSave={handleMovement} setForm={setMovementForm} movements={movements} />
    </div>
  )
}

// --- Action Queue Card (Fase 1: bloco "Ação hoje") ---
function ActionQueueCard({
  label,
  value,
  description,
  icon,
  tone,
  active,
  onClick,
}: {
  label: string
  value: number
  description: string
  icon: React.ReactNode
  tone: 'red' | 'amber'
  active: boolean
  onClick: () => void
}) {
  const iconBg = tone === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
  const border = active
    ? tone === 'red'
      ? 'border-red-500 bg-red-50 shadow-sm'
      : 'border-amber-500 bg-amber-50 shadow-sm'
    : 'border-neutral-200 bg-white hover:border-neutral-300'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex items-start gap-3 rounded-2xl border p-4 text-left transition', border)}
    >
      <div className={cn('rounded-lg p-2', iconBg)}>{icon}</div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-neutral-900">{value}</span>
          <span className="text-sm font-medium text-neutral-700">{label}</span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">{description}</p>
        <span className={cn('mt-2 inline-flex items-center gap-1 text-xs font-medium', tone === 'red' ? 'text-red-700' : 'text-amber-700')}>
          Ver lotes <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
    </button>
  )
}

// --- Dashboard Card ---
function DashCard({ label, value, icon, color, active, onClick }: { label: string; value: number; icon: React.ReactNode; color: string; active: boolean; onClick: () => void }) {
  const colors: Record<string, string> = {
    blue: active ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-neutral-200 hover:border-blue-300',
    red: active ? 'border-red-500 bg-red-50 shadow-md' : 'border-neutral-200 hover:border-red-300',
    amber: active ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-neutral-200 hover:border-amber-300',
    neutral: active ? 'border-neutral-500 bg-neutral-100 shadow-md' : 'border-neutral-200 hover:border-neutral-400',
  }
  const iconColors: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-700', neutral: 'bg-neutral-200 text-neutral-600' }
  return (
    <button onClick={onClick} className={cn('flex items-center gap-3 rounded-xl border p-4 text-left transition', colors[color])}>
      <div className={cn('rounded-lg p-2', iconColors[color])}>{icon}</div>
      <div>
        <div className="text-2xl font-bold text-neutral-900">{value}</div>
        <div className="text-sm text-neutral-500">{label}</div>
      </div>
    </button>
  )
}

// --- Lot Modal (com secoes como Python) ---
function LotModal({ form, isOpen, isEditing, isSaving, onClose, onSave, setForm }: {
  form: ReagentLotRequest; isOpen: boolean; isEditing: boolean; isSaving: boolean
  onClose: () => void; onSave: () => void; setForm: Dispatch<SetStateAction<ReagentLotRequest>>
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Editar Lote' : 'Novo Lote'} size="lg"
      footer={<div className="flex justify-end gap-3"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={onSave} loading={isSaving}>{isEditing ? 'Atualizar' : 'Cadastrar'}</Button></div>}>
      <div className="space-y-5">
        <FormSection title="Identificação" icon="tag">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Nome / Etiqueta" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="Ex: Glicose, HIV, TSH..." />
            <Input label="Nº do Lote" value={form.lotNumber} onChange={(e) => setForm((c) => ({ ...c, lotNumber: e.target.value }))} />
            <div>
              <Input label="Fabricante *" value={form.manufacturer} onChange={(e) => setForm((c) => ({ ...c, manufacturer: e.target.value }))} placeholder="Ex: Wama, Abon..." />
              {!form.manufacturer?.trim() && (
                <p className="mt-1 text-xs text-amber-600">Obrigatório: fabricante é exigido para rastreabilidade.</p>
              )}
            </div>
            <Select label="Categoria" value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}>
              <option value="">Selecione...</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        </FormSection>
        <FormSection title="Estoque" icon="boxes">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Estoque Atual" type="number" value={String(form.currentStock ?? 0)} onChange={(e) => setForm((c) => ({ ...c, currentStock: Number(e.target.value) }))} />
            <Select label="Unidade" value={form.stockUnit} onChange={(e) => setForm((c) => ({ ...c, stockUnit: e.target.value }))}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
            <Input label="Consumo/Dia" type="number" value={String(form.estimatedConsumption ?? 0)} onChange={(e) => setForm((c) => ({ ...c, estimatedConsumption: Number(e.target.value) }))} />
            <Input label="Qtde Inicial" type="number" value={String(form.quantityValue ?? 0)} onChange={(e) => setForm((c) => ({ ...c, quantityValue: Number(e.target.value) }))} />
          </div>
        </FormSection>
        <FormSection title="Validade e Datas" icon="calendar">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Input label="Validade *" type="date" value={form.expiryDate} onChange={(e) => setForm((c) => ({ ...c, expiryDate: e.target.value }))} />
              {!form.expiryDate && (
                <p className="mt-1 text-xs text-amber-600">Obrigatório: validade é exigida para alertas e rastreabilidade.</p>
              )}
            </div>
            <Input label="Alerta (dias antes)" type="number" value={String(form.alertThresholdDays ?? 7)} onChange={(e) => setForm((c) => ({ ...c, alertThresholdDays: Number(e.target.value) }))} />
            <Input label="Início de Uso" type="date" value={form.startDate} onChange={(e) => setForm((c) => ({ ...c, startDate: e.target.value }))} />
            <Input label="Data Fim de Uso" type="date" value={form.endDate ?? ''} onChange={(e) => setForm((c) => ({ ...c, endDate: e.target.value || undefined }))} />
            <Select label="Temperatura" value={form.storageTemp} onChange={(e) => setForm((c) => ({ ...c, storageTemp: e.target.value }))}>
              <option value="">Selecione...</option>
              {TEMPS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
        </FormSection>
        {/* Fase 3: rastreabilidade forte (opcional por enquanto) */}
        <FormSection title="Rastreabilidade" icon="map">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Localização física"
              value={form.location ?? ''}
              onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))}
              placeholder="Ex: Geladeira 2, Prateleira B"
            />
            <Input
              label="Fornecedor"
              value={form.supplier ?? ''}
              onChange={(e) => setForm((c) => ({ ...c, supplier: e.target.value }))}
              placeholder="Distribuidor / revendedor"
            />
            <Input
              label="Data de recebimento"
              type="date"
              value={form.receivedDate ?? ''}
              onChange={(e) => setForm((c) => ({ ...c, receivedDate: e.target.value }))}
            />
            <Input
              label="Data de abertura"
              type="date"
              value={form.openedDate ?? ''}
              onChange={(e) => setForm((c) => ({ ...c, openedDate: e.target.value }))}
            />
          </div>
        </FormSection>
      </div>
    </Modal>
  )
}

function FormSection({ title, icon: _icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-green-800">{title}</div>
      <div className="border-l-2 border-green-200 pl-4">{children}</div>
    </div>
  )
}

// --- Movement Modal (com historico dentro) ---
function MovementModal({ form, isOpen, isSaving, lot, onClose, onSave, setForm, movements }: {
  form: StockMovementRequest; isOpen: boolean; isSaving: boolean; lot: ReagentLot | null
  onClose: () => void; onSave: () => void; setForm: Dispatch<SetStateAction<StockMovementRequest>>
  movements: StockMovement[]
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Movimentação${lot ? ` · ${lot.name}` : ''}`}
      footer={<div className="flex justify-end gap-3"><Button variant="ghost" onClick={onClose}>Fechar</Button><Button onClick={onSave} loading={isSaving}>Registrar</Button></div>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Tipo" value={form.type} onChange={(e) => setForm((c) => ({ ...c, type: e.target.value as StockMovementRequest['type'] }))}>
          <option value="ENTRADA">Entrada</option>
          <option value="SAIDA">Saída</option>
          <option value="AJUSTE">Ajuste</option>
        </Select>
        <Input label="Quantidade" type="number" value={String(form.quantity)} onChange={(e) => setForm((c) => ({ ...c, quantity: Number(e.target.value) }))} />
        <Input label="Responsável *" value={form.responsible} onChange={(e) => setForm((c) => ({ ...c, responsible: e.target.value }))} />
        <Select
          label={form.type === 'AJUSTE' ? 'Motivo *' : 'Motivo (opcional)'}
          value={form.reason ?? ''}
          onChange={(e) => setForm((c) => ({ ...c, reason: (e.target.value || null) as StockMovementRequest['reason'] }))}
        >
          <option value="">{form.type === 'AJUSTE' ? 'Selecione o motivo' : 'Sem motivo específico'}</option>
          {MOVEMENT_REASONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
        <Input label="Observações" value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} />
      </div>
      {form.type === 'AJUSTE' ? (
        <p className="mt-2 text-xs text-amber-700">
          Ajustes manuais exigem um motivo para auditoria.
        </p>
      ) : null}
      {movements.length > 0 && (
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <div className="mb-2 flex items-center justify-between text-sm font-medium text-neutral-700">
            <span>Histórico</span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{movements.length}</span>
          </div>
          <div className="max-h-[200px] space-y-1 overflow-y-auto">
            {movements.map((m) => {
              // Fase 3: calcula estoque final a partir do previousStock para timeline antes->depois.
              const prev = typeof m.previousStock === 'number' ? m.previousStock : null
              let next: number | null = null
              if (prev != null) {
                if (m.type === 'ENTRADA') next = prev + m.quantity
                else if (m.type === 'SAIDA') next = prev - m.quantity
                else if (m.type === 'AJUSTE') next = m.quantity
              }
              return (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    {m.type === 'ENTRADA' ? <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" /> : m.type === 'SAIDA' ? <ArrowUpRight className="h-3.5 w-3.5 text-red-600" /> : <Pencil className="h-3.5 w-3.5 text-blue-600" />}
                    <span className={cn('font-semibold', m.type === 'ENTRADA' ? 'text-green-700' : m.type === 'SAIDA' ? 'text-red-700' : 'text-blue-700')}>
                      {m.type === 'ENTRADA' ? '+' : m.type === 'SAIDA' ? '-' : '='}{m.quantity}
                    </span>
                    {prev != null && next != null ? (
                      <span className="text-xs text-neutral-500 font-mono">{prev} → {next}</span>
                    ) : null}
                    {m.responsible && <span className="text-neutral-400">por {m.responsible}</span>}
                    {m.reason ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {MOVEMENT_REASONS.find((r) => r.value === m.reason)?.label ?? m.reason}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-neutral-400">{new Date(m.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Modal>
  )
}

function emptyLotForm(): ReagentLotRequest {
  return {
    name: '', lotNumber: '', manufacturer: '', category: '', expiryDate: '',
    quantityValue: 0, stockUnit: 'unidades', currentStock: 0, estimatedConsumption: 0,
    storageTemp: '', startDate: todayLocal(), endDate: undefined, alertThresholdDays: 7, status: 'ativo',
    // Fase 3: rastreabilidade forte (opcionais)
    location: '', supplier: '', receivedDate: '', openedDate: '',
  }
}

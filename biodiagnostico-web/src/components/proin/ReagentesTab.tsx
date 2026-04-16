import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarClock, ChevronDown, ChevronUp, Clock, Package, PackagePlus, Pencil, Search, Thermometer, TrendingDown, X } from 'lucide-react'
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useCreateReagentLot, useCreateStockMovement, useReagentLots, useReagentMovements, useUpdateReagentLot } from '../../hooks/useReagents'
import type { ReagentLot, ReagentLotRequest, ReagentTagSummary, StockMovement, StockMovementRequest } from '../../types'
import { Button, Card, EmptyState, Input, Modal, Select, StatusBadge, useToast } from '../ui'
import { cn } from '../../utils/cn'
import { reagentService } from '../../services/reagentService'
import { reportService } from '../../services/reportService'
import { VoiceRecorderModal } from './VoiceRecorderModal'

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
  const [movementForm, setMovementForm] = useState<StockMovementRequest>({ type: 'ENTRADA', quantity: 0, responsible: '', notes: '' })
  const [dashFilter, setDashFilter] = useState<string | null>(null)
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
    const now = new Date()
    const in7d = new Date(now); in7d.setDate(in7d.getDate() + 7)
    const in30d = new Date(now); in30d.setDate(in30d.getDate() + 30)
    return {
      total: lots.length,
      expiring7d: lots.filter((l) => l.daysLeft >= 0 && l.daysLeft <= 7).length,
      expiring30d: lots.filter((l) => l.daysLeft > 7 && l.daysLeft <= 30).length,
      ruptureRisk: lots.filter((l) => l.daysToRupture != null && l.daysToRupture <= 5).length,
      expired: lots.filter((l) => l.daysLeft < 0 || l.status === 'vencido').length,
    }
  }, [lots])

  // Filter lots
  const filtered = useMemo(() => {
    let result = lots
    if (searchTerm) result = result.filter((l) => l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    if (dashFilter === 'expiring7d') result = result.filter((l) => l.daysLeft >= 0 && l.daysLeft <= 7)
    else if (dashFilter === 'expiring30d') result = result.filter((l) => l.daysLeft > 7 && l.daysLeft <= 30)
    else if (dashFilter === 'ruptureRisk') result = result.filter((l) => l.daysToRupture != null && l.daysToRupture <= 5)
    else if (dashFilter === 'expired') result = result.filter((l) => l.daysLeft < 0 || l.status === 'vencido')
    return result
  }, [lots, searchTerm, dashFilter])

  const handleOpenCreate = () => { setEditingLot(null); setLotForm(emptyLotForm()); setIsLotModalOpen(true) }
  const handleOpenEdit = (lot: ReagentLot) => {
    setEditingLot(lot)
    setLotForm({
      name: lot.name, lotNumber: lot.lotNumber, manufacturer: lot.manufacturer ?? '', category: lot.category ?? '',
      expiryDate: lot.expiryDate ?? '', quantityValue: lot.quantityValue, stockUnit: lot.stockUnit,
      currentStock: lot.currentStock, estimatedConsumption: lot.estimatedConsumption,
      storageTemp: lot.storageTemp ?? '', startDate: lot.startDate ?? '', endDate: lot.endDate ?? undefined, alertThresholdDays: lot.alertThresholdDays, status: lot.status,
    })
    setIsLotModalOpen(true)
  }
  const handleSaveLot = async () => {
    if (!lotForm.name || !lotForm.lotNumber) { toast.warning('Preencha nome e lote.'); return }
    try {
      if (editingLot) { await updateLot.mutateAsync({ id: editingLot.id, request: lotForm }); toast.success('Lote atualizado.') }
      else { await createLot.mutateAsync(lotForm); toast.success('Lote cadastrado.') }
      setIsLotModalOpen(false); setEditingLot(null)
    } catch { toast.error('Erro ao salvar lote.') }
  }
  const handleMovement = async () => {
    if (!expandedLot || !movementForm.quantity) { toast.warning('Informe a quantidade.'); return }
    try {
      await createMovement.mutateAsync(movementForm)
      toast.success('Movimentação registrada.')
      setMovementForm({ type: 'ENTRADA', quantity: 0, responsible: '', notes: '' })
      setIsMovementModalOpen(false)
    } catch { toast.error('Erro ao registrar movimentação.') }
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
          <Button variant={viewMode === 'tags' ? 'primary' : 'ghost'} size="sm"
            onClick={() => { setViewMode(v => v === 'tags' ? 'list' : 'tags'); setExpandedTag(null) }}>
            {viewMode === 'tags' ? 'Lista' : 'Etiquetas'}
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

      {/* Dashboard Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <DashCard label="Total" value={stats.total} icon={<Package className="h-5 w-5" />} color="blue" active={dashFilter === null} onClick={() => setDashFilter(null)} />
        <DashCard label="Vencem 7d" value={stats.expiring7d} icon={<AlertTriangle className="h-5 w-5" />} color="red" active={dashFilter === 'expiring7d'} onClick={() => setDashFilter(dashFilter === 'expiring7d' ? null : 'expiring7d')} />
        <DashCard label="Vencem 30d" value={stats.expiring30d} icon={<Clock className="h-5 w-5" />} color="amber" active={dashFilter === 'expiring30d'} onClick={() => setDashFilter(dashFilter === 'expiring30d' ? null : 'expiring30d')} />
        <DashCard label="Risco Ruptura" value={stats.ruptureRisk} icon={<TrendingDown className="h-5 w-5" />} color="red" active={dashFilter === 'ruptureRisk'} onClick={() => setDashFilter(dashFilter === 'ruptureRisk' ? null : 'ruptureRisk')} />
        <DashCard label="Vencidos" value={stats.expired} icon={<X className="h-5 w-5" />} color="neutral" active={dashFilter === 'expired'} onClick={() => setDashFilter(dashFilter === 'expired' ? null : 'expired')} />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Input placeholder="Buscar reagente ou lote..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Todas categorias</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos status</option>
          <option value="ativo">Ativo</option>
          <option value="em_uso">Em uso</option>
          <option value="inativo">Inativo</option>
          <option value="vencido">Vencido</option>
        </Select>
        {dashFilter && <button onClick={() => setDashFilter(null)} className="text-sm text-green-700 underline">Limpar filtro</button>}
      </div>

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
                            {expired ? 'Vencido' : urgent ? `${daysLeft}d restantes` : warning ? `${daysLeft}d` : lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString('pt-BR') : '\u2014'}
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
                          <Button variant="secondary" size="sm" onClick={() => { setExpandedLot(lot); setIsMovementModalOpen(true) }}>Movimentar</Button>
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
                      <span>{lot.manufacturer || 'Sem fabricante'}</span>
                      {lot.storageTemp && <span className="flex items-center gap-1"><Thermometer className="h-3 w-3" />{lot.storageTemp}</span>}
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
                      {expired ? 'Vencido' : urgent ? `${daysLeft}d restantes` : warning ? `${daysLeft}d` : lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString('pt-BR') : '—'}
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
                  <Button variant="secondary" size="sm" onClick={() => { setExpandedLot(lot); setIsMovementModalOpen(true) }}>
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
              <Input label="Fabricante" value={form.manufacturer} onChange={(e) => setForm((c) => ({ ...c, manufacturer: e.target.value }))} placeholder="Ex: Wama, Abon..." />
              {!form.manufacturer?.trim() && (
                <p className="mt-1 text-xs text-amber-600">Fabricante vazio — lote sem rastreabilidade</p>
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
              <Input label="Validade" type="date" value={form.expiryDate} onChange={(e) => setForm((c) => ({ ...c, expiryDate: e.target.value }))} />
              {!form.expiryDate && (
                <p className="mt-1 text-xs text-amber-600">Sem validade — não aparecerá em alertas de vencimento</p>
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
        <Input label="Responsável" value={form.responsible} onChange={(e) => setForm((c) => ({ ...c, responsible: e.target.value }))} />
        <Input label="Observações" value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} />
      </div>
      {movements.length > 0 && (
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <div className="mb-2 flex items-center justify-between text-sm font-medium text-neutral-700">
            <span>Histórico</span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{movements.length}</span>
          </div>
          <div className="max-h-[200px] space-y-1 overflow-y-auto">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  {m.type === 'ENTRADA' ? <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" /> : <ArrowUpRight className="h-3.5 w-3.5 text-red-600" />}
                  <span className={cn('font-semibold', m.type === 'ENTRADA' ? 'text-green-700' : 'text-red-700')}>{m.type === 'ENTRADA' ? '+' : '-'}{m.quantity}</span>
                  {m.responsible && <span className="text-neutral-400">por {m.responsible}</span>}
                </div>
                <span className="text-xs text-neutral-400">{new Date(m.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
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
    storageTemp: '', startDate: new Date().toISOString().slice(0, 10), endDate: undefined, alertThresholdDays: 7, status: 'ativo',
  }
}

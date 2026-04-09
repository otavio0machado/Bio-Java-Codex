import { AlertTriangle, CalendarClock, ChevronDown, ChevronUp, PackagePlus, Pencil } from 'lucide-react'
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useCreateReagentLot, useCreateStockMovement, useReagentLots, useReagentMovements, useUpdateReagentLot } from '../../hooks/useReagents'
import type { ReagentLot, ReagentLotRequest, StockMovementRequest } from '../../types'
import { Button, Card, EmptyState, Input, Modal, Select, StatusBadge, useToast } from '../ui'
import { cn } from '../../utils/cn'
import { reportService } from '../../services/reportService'
import { VoiceRecorderModal } from './VoiceRecorderModal'

export function ReagentesTab() {
  const { toast } = useToast()
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [expandedLot, setExpandedLot] = useState<ReagentLot | null>(null)
  const [isLotModalOpen, setIsLotModalOpen] = useState(false)
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)
  const [editingLot, setEditingLot] = useState<ReagentLot | null>(null)
  const [lotForm, setLotForm] = useState<ReagentLotRequest>({
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
    startDate: new Date().toISOString().slice(0, 10),
    alertThresholdDays: 7,
    status: 'ativo',
  })
  const [movementForm, setMovementForm] = useState<StockMovementRequest>({
    type: 'ENTRADA',
    quantity: 0,
    responsible: '',
    notes: '',
  })

  const { data: lots = [] } = useReagentLots(category || undefined, status || undefined)
  const createLot = useCreateReagentLot()
  const updateLot = useUpdateReagentLot()
  const createMovement = useCreateStockMovement(expandedLot?.id ?? '')
  const { data: movements = [] } = useReagentMovements(expandedLot?.id)

  const categories = useMemo(
    () => Array.from(new Set(lots.map((lot) => lot.category).filter(Boolean))),
    [lots],
  )

  const resetLotForm = () => {
    setLotForm({
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
      startDate: new Date().toISOString().slice(0, 10),
      alertThresholdDays: 7,
      status: 'ativo',
    })
  }

  const handleOpenCreate = () => {
    setEditingLot(null)
    resetLotForm()
    setIsLotModalOpen(true)
  }

  const handleOpenEdit = (lot: ReagentLot) => {
    setEditingLot(lot)
    setLotForm({
      name: lot.name,
      lotNumber: lot.lotNumber,
      manufacturer: lot.manufacturer ?? '',
      category: lot.category ?? '',
      expiryDate: lot.expiryDate ?? '',
      quantityValue: lot.quantityValue,
      stockUnit: lot.stockUnit,
      currentStock: lot.currentStock,
      estimatedConsumption: lot.estimatedConsumption,
      storageTemp: lot.storageTemp ?? '',
      startDate: lot.startDate ?? '',
      alertThresholdDays: lot.alertThresholdDays,
      status: lot.status,
    })
    setIsLotModalOpen(true)
  }

  const handleCloseLotModal = () => {
    setIsLotModalOpen(false)
    setEditingLot(null)
  }

  const handleSaveLot = async () => {
    if (!lotForm.name || !lotForm.lotNumber) {
      toast.warning('Preencha nome e lote para salvar.')
      return
    }
    try {
      if (editingLot) {
        await updateLot.mutateAsync({ id: editingLot.id, request: lotForm })
        toast.success('Lote atualizado com sucesso.')
      } else {
        await createLot.mutateAsync(lotForm)
        toast.success('Lote cadastrado com sucesso.')
      }
      handleCloseLotModal()
    } catch {
      toast.error(editingLot ? 'Não foi possível atualizar o lote.' : 'Não foi possível cadastrar o lote.')
    }
  }

  const handleCreateMovement = async () => {
    if (!expandedLot || !movementForm.quantity) {
      toast.warning('Informe a quantidade da movimentação.')
      return
    }
    try {
      await createMovement.mutateAsync(movementForm)
      toast.success('Movimentação registrada.')
      setMovementForm({ type: 'ENTRADA', quantity: 0, responsible: '', notes: '' })
      setIsMovementModalOpen(false)
    } catch {
      toast.error('Não foi possível registrar a movimentação.')
    }
  }

  const handleDownloadPdf = async () => {
    try {
      const blob = await reportService.getReagentsPdf()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'reagents-report.pdf'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Não foi possível gerar o PDF de reagentes.')
    }
  }

  if (!lots.length) {
    return (
      <>
        <EmptyState
          icon={<PackagePlus className="h-8 w-8" />}
          title="Nenhum lote encontrado"
          description="Cadastre o primeiro lote para acompanhar validade, consumo e movimentações."
          action={{ label: 'Novo Lote', onClick: handleOpenCreate }}
        />
        <LotModal
          form={lotForm}
          isOpen={isLotModalOpen}
          isEditing={Boolean(editingLot)}
          isSaving={editingLot ? updateLot.isPending : createLot.isPending}
          onClose={handleCloseLotModal}
          onSave={handleSaveLot}
          setForm={setLotForm}
        />
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Categoria" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Todas</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            <option value="ativo">Ativo</option>
            <option value="em_uso">Em uso</option>
            <option value="inativo">Inativo</option>
            <option value="vencido">Vencido</option>
          </Select>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => void handleDownloadPdf()}>
            Gerar PDF
          </Button>
          <Button onClick={handleOpenCreate} icon={<PackagePlus className="h-4 w-4" />}>
            Novo Lote
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {lots.map((lot) => (
          <Card key={lot.id} className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-neutral-900">{lot.name}</h3>
                  <StatusBadge status={lot.status} />
                  {lot.nearExpiry && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      <AlertTriangle className="h-3 w-3" />
                      Validade proxima
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-neutral-500">
                  Lote {lot.lotNumber} · {lot.manufacturer || 'Fabricante não informado'}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-400">Validade</div>
                  <div className={cn(
                    'mt-1 text-sm font-medium',
                    lot.daysLeft < 7 ? 'text-red-600' : lot.daysLeft <= 30 ? 'text-amber-600' : 'text-green-700',
                  )}>
                    {lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString('pt-BR') : 'Sem data'}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-400">Estoque</div>
                  <div className="mt-1 text-sm font-medium text-neutral-900">
                    {(lot.currentStock ?? 0).toFixed(1)} {lot.stockUnit}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-400">Dias restantes</div>
                  <div className="mt-1 text-sm font-medium text-neutral-900">
                    {lot.daysLeft >= 0 ? `${lot.daysLeft} dias` : 'Indefinido'}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm text-neutral-500">
                <span>Nível de estoque</span>
                <span>{(lot.stockPct ?? 0).toFixed(0)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-green-700" style={{ width: `${Math.min(lot.stockPct, 100)}%` }} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => setExpandedLot((current) => (current?.id === lot.id ? null : lot))}
                icon={expandedLot?.id === lot.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              >
                {expandedLot?.id === lot.id ? 'Ocultar movimentações' : 'Ver movimentações'}
              </Button>
              <Button variant="ghost" onClick={() => {
                setExpandedLot(lot)
                setIsMovementModalOpen(true)
              }}>
                Nova Movimentação
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleOpenEdit(lot)}
                icon={<Pencil className="h-4 w-4" />}
              >
                Editar
              </Button>
            </div>

            {expandedLot?.id === lot.id ? (
              <div className="space-y-3 rounded-2xl bg-neutral-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                  <CalendarClock className="h-4 w-4" />
                  Histórico de movimentações
                </div>
                {movements.length ? movements.map((movement) => (
                  <div key={movement.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium text-neutral-900">{movement.type}</div>
                      <div className="text-neutral-500">{movement.responsible || 'Sem responsável'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-neutral-900">{movement.quantity}</div>
                      <div className="text-neutral-500">{new Date(movement.createdAt).toLocaleDateString('pt-BR')}</div>
                    </div>
                  </div>
                )) : <div className="text-sm text-neutral-500">Ainda não há movimentações para este lote.</div>}
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      <LotModal
        form={lotForm}
        isOpen={isLotModalOpen}
        isEditing={Boolean(editingLot)}
        isSaving={editingLot ? updateLot.isPending : createLot.isPending}
        onClose={handleCloseLotModal}
        onSave={handleSaveLot}
        setForm={setLotForm}
      />

      <MovementModal
        form={movementForm}
        isOpen={isMovementModalOpen}
        isSaving={createMovement.isPending}
        lot={expandedLot}
        onClose={() => {
          setIsMovementModalOpen(false)
          setMovementForm({ type: 'ENTRADA', quantity: 0, responsible: '', notes: '' })
        }}
        onSave={handleCreateMovement}
        setForm={setMovementForm}
      />
    </div>
  )
}

interface LotModalProps {
  form: ReagentLotRequest
  isOpen: boolean
  isEditing: boolean
  isSaving: boolean
  onClose: () => void
  onSave: () => void
  setForm: Dispatch<SetStateAction<ReagentLotRequest>>
}

function LotModal({ form, isOpen, isEditing, isSaving, onClose, onSave, setForm }: LotModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar lote' : 'Novo lote'}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSave} loading={isSaving}>{isEditing ? 'Atualizar lote' : 'Salvar lote'}</Button>
        </div>
      }
    >
      <div className="mb-4 flex justify-end">
        <VoiceRecorderModal
          formType="reagente"
          title="Preencher reagente por voz"
          onApply={(data) =>
            setForm((current) => ({
              ...current,
              name: typeof data.name === 'string' ? data.name : current.name,
              lotNumber: typeof data.lot_number === 'string' ? data.lot_number : current.lotNumber,
              expiryDate: typeof data.expiry_date === 'string' ? data.expiry_date : current.expiryDate,
              quantityValue: typeof data.initial_stock === 'number' ? data.initial_stock : current.quantityValue,
              currentStock: typeof data.initial_stock === 'number' ? data.initial_stock : current.currentStock,
              estimatedConsumption: typeof data.daily_consumption === 'number' ? data.daily_consumption : current.estimatedConsumption,
              manufacturer: typeof data.manufacturer === 'string' ? data.manufacturer : current.manufacturer,
            }))
          }
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Nome" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        <Input label="Número do lote" value={form.lotNumber} onChange={(event) => setForm((current) => ({ ...current, lotNumber: event.target.value }))} />
        <Input label="Fabricante" value={form.manufacturer} onChange={(event) => setForm((current) => ({ ...current, manufacturer: event.target.value }))} />
        <Input label="Categoria" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
        <Input label="Validade" type="date" value={form.expiryDate} onChange={(event) => setForm((current) => ({ ...current, expiryDate: event.target.value }))} />
        <Input label="Quantidade total" type="number" value={String(form.quantityValue ?? 0)} onChange={(event) => setForm((current) => ({ ...current, quantityValue: Number(event.target.value) }))} />
        <Input label="Estoque atual" type="number" value={String(form.currentStock ?? 0)} onChange={(event) => setForm((current) => ({ ...current, currentStock: Number(event.target.value) }))} />
        <Input label="Consumo estimado/dia" type="number" value={String(form.estimatedConsumption ?? 0)} onChange={(event) => setForm((current) => ({ ...current, estimatedConsumption: Number(event.target.value) }))} />
      </div>
    </Modal>
  )
}

interface MovementModalProps {
  form: StockMovementRequest
  isOpen: boolean
  isSaving: boolean
  lot: ReagentLot | null
  onClose: () => void
  onSave: () => void
  setForm: Dispatch<SetStateAction<StockMovementRequest>>
}

function MovementModal({ form, isOpen, isSaving, lot, onClose, onSave, setForm }: MovementModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Movimentação${lot ? ` · ${lot.name}` : ''}`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSave} loading={isSaving}>Salvar movimentação</Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Select label="Tipo" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as StockMovementRequest['type'] }))}>
          <option value="ENTRADA">Entrada</option>
          <option value="SAIDA">Saída</option>
          <option value="AJUSTE">Ajuste</option>
        </Select>
        <Input label="Quantidade" type="number" value={String(form.quantity)} onChange={(event) => setForm((current) => ({ ...current, quantity: Number(event.target.value) }))} />
        <Input label="Responsável" value={form.responsible} onChange={(event) => setForm((current) => ({ ...current, responsible: event.target.value }))} />
        <Input label="Observações" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
      </div>
    </Modal>
  )
}

import { PackagePlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  useCreateReagentLot,
  useCreateStockMovement,
  useReagentLots,
  useReagentMovements,
  useUpdateReagentLot,
} from '../../hooks/useReagents'
import { useAuth } from '../../hooks/useAuth'
import { reagentService } from '../../services/reagentService'
import { reportService } from '../../services/reportService'
import type { ReagentLot, ReagentLotRequest, ReagentTagSummary, StockMovementRequest } from '../../types'
import { Button, useToast } from '../ui'
import { VoiceRecorderModal } from './VoiceRecorderModal'
import { ReagentLotModal, ReagentMovementModal } from './reagentes/ReagentModals'
import { ReagentsContent } from './reagentes/ReagentsContent'
import { ReagentsDashboard } from './reagentes/ReagentsDashboard'
import { ReagentsFilters } from './reagentes/ReagentsFilters'
import { validateLotForm, validateMovementForm } from './reagentes/schemas'
import {
  buildManufacturerOptions,
  buildReagentStats,
  createEmptyLotForm,
  createMovementForm,
  filterReagentLots,
  getResponsibleName,
  type ReagentSortMode,
  type ReagentViewMode,
} from './reagentes/utils'

export function ReagentesTab() {
  const { toast } = useToast()
  const { user } = useAuth()
  const responsibleName = getResponsibleName(user)

  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedLot, setExpandedLot] = useState<ReagentLot | null>(null)
  const [isLotModalOpen, setIsLotModalOpen] = useState(false)
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)
  const [editingLot, setEditingLot] = useState<ReagentLot | null>(null)
  const [lotForm, setLotForm] = useState<ReagentLotRequest>(createEmptyLotForm())
  const [movementForm, setMovementForm] = useState<StockMovementRequest>(createMovementForm())
  const [dashFilter, setDashFilter] = useState<
    | 'expiring7d'
    | 'expiring30d'
    | 'ruptureRisk'
    | 'expired'
    | 'noTraceability'
    | 'noValidity'
    | 'lowStock'
    | null
  >(null)
  const [manufacturerFilter, setManufacturerFilter] = useState('')
  const [tempFilter, setTempFilter] = useState('')
  const [alertsOnly, setAlertsOnly] = useState(false)
  const [sortMode, setSortMode] = useState<ReagentSortMode>('urgency')
  const [viewMode, setViewMode] = useState<ReagentViewMode>('list')
  const [tags, setTags] = useState<ReagentTagSummary[]>([])
  const [expandedTag, setExpandedTag] = useState<string | null>(null)
  const [tagStatusTab, setTagStatusTab] = useState('todos')

  const { data: lots = [] } = useReagentLots(category || undefined, status || undefined)
  const createLot = useCreateReagentLot()
  const updateLot = useUpdateReagentLot()
  const createMovement = useCreateStockMovement(expandedLot?.id ?? '')
  const { data: movements = [] } = useReagentMovements(expandedLot?.id)

  useEffect(() => {
    if (viewMode !== 'tags') return

    reagentService
      .getTagSummaries()
      .then(setTags)
      .catch(() => {})
  }, [viewMode, lots])

  const stats = useMemo(() => buildReagentStats(lots), [lots])
  const manufacturerOptions = useMemo(() => buildManufacturerOptions(lots), [lots])
  const filteredLots = useMemo(
    () =>
      filterReagentLots(lots, {
        searchTerm,
        manufacturerFilter,
        tempFilter,
        alertsOnly,
        dashFilter,
        sortMode,
      }),
    [lots, searchTerm, manufacturerFilter, tempFilter, alertsOnly, dashFilter, sortMode],
  )
  const hasActiveFilters = Boolean(dashFilter || manufacturerFilter || tempFilter || alertsOnly)

  const resetLotModal = () => {
    setIsLotModalOpen(false)
    setEditingLot(null)
  }

  const resetMovementModal = () => {
    setIsMovementModalOpen(false)
    setMovementForm(createMovementForm())
  }

  const handleOpenCreate = () => {
    setEditingLot(null)
    setLotForm(createEmptyLotForm())
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
      startDate: lot.startDate ?? undefined,
      endDate: lot.endDate ?? undefined,
      alertThresholdDays: lot.alertThresholdDays,
      status: lot.status,
      location: lot.location ?? '',
      supplier: lot.supplier ?? '',
      receivedDate: lot.receivedDate ?? undefined,
      openedDate: lot.openedDate ?? undefined,
    })
    setIsLotModalOpen(true)
  }

  const handleOpenMovement = (lot: ReagentLot) => {
    setExpandedLot(lot)
    setMovementForm(createMovementForm(responsibleName))
    setIsMovementModalOpen(true)
  }

  const handleSaveLot = async () => {
    const validation = validateLotForm(lotForm)
    if (validation) {
      toast.warning(validation.message)
      return
    }

    try {
      if (editingLot) {
        await updateLot.mutateAsync({ id: editingLot.id, request: lotForm })
        toast.success('Lote atualizado.')
      } else {
        await createLot.mutateAsync(lotForm)
        toast.success('Lote cadastrado.')
      }
      resetLotModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar lote.'
      toast.error(message)
    }
  }

  const handleMovement = async () => {
    if (!expandedLot) return

    const validation = validateMovementForm(movementForm, expandedLot.currentStock ?? 0)
    if (validation) {
      toast.warning(validation.message)
      return
    }

    try {
      await createMovement.mutateAsync(movementForm)
      toast.success('Movimentação registrada.')
      setMovementForm(createMovementForm(responsibleName))
      setIsMovementModalOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao registrar movimentação.'
      toast.error(message)
    }
  }

  const handlePdf = async () => {
    try {
      const blob = await reportService.getReagentsPdf()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'reagentes.pdf'
      link.click()
    } catch {
      toast.error('Erro ao gerar PDF.')
    }
  }

  const handleCsv = async () => {
    try {
      const blob = await reagentService.exportCsv(category || undefined, status || undefined)
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'reagentes.csv'
      link.click()
      URL.revokeObjectURL(link.href)
    } catch {
      toast.error('Erro ao exportar CSV.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-neutral-900">Gestão de Reagentes</h3>
          <p className="text-base text-neutral-500">Controle de lotes, estoque e movimentações</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void handlePdf()}>
            PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void handleCsv()}>
            CSV
          </Button>
          <VoiceRecorderModal
            formType="reagente"
            title="Reagente por voz"
            onApply={(data) => {
              setLotForm((current) => ({
                ...current,
                name: typeof data.name === 'string' ? data.name : current.name,
                lotNumber: typeof data.lot_number === 'string' ? data.lot_number : current.lotNumber,
                expiryDate: typeof data.expiry_date === 'string' ? data.expiry_date : current.expiryDate,
                manufacturer:
                  typeof data.manufacturer === 'string' ? data.manufacturer : current.manufacturer,
              }))
              setIsLotModalOpen(true)
            }}
          />
          <Button onClick={handleOpenCreate} icon={<PackagePlus className="h-4 w-4" />}>
            Novo Lote
          </Button>
        </div>
      </div>

      <ReagentsDashboard
        stats={stats}
        dashFilter={dashFilter}
        onToggleFilter={(nextFilter) => setDashFilter(nextFilter)}
      />

      <ReagentsFilters
        category={category}
        status={status}
        searchTerm={searchTerm}
        manufacturerFilter={manufacturerFilter}
        tempFilter={tempFilter}
        alertsOnly={alertsOnly}
        sortMode={sortMode}
        viewMode={viewMode}
        manufacturerOptions={manufacturerOptions}
        hasActiveFilters={hasActiveFilters}
        onCategoryChange={setCategory}
        onStatusChange={setStatus}
        onSearchChange={setSearchTerm}
        onManufacturerChange={setManufacturerFilter}
        onTempChange={setTempFilter}
        onAlertsOnlyChange={setAlertsOnly}
        onSortModeChange={setSortMode}
        onToggleViewMode={() => {
          setViewMode((current) => (current === 'tags' ? 'list' : 'tags'))
          setExpandedTag(null)
        }}
        onClearFilters={() => {
          setDashFilter(null)
          setManufacturerFilter('')
          setTempFilter('')
          setAlertsOnly(false)
        }}
      />

      <ReagentsContent
        viewMode={viewMode}
        searchTerm={searchTerm}
        tags={tags}
        lots={lots}
        filteredLots={filteredLots}
        expandedTag={expandedTag}
        tagStatusTab={tagStatusTab}
        expandedLot={expandedLot}
        movements={movements}
        onExpandedTagChange={setExpandedTag}
        onTagStatusTabChange={setTagStatusTab}
        onExpandedLotChange={setExpandedLot}
        onOpenMovement={handleOpenMovement}
        onOpenEdit={handleOpenEdit}
        onOpenCreate={handleOpenCreate}
      />

      <ReagentLotModal
        form={lotForm}
        isOpen={isLotModalOpen}
        isEditing={Boolean(editingLot)}
        isSaving={editingLot ? updateLot.isPending : createLot.isPending}
        onClose={resetLotModal}
        onSave={handleSaveLot}
        setForm={setLotForm}
      />
      <ReagentMovementModal
        form={movementForm}
        isOpen={isMovementModalOpen}
        isSaving={createMovement.isPending}
        lot={expandedLot}
        onClose={resetMovementModal}
        onSave={handleMovement}
        setForm={setMovementForm}
        movements={movements}
      />
    </div>
  )
}

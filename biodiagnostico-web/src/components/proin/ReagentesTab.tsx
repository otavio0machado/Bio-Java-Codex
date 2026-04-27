import { PackagePlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  useCreateReagentLot,
  useCreateStockMovement,
  useDeleteReagentLot,
  useReagentLabels,
  useReagentLots,
  useReagentMovements,
  useUpdateReagentLot,
} from '../../hooks/useReagents'
import { useAuth } from '../../hooks/useAuth'
import { reagentService } from '../../services/reagentService'
import { reportService } from '../../services/reportService'
import type {
  ReagentLabelSummary,
  ReagentLot,
  ReagentLotRequest,
  StockMovementRequest,
} from '../../types'
import { Button, useToast } from '../ui'
import { VoiceRecorderModal } from './VoiceRecorderModal'
import { ReagentLotModal, ReagentMovementModal } from './reagentes/ReagentModals'
import { ReagentsContent } from './reagentes/ReagentsContent'
import { ReagentsDashboard } from './reagentes/ReagentsDashboard'
import { ReagentsFilters } from './reagentes/ReagentsFilters'
import { validateLotForm, validateMovementForm } from './reagentes/schemas'
import {
  buildLocationOptions,
  buildManufacturerOptions,
  buildSupplierOptions,
  buildReagentStats,
  canReceiveEntry,
  createEmptyLotForm,
  createMovementForm,
  filterReagentLots,
  getResponsibleName,
  type DashFilter,
  type ReagentSortMode,
  type ReagentViewMode,
} from './reagentes/utils'

/**
 * Aba de Reagentes pos refator v2.
 *
 * Modos de visualizacao: {@code 'tags'} (default — agrupado por etiqueta) e
 * {@code 'list'} (lista plana). O contrato 6.3 fixou {@code 'tags'} como
 * default novo.
 *
 * Botoes operacionais separados: ENTRADA e SAIDA abrem o mesmo modal mas com
 * o tipo pre-selecionado e o select bloqueado, dando affordance imediata sem
 * perder a opcao de AJUSTE.
 */
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
  const [movementLockType, setMovementLockType] = useState(false)
  const [editingLot, setEditingLot] = useState<ReagentLot | null>(null)
  const [lotForm, setLotForm] = useState<ReagentLotRequest>(createEmptyLotForm())
  const [movementForm, setMovementForm] = useState<StockMovementRequest>(createMovementForm())
  const [dashFilter, setDashFilter] = useState<DashFilter | null>(null)
  const [manufacturerFilter, setManufacturerFilter] = useState('')
  const [tempFilter, setTempFilter] = useState('')
  const [alertsOnly, setAlertsOnly] = useState(false)
  const [sortMode, setSortMode] = useState<ReagentSortMode>('urgency')
  const [viewMode, setViewMode] = useState<ReagentViewMode>('tags')
  const [labels, setLabels] = useState<ReagentLabelSummary[]>([])
  const [expandedTag, setExpandedTag] = useState<string | null>(null)
  const [tagStatusTab, setTagStatusTab] = useState('todos')

  const {
    data: lots = [],
    isLoading: isLoadingLots = false,
    isError: hasLotsError = false,
    refetch: refetchLots,
  } = useReagentLots(category || undefined, status || undefined)
  const { data: labelSummaries } = useReagentLabels(true)
  const createLot = useCreateReagentLot()
  const updateLot = useUpdateReagentLot()
  const deleteLot = useDeleteReagentLot()
  const createMovement = useCreateStockMovement(expandedLot?.id ?? '')
  const { data: movements = [] } = useReagentMovements(expandedLot?.id)

  // Mantem snapshot local sincronizado com a query para o conteudo de "tags"
  // continuar consistente mesmo se a query estiver entre ciclos.
  useEffect(() => {
    if (Array.isArray(labelSummaries)) {
      setLabels(labelSummaries)
    }
  }, [labelSummaries])

  const stats = useMemo(() => buildReagentStats(lots), [lots])
  const manufacturerOptions = useMemo(() => buildManufacturerOptions(lots), [lots])
  const locationOptions = useMemo(() => buildLocationOptions(lots), [lots])
  const supplierOptions = useMemo(() => buildSupplierOptions(lots), [lots])
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
    setMovementLockType(false)
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
      label: lot.label,
      lotNumber: lot.lotNumber,
      manufacturer: lot.manufacturer ?? '',
      category: lot.category ?? '',
      currentStock: lot.currentStock ?? 0,
      status: lot.status,
      expiryDate: lot.expiryDate ?? '',
      location: lot.location ?? '',
      storageTemp: lot.storageTemp ?? '',
      supplier: lot.supplier ?? undefined,
      receivedDate: lot.receivedDate ?? undefined,
      openedDate: lot.openedDate ?? undefined,
    })
    setIsLotModalOpen(true)
  }

  const openMovementForLot = (lot: ReagentLot, type: StockMovementRequest['type']) => {
    setExpandedLot(lot)
    setMovementForm(createMovementForm(responsibleName, type))
    setMovementLockType(true)
    setIsMovementModalOpen(true)
  }

  const handleOpenEntry = (lot: ReagentLot) => {
    if (!canReceiveEntry(lot)) {
      toast.warning(lot.movementWarning ?? 'Lote vencido não aceita nova entrada.')
      return
    }
    openMovementForLot(lot, 'ENTRADA')
  }

  const handleOpenExit = (lot: ReagentLot) => {
    if ((lot.currentStock ?? 0) <= 0) {
      toast.warning('Sem estoque para registrar saída.')
      return
    }
    openMovementForLot(lot, 'SAIDA')
  }

  const handleSaveLot = async () => {
    // Bloqueante audit 4.2.1: trim defensivo no submit antes do service tambem trimar.
    const sanitized: ReagentLotRequest = {
      ...lotForm,
      label: lotForm.label?.trim() ?? '',
      lotNumber: lotForm.lotNumber?.trim() ?? '',
      manufacturer: lotForm.manufacturer?.trim() ?? '',
      location: lotForm.location?.trim() ?? '',
      supplier: lotForm.supplier?.trim() || undefined,
    }

    const validation = validateLotForm(sanitized)
    if (validation) {
      toast.warning(validation.message)
      return
    }

    try {
      if (editingLot) {
        await updateLot.mutateAsync({ id: editingLot.id, request: sanitized })
        toast.success('Lote atualizado.')
      } else {
        await createLot.mutateAsync(sanitized)
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

    const validation = validateMovementForm(
      movementForm,
      expandedLot.currentStock ?? 0,
      canReceiveEntry(expandedLot),
    )
    if (validation) {
      toast.warning(validation.message)
      return
    }

    try {
      await createMovement.mutateAsync(movementForm)
      toast.success('Movimentação registrada.')
      resetMovementModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao registrar movimentação.'
      toast.error(message)
    }
  }

  const handleArchiveLot = async (lot: ReagentLot) => {
    const isArchivable = lot.status === 'fora_de_estoque'
    const confirmed = window.confirm(
      isArchivable
        ? `Excluir o lote ${lot.lotNumber}? Esta ação só será concluída se não houver histórico operacional.`
        : `Arquivar o lote ${lot.lotNumber}? Lotes com histórico serão preservados como Fora de estoque.`,
    )
    if (!confirmed) return

    try {
      await deleteLot.mutateAsync(lot.id)
      toast.success(isArchivable ? 'Lote excluído.' : 'Lote arquivado.')
      if (expandedLot?.id === lot.id) {
        setExpandedLot(null)
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Não foi possível ${isArchivable ? 'excluir' : 'arquivar'} o lote.`
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
                // Aceita {@code label} (novo) e {@code name} (legado de prompt antigo)
                // sem auto-criar etiqueta — usuario decide via combobox.
                label:
                  typeof data.label === 'string'
                    ? data.label
                    : typeof data.name === 'string'
                      ? data.name
                      : current.label,
                lotNumber:
                  typeof data.lot_number === 'string' ? data.lot_number : current.lotNumber,
                expiryDate:
                  typeof data.expiry_date === 'string' ? data.expiry_date : current.expiryDate,
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
        isLoading={isLoadingLots}
        isError={hasLotsError}
        searchTerm={searchTerm}
        labels={labels}
        lots={lots}
        filteredLots={filteredLots}
        expandedTag={expandedTag}
        tagStatusTab={tagStatusTab}
        expandedLot={expandedLot}
        movements={movements}
        onExpandedTagChange={setExpandedTag}
        onTagStatusTabChange={setTagStatusTab}
        onExpandedLotChange={setExpandedLot}
        onOpenEntry={handleOpenEntry}
        onOpenExit={handleOpenExit}
        onOpenEdit={handleOpenEdit}
        onArchiveLot={(lot) => void handleArchiveLot(lot)}
        onOpenCreate={handleOpenCreate}
        onRetry={() => void refetchLots?.()}
      />

      <ReagentLotModal
        form={lotForm}
        isOpen={isLotModalOpen}
        isEditing={Boolean(editingLot)}
        isSaving={editingLot ? updateLot.isPending : createLot.isPending}
        labels={labels}
        manufacturerOptions={manufacturerOptions}
        locationOptions={locationOptions}
        supplierOptions={supplierOptions}
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
        lockType={movementLockType}
      />
    </div>
  )
}

import axios from 'axios'
import { AlertTriangle, CheckCircle2, Download, Edit3, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react'
import type { Dispatch, Ref, SetStateAction } from 'react'
import { useMemo, useRef, useState } from 'react'
import {
  useCreateImmunologyControlSet,
  useCreateImmunologyRun,
  useDeactivateImmunologyControlSet,
  useDeleteImmunologyRun,
  useImmunologyControlSets,
  useImmunologyRuns,
  useUpdateImmunologyControlSet,
} from '../../hooks/useImmunology'
import { useReagentLots } from '../../hooks/useReagents'
import { useAuth } from '../../hooks/useAuth'
import { canDownload, canWriteQc } from '../../lib/permissions'
import { reportService } from '../../services/reportService'
import type { ImmunologyControlSet, ImmunologyControlSetRequest, ImmunologyResult, ImmunologyRun, ReagentLot } from '../../types'
import { diffInDays, formatLongBR, todayLocal } from '../../utils/date'
import { Button, Card, EmptyState, Input, Modal, Select, StatusBadge, useToast } from '../ui'

const RESULT_OPTIONS: Array<{ value: ImmunologyResult; label: string }> = [
  { value: 'REAGENTE', label: 'Reagente' },
  { value: 'NAO_REAGENTE', label: 'Não reagente' },
]

const PANEL_CLASS =
  'overflow-hidden border border-neutral-200/80 bg-white shadow-[0_18px_45px_rgba(23,23,23,0.06)] ring-1 ring-white/70'

const FORM_TONE =
  '[&_label>span]:text-sm [&_label>span]:font-semibold [&_label>span]:text-neutral-700 [&_label>div]:min-h-12 [&_label>div]:rounded-xl [&_label>div]:border-neutral-200 [&_label>div]:bg-neutral-50/80 [&_label>div]:shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] [&_input]:font-medium [&_select]:font-medium'

const PRIMARY_ACTION_CLASS =
  'h-11 rounded-xl bg-green-800 text-base shadow-[0_10px_24px_rgba(22,101,52,0.18)] hover:bg-green-900'

function createControlForm(): ImmunologyControlSetRequest {
  return {
    analito: '',
    manufacturer: '',
    lotNumber: '',
    validUntil: '',
    controls: [{ name: 'Controle 1', expectedResult: 'REAGENTE' }],
  }
}

const emptyHistoryFilters = {
  analito: '',
  lotNumber: '',
  status: '',
  startDate: '',
  endDate: '',
}

function createAnalysisForm() {
  return {
    dataMedicao: todayLocal(),
    controlSetId: '',
  }
}

export function ImunologiaArea() {
  const { toast } = useToast()
  const { user } = useAuth()
  const canManageQc = canWriteQc(user)
  const canExportPdf = canDownload(user)
  const [analysisForm, setAnalysisForm] = useState(createAnalysisForm())
  const [analysisResults, setAnalysisResults] = useState<Record<string, string>>({})
  const [controlForm, setControlForm] = useState<ImmunologyControlSetRequest>(createControlForm)
  const [selectedReagentLotId, setSelectedReagentLotId] = useState('')
  const [historyFilters, setHistoryFilters] = useState(emptyHistoryFilters)
  const [editingControlSetId, setEditingControlSetId] = useState<string | null>(null)
  const [deactivationTarget, setDeactivationTarget] = useState<ImmunologyControlSet | null>(null)
  const [deletingRun, setDeletingRun] = useState<ImmunologyRun | null>(null)
  const [lastSavedRun, setLastSavedRun] = useState<ImmunologyRun | null>(null)
  const firstResultSelectRef = useRef<HTMLSelectElement>(null)

  const runFilters = useMemo(
    () => ({
      analito: historyFilters.analito.trim() || undefined,
      startDate: historyFilters.startDate || undefined,
      endDate: historyFilters.endDate || undefined,
    }),
    [historyFilters.analito, historyFilters.endDate, historyFilters.startDate],
  )

  const { data: controlSets = [] } = useImmunologyControlSets({ includeInactive: true })
  const { data: runs = [] } = useImmunologyRuns(runFilters)
  const { data: reagentLots = [] } = useReagentLots('Imunologia')
  const createControlSet = useCreateImmunologyControlSet()
  const updateControlSet = useUpdateImmunologyControlSet()
  const deactivateControlSet = useDeactivateImmunologyControlSet()
  const createRun = useCreateImmunologyRun()
  const deleteRun = useDeleteImmunologyRun()

  const immunologyReagentLots = useMemo(() => reagentLots, [reagentLots])
  const activeControlSets = useMemo(() => controlSets.filter((controlSet) => controlSet.isActive), [controlSets])
  const selectedReagentLot = useMemo(
    () => immunologyReagentLots.find((lot) => lot.id === selectedReagentLotId) ?? null,
    [immunologyReagentLots, selectedReagentLotId],
  )
  const compatibleControlSets = useMemo(() => {
    if (!selectedReagentLot) return []
    return activeControlSets.filter((controlSet) => normalizeKey(controlSet.analito) === normalizeKey(selectedReagentLot.label))
  }, [activeControlSets, selectedReagentLot])
  const controlStats = useMemo(() => buildControlStats(controlSets), [controlSets])
  const filteredRuns = useMemo(() => filterRuns(runs, historyFilters), [historyFilters, runs])
  const selectedControlSet = useMemo(
    () => controlSets.find((controlSet) => controlSet.id === analysisForm.controlSetId) ?? null,
    [analysisForm.controlSetId, controlSets],
  )
  const selectedControls = selectedControlSet ? fixedControls(selectedControlSet) : []
  const analysisPreview = useMemo(
    () => buildAnalysisPreview(selectedControls, analysisResults),
    [analysisResults, selectedControls],
  )

  const saveControlSet = async () => {
    if (!canManageQc) {
      toast.warning('Seu perfil não pode cadastrar ou editar controles de CQ.')
      return
    }
    if (!controlForm.analito || !controlForm.manufacturer || !controlForm.lotNumber || !controlForm.validUntil) {
      toast.warning('Preencha analito, marca, lote e validade.')
      return
    }
    if (!controlForm.controls.length || controlForm.controls.some((control) => !control.name.trim())) {
      toast.warning('Cadastre ao menos um controle com nome.')
      return
    }
    if (findDuplicateControlSet(controlSets, controlForm, editingControlSetId)) {
      toast.warning('Já existe controle ativo para este analito, marca e lote.')
      return
    }

    try {
      const request = {
        ...controlForm,
        analito: controlForm.analito.trim().toUpperCase(),
        manufacturer: controlForm.manufacturer.trim(),
        lotNumber: controlForm.lotNumber.trim(),
        controls: controlForm.controls.map((control, index) => ({
          name: control.name.trim() || `Controle ${index + 1}`,
          expectedResult: control.expectedResult,
        })),
      }
      if (editingControlSetId) {
        await updateControlSet.mutateAsync({ id: editingControlSetId, request })
        toast.success('Controle atualizado.')
      } else {
        await createControlSet.mutateAsync(request)
        toast.success('Controle cadastrado.')
      }
      resetControlForm()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível salvar o controle.'))
    }
  }

  const saveAnalysis = async () => {
    if (!canManageQc) {
      toast.warning('Seu perfil não pode lançar análise de CQ.')
      return
    }
    if (!selectedReagentLot) {
      toast.warning('Selecione um reagente de Imunologia antes de lançar a análise.')
      return
    }
    const reagentValidity = getReagentValidityState(selectedReagentLot, analysisForm.dataMedicao)
    if (reagentValidity?.severity === 'danger') {
      toast.warning(reagentValidity.message)
      return
    }
    if (!selectedControlSet || !selectedControls.length) {
      toast.warning('Selecione um soro-controle compatível com o reagente.')
      return
    }
    if (normalizeKey(selectedControlSet.analito) !== normalizeKey(selectedReagentLot.label)) {
      toast.warning('O soro-controle selecionado não pertence ao analito do reagente.')
      return
    }
    if (isControlExpiredForDate(selectedControlSet, analysisForm.dataMedicao)) {
      toast.warning('Controle vencido na data da análise. Use outro lote de controle.')
      return
    }
    if (selectedControls.some((control) => !analysisResults[control.id])) {
      toast.warning('Informe o resultado de todos os controles cadastrados.')
      return
    }

    try {
      const response = await createRun.mutateAsync({
        dataMedicao: analysisForm.dataMedicao,
        reagentLotId: selectedReagentLot.id,
        controlSetId: selectedControlSet.id,
        analyst: undefined,
        notes: undefined,
        results: selectedControls.map((control) => ({
          controlItemId: control.id,
          observedResult: analysisResults[control.id],
        })),
      })
      toast[response.status === 'APROVADO' ? 'success' : 'warning'](`Análise registrada: ${response.status}.`)
      setLastSavedRun(response)
      setAnalysisForm(createAnalysisForm())
      setSelectedReagentLotId('')
      setAnalysisResults({})
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível registrar a análise.'))
    }
  }

  const selectReagentLotForAnalysis = (lotId: string) => {
    setSelectedReagentLotId(lotId)
    setAnalysisForm((current) => ({ ...current, controlSetId: '' }))
    setAnalysisResults({})
    setLastSavedRun(null)
  }

  const selectControlSet = (controlSetId: string) => {
    if (!controlSetId) {
      setAnalysisForm((current) => ({ ...current, controlSetId: '' }))
      setAnalysisResults({})
      return
    }
    if (!selectedReagentLot) {
      toast.warning('Selecione um reagente antes do soro-controle.')
      return
    }
    const controlSet = compatibleControlSets.find((item) => item.id === controlSetId)
    if (!controlSet) {
      toast.warning('Selecione um soro-controle compatível com o analito do reagente.')
      return
    }
    if (!controlSet.isActive) {
      toast.warning('Controle inativo não pode ser usado em nova análise.')
      return
    }
    setAnalysisForm({
      dataMedicao: analysisForm.dataMedicao,
      controlSetId: controlSet.id,
    })
    setAnalysisResults({})
    window.setTimeout(() => firstResultSelectRef.current?.focus(), 0)
  }

  const editControlSet = (controlSet: ImmunologyControlSet) => {
    if (!canManageQc) {
      toast.warning('Seu perfil não pode editar controles de CQ.')
      return
    }
    if (!controlSet.isActive) {
      toast.warning('Controle inativo não pode ser editado.')
      return
    }
    const controls = fixedControls(controlSet)
    setEditingControlSetId(controlSet.id)
    setControlForm({
      analito: controlSet.analito,
      manufacturer: controlSet.manufacturer,
      lotNumber: controlSet.lotNumber,
      validUntil: controlSet.validUntil,
      controls: controls.map((control) => ({
        name: control.name,
        expectedResult: control.expectedResult,
      })),
    })
  }

  const resetAnalysisForm = () => {
    setAnalysisForm(createAnalysisForm())
    setSelectedReagentLotId('')
    setAnalysisResults({})
    setLastSavedRun(null)
  }

  const resetControlForm = () => {
    setEditingControlSetId(null)
    setControlForm(createControlForm())
  }

  const addExpectedControl = () => {
    setControlForm((current) => ({
      ...current,
      controls: [
        ...current.controls,
        {
          name: `Controle ${current.controls.length + 1}`,
          expectedResult: current.controls.length === 1 ? 'NAO_REAGENTE' : 'REAGENTE',
        },
      ],
    }))
  }

  const removeExpectedControl = (index: number) => {
    setControlForm((current) => {
      if (current.controls.length === 1) return current
      return {
        ...current,
        controls: current.controls
          .filter((_, controlIndex) => controlIndex !== index)
          .map((control, controlIndex) => ({
            ...control,
            name: control.name.trim() ? control.name : `Controle ${controlIndex + 1}`,
          })),
      }
    })
  }

  const confirmDeactivateControlSet = async () => {
    if (!deactivationTarget) return
    try {
      await deactivateControlSet.mutateAsync(deactivationTarget.id)
      toast.success('Controle inativado.')
      if (analysisForm.controlSetId === deactivationTarget.id) {
        setAnalysisForm(createAnalysisForm())
        setAnalysisResults({})
      }
      setDeactivationTarget(null)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível inativar o controle.'))
    }
  }

  const confirmDeleteRun = async () => {
    if (!deletingRun) return
    try {
      await deleteRun.mutateAsync(deletingRun.id)
      toast.success('Análise removida do histórico.')
      if (lastSavedRun?.id === deletingRun.id) {
        setLastSavedRun(null)
      }
      setDeletingRun(null)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível remover a análise.'))
    }
  }

  const downloadPdf = async () => {
    if (!canExportPdf) {
      toast.warning('Seu perfil não tem permissão para gerar PDF.')
      return
    }
    try {
      const today = new Date()
      const blob = await reportService.getQcPdf({
        area: 'imunologia',
        periodType: 'current-month',
        month: String(today.getMonth() + 1),
        year: String(today.getFullYear()),
      })
      downloadBlob(blob, 'imunologia-qc-report.pdf')
    } catch {
      toast.error('Não foi possível gerar o PDF.')
    }
  }

  return (
    <div className="w-full space-y-6">
      <Card className={`space-y-6 ${PANEL_CLASS}`}>
        <div className="flex flex-col gap-3 border-b border-neutral-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-center text-2xl font-bold uppercase tracking-[0.08em] text-neutral-950 sm:text-left">
              Controle de Qualidade
            </h2>
            {!canManageQc ? (
              <p className="mt-2 text-sm font-medium text-amber-700">Modo leitura: sem permissão para lançar ou alterar CQ.</p>
            ) : null}
          </div>
          <Button
            className="h-11 rounded-xl border-neutral-200 bg-white px-4 text-base shadow-sm hover:border-neutral-300 hover:bg-neutral-50"
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={() => void downloadPdf()}
            disabled={!canExportPdf}
          >
            Gerar PDF
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className={`space-y-4 ${FORM_TONE}`}>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-800">1. Selecionar reagente</div>
              <div className="mt-1 text-sm font-medium text-neutral-500">Escolha o reagente de Imunologia usado na análise.</div>
            </div>

            <Select
              label="Reagente de Imunologia *"
              value={selectedReagentLotId}
              onChange={(event) => selectReagentLotForAnalysis(event.target.value)}
            >
              <option value="">Selecione um reagente cadastrado</option>
              {immunologyReagentLots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.label} · {lot.manufacturer} · lote {lot.lotNumber} · validade {formatLongBR(lot.expiryDate)} · {reagentStatusLabel(lot.status)}
                </option>
              ))}
            </Select>

            {selectedReagentLot ? (
              <ReagentLotSummary lot={selectedReagentLot} dataMedicao={analysisForm.dataMedicao} />
            ) : (
              <div className="rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-5 text-sm font-medium text-neutral-500">
                Selecione um reagente para carregar os dados do lote e liberar soro-controles compatíveis.
              </div>
            )}

            {!immunologyReagentLots.length ? (
              <div className={statusBoxClass('warning')}>
                Cadastre um reagente de Imunologia na aba Reagentes antes de lançar análise.
              </div>
            ) : null}
          </section>

          <section className={`space-y-4 border-t border-neutral-100 pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0 ${FORM_TONE}`}>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-800">2. Dados/Resultados</div>
              <div className="mt-1 text-sm font-medium text-neutral-500">Selecione o soro-controle e informe o observado.</div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Input
                label="Data *"
                type="date"
                value={analysisForm.dataMedicao}
                onChange={(event) => setAnalysisForm((current) => ({ ...current, dataMedicao: event.target.value }))}
              />
              <Select
                label="Soro-controle *"
                value={analysisForm.controlSetId}
                onChange={(event) => selectControlSet(event.target.value)}
                disabled={!selectedReagentLot}
              >
                <option value="">
                  {selectedReagentLot ? 'Selecione o soro-controle' : 'Selecione o reagente primeiro'}
                </option>
                {compatibleControlSets.map((controlSet) => (
                  <option key={controlSet.id} value={controlSet.id}>
                    {controlSet.analito} · {controlSet.manufacturer} · lote {controlSet.lotNumber}
                  </option>
                ))}
              </Select>
            </div>

            {selectedReagentLot && !compatibleControlSets.length ? (
              <div className={statusBoxClass('warning')}>
                Não há soro-controle ativo para o analito {selectedReagentLot.label}.
              </div>
            ) : null}

            {selectedControlSet ? (
              <ControlSetSummary controlSet={selectedControlSet} dataMedicao={analysisForm.dataMedicao} />
            ) : (
              <div className="rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-5 text-sm font-medium text-neutral-500">
                Selecione um soro-controle compatível para visualizar os resultados esperados.
              </div>
            )}

            {selectedControls.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {selectedControls.map((control, index) => (
                  <AnalysisControlRow
                    key={control.id}
                    label={control.name}
                    observedResult={analysisResults[control.id] ?? ''}
                    preview={analysisPreview.items[index]}
                    onChange={(value) => setAnalysisResults((current) => ({ ...current, [control.id]: value }))}
                    selectRef={index === 0 ? firstResultSelectRef : undefined}
                  />
                ))}
              </div>
            ) : null}

            {analysisPreview.status !== 'PENDENTE' ? (
              <div className={analysisPreview.status === 'APROVADO' ? statusBoxClass('success') : statusBoxClass('danger')}>
                Prévia: <strong>{analysisPreview.status}</strong>
                {analysisPreview.failedControls.length ? ` · Divergente: ${analysisPreview.failedControls.join(', ')}` : ''}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                className={`flex-1 ${PRIMARY_ACTION_CLASS}`}
                icon={<Save className="h-4 w-4" />}
                onClick={() => void saveAnalysis()}
                loading={createRun.isPending}
                disabled={!canManageQc || !selectedReagentLot || !selectedControlSet}
              >
                Salvar análise
              </Button>
              <Button className="sm:w-44" variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={resetAnalysisForm}>
                Limpar
              </Button>
            </div>
          </section>
        </div>

        {lastSavedRun ? (
          <div className={lastSavedRun.status === 'APROVADO' ? statusBoxClass('success') : statusBoxClass('danger')}>
            Última análise: reagente {lastSavedRun.reagentLabel || 'não vinculado'} · soro {lastSavedRun.analito} lote {lastSavedRun.lotNumber} · {formatLongBR(lastSavedRun.dataMedicao)} · <strong>{lastSavedRun.status}</strong>
          </div>
        ) : null}
      </Card>

      <Card className={`space-y-5 ${PANEL_CLASS}`}>
        <div className="flex flex-col gap-3 border-b border-neutral-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-bold text-neutral-950">Cadastro de soro-controles</h3>
          {editingControlSetId ? (
            <Button variant="ghost" icon={<X className="h-4 w-4" />} onClick={resetControlForm}>
              Cancelar edição
            </Button>
          ) : null}
        </div>

        <div className={`grid gap-4 md:grid-cols-4 ${FORM_TONE}`}>
          <Input
            label="Analito *"
            value={controlForm.analito}
            onChange={(event) => setControlForm((current) => ({ ...current, analito: event.target.value.toUpperCase() }))}
          />
          <Input
            label="Marca *"
            value={controlForm.manufacturer}
            onChange={(event) => setControlForm((current) => ({ ...current, manufacturer: event.target.value }))}
          />
          <Input
            label="Lote *"
            value={controlForm.lotNumber}
            onChange={(event) => setControlForm((current) => ({ ...current, lotNumber: event.target.value }))}
          />
          <Input
            label="Validade *"
            type="date"
            value={controlForm.validUntil}
            onChange={(event) => setControlForm((current) => ({ ...current, validUntil: event.target.value }))}
          />
        </div>

        {findDuplicateControlSet(controlSets, controlForm, editingControlSetId) ? (
          <div className={statusBoxClass('warning')}>Já existe controle ativo para este analito, marca e lote.</div>
        ) : null}

        <div className={`space-y-4 border-y border-neutral-100 py-4 ${FORM_TONE}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-lg font-semibold text-neutral-950">Controles esperados</h4>
              <p className="text-sm font-medium text-neutral-500">Adicione exatamente os controles esperados do soro-controle.</p>
            </div>
            <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={addExpectedControl}>
              Adicionar controle
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {controlForm.controls.map((control, index) => (
              <div key={`${control.name}-${index}`} className="grid gap-3 border-b border-neutral-100 pb-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-end md:border-b-0 md:pb-0">
                <Input
                  label={`Controle ${index + 1}`}
                  value={control.name}
                  onChange={(event) => updateExpectedControl(index, { name: event.target.value }, setControlForm)}
                />
                <Select
                  label="Esperado"
                  value={control.expectedResult}
                  onChange={(event) => updateExpectedControl(index, { expectedResult: event.target.value }, setControlForm)}
                >
                  {RESULT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
                <Button
                  variant="ghost"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => removeExpectedControl(index)}
                  disabled={controlForm.controls.length === 1}
                  aria-label={`Remover controle ${index + 1}`}
                >
                  Remover
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            className={`flex-1 ${PRIMARY_ACTION_CLASS}`}
            icon={<Save className="h-4 w-4" />}
            onClick={() => void saveControlSet()}
            loading={createControlSet.isPending || updateControlSet.isPending}
            disabled={!canManageQc}
          >
            {editingControlSetId ? 'Atualizar controle' : 'Salvar controle'}
          </Button>
          <Button className="sm:w-44" variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={resetControlForm}>
            Limpar
          </Button>
        </div>
      </Card>

      <Card className={`space-y-4 ${PANEL_CLASS}`}>
        <div className="flex flex-col gap-3 border-b border-neutral-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-bold text-neutral-950">Controles cadastrados</h3>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-green-100 px-3 py-1 text-green-800">Ativos: {controlStats.active}</span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">Vencidos: {controlStats.expired}</span>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">Inativos: {controlStats.inactive}</span>
          </div>
        </div>
        {controlSets.length ? (
          <div className="space-y-3">
            {controlSets.map((controlSet) => (
              <div key={controlSet.id} className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-semibold text-neutral-950">
                      {controlSet.analito} · {controlSet.manufacturer} · lote {controlSet.lotNumber}
                    </div>
                    <div className="mt-1 text-sm text-neutral-500">
                      Validade {formatLongBR(controlSet.validUntil)} · {controlStatusLabel(controlSet)}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {fixedControls(controlSet).map((control) => (
                        <span key={control.id} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
                          {control.name}: {resultLabel(control.expectedResult)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" icon={<Edit3 className="h-4 w-4" />} onClick={() => editControlSet(controlSet)} disabled={!canManageQc || !controlSet.isActive}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeactivationTarget(controlSet)} disabled={!canManageQc || !controlSet.isActive}>
                      Inativar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Plus className="h-8 w-8" />} title="Sem controles" description="Nenhum controle cadastrado." />
        )}
      </Card>

      <Card className={`space-y-4 ${PANEL_CLASS}`}>
        <h3 className="border-b border-neutral-100 pb-5 text-xl font-bold text-neutral-950">Histórico</h3>
        <div className={`grid gap-3 md:grid-cols-5 ${FORM_TONE}`}>
          <Input
            label="Analito"
            value={historyFilters.analito}
            onChange={(event) => setHistoryFilters((current) => ({ ...current, analito: event.target.value.toUpperCase() }))}
          />
          <Input
            label="Lote"
            value={historyFilters.lotNumber}
            onChange={(event) => setHistoryFilters((current) => ({ ...current, lotNumber: event.target.value }))}
          />
          <Input
            label="De"
            type="date"
            value={historyFilters.startDate}
            onChange={(event) => setHistoryFilters((current) => ({ ...current, startDate: event.target.value }))}
          />
          <Input
            label="Até"
            type="date"
            value={historyFilters.endDate}
            onChange={(event) => setHistoryFilters((current) => ({ ...current, endDate: event.target.value }))}
          />
          <Select
            label="Status"
            value={historyFilters.status}
            onChange={(event) => setHistoryFilters((current) => ({ ...current, status: event.target.value }))}
          >
            <option value="">Todos</option>
            <option value="APROVADO">Aprovado</option>
            <option value="REPROVADO">Reprovado</option>
          </Select>
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setHistoryFilters(emptyHistoryFilters)}>
            Limpar filtros
          </Button>
        </div>
        {filteredRuns.length ? (
          <div className="space-y-3">
            {filteredRuns.map((run) => (
              <div key={run.id} className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow-[0_10px_24px_rgba(23,23,23,0.06)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold text-neutral-950">
                      {run.analito} · {formatLongBR(run.dataMedicao)}
                    </div>
                    <div className="mt-1 text-sm text-neutral-500">
                      Soro-controle: {run.manufacturer} · lote {run.lotNumber} · validade {formatLongBR(run.validUntil)}
                    </div>
                    <div className="mt-1 text-sm text-neutral-500">
                      {run.reagentLabel
                        ? `Reagente: ${run.reagentLabel} · ${run.reagentManufacturer || 'marca não informada'} · lote ${run.reagentLotNumber || '-'} · validade ${formatOptionalDate(run.reagentValidUntil)} · ${reagentStatusLabel(run.reagentStatus)}`
                        : 'Reagente: não vinculado neste registro antigo'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={run.status} />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => setDeletingRun(run)}
                      disabled={!canManageQc}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 border-t border-neutral-100 pt-3 text-sm font-medium text-neutral-600 md:grid-cols-2">
                  {run.results.map((result) => (
                    <div key={result.id} className={result.status === 'REPROVADO' ? 'rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-800' : 'rounded-xl border border-green-100 bg-green-50/50 px-3 py-2 text-green-800'}>
                      {result.controlName}: esperado {resultLabel(result.expectedResult)} · observado {resultLabel(result.observedResult)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Plus className="h-8 w-8" />} title="Sem análises" description="Nenhuma análise encontrada para os filtros." />
        )}
      </Card>

      <Modal
        isOpen={Boolean(deactivationTarget)}
        onClose={() => setDeactivationTarget(null)}
        title="Inativar controle"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeactivationTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void confirmDeactivateControlSet()} loading={deactivateControlSet.isPending}>
              Inativar
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-neutral-600">
          <p>
            O controle ficará fora da seleção de análise. O histórico já lançado será preservado.
          </p>
          {deactivationTarget ? (
            <div className="rounded-xl bg-neutral-50 p-3 font-medium text-neutral-800">
              {deactivationTarget.analito} · {deactivationTarget.manufacturer} · lote {deactivationTarget.lotNumber}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(deletingRun)}
        onClose={() => setDeletingRun(null)}
        title="Excluir análise do histórico"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeletingRun(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void confirmDeleteRun()} loading={deleteRun.isPending}>
              Excluir
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-neutral-600">
          <p>Esta ação remove a análise e seus resultados observados do histórico de Imunologia.</p>
          {deletingRun ? (
            <div className="rounded-xl bg-neutral-50 p-3 font-medium text-neutral-800">
              {deletingRun.analito} · {formatLongBR(deletingRun.dataMedicao)} · lote {deletingRun.lotNumber}
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  )
}

function AnalysisControlRow({
  label,
  observedResult,
  preview,
  onChange,
  selectRef,
}: {
  label: string
  observedResult: string
  preview?: AnalysisPreviewItem
  onChange: (value: string) => void
  selectRef?: Ref<HTMLSelectElement>
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-neutral-100 bg-white px-4 py-4 shadow-sm">
      <div>
        <div className="text-base font-semibold text-neutral-950">{label}</div>
        {preview ? (
          <div className={preview.observedResult && preview.status === 'REPROVADO' ? 'mt-2 text-sm font-medium text-red-700' : 'mt-2 text-sm font-medium text-green-700'}>
            Esperado: {resultLabel(preview.expectedResult)}
            {preview.observedResult ? ` · ${preview.status}` : ''}
          </div>
        ) : null}
      </div>
      <Select ref={selectRef} label="Resultado" value={observedResult} onChange={(event) => onChange(event.target.value)}>
        <option value="">Selecione</option>
        {RESULT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </Select>
    </div>
  )
}

function ReagentLotSummary({ lot, dataMedicao }: { lot: ReagentLot; dataMedicao: string }) {
  const validityState = getReagentValidityState(lot, dataMedicao)
  return (
    <div className="space-y-4 rounded-2xl border border-green-100 bg-green-50/40 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-base font-semibold text-neutral-950">{lot.label}</div>
          <div className="mt-1 text-sm font-medium text-neutral-500">{lot.manufacturer} · lote {lot.lotNumber}</div>
        </div>
        <span className={reagentStatusPillClass(lot.status)}>{reagentStatusLabel(lot.status)}</span>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <DetailItem label="Validade" value={formatOptionalDate(lot.expiryDate)} />
        <DetailItem label="Estoque" value={formatStock(lot)} />
        <DetailItem label="Temperatura" value={lot.storageTemp || 'Não informada'} />
        <DetailItem label="Local" value={lot.location || 'Não informado'} />
      </div>
      {validityState ? (
        <div className={validityState.className}>
          {validityState.severity === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span>{validityState.message}</span>
        </div>
      ) : null}
    </div>
  )
}

function ControlSetSummary({ controlSet, dataMedicao }: { controlSet: ImmunologyControlSet; dataMedicao: string }) {
  const controls = fixedControls(controlSet)
  const validityState = getControlValidityState(controlSet, dataMedicao)
  return (
    <div className="space-y-4 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-base font-semibold text-neutral-950">{controlSet.analito}</div>
          <div className="mt-1 text-sm font-medium text-neutral-500">
            {controlSet.manufacturer} · lote {controlSet.lotNumber}
          </div>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
          {controlStatusLabel(controlSet)}
        </span>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <DetailItem label="Validade" value={formatOptionalDate(controlSet.validUntil)} />
        <DetailItem label="Controles" value={`${controls.length} esperado(s)`} />
      </div>
      <div className="flex flex-wrap gap-2">
        {controls.map((control) => (
          <span key={control.id} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
            {control.name}: {resultLabel(control.expectedResult)}
          </span>
        ))}
      </div>
      {validityState ? (
        <div className={validityState.className}>
          {validityState.severity === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span>{validityState.message}</span>
        </div>
      ) : null}
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/70 bg-white/75 px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-400">{label}</div>
      <div className="mt-1 font-semibold text-neutral-800">{value}</div>
    </div>
  )
}

function updateExpectedControl(
  index: number,
  patch: Partial<ImmunologyControlSetRequest['controls'][number]>,
  setControlForm: Dispatch<SetStateAction<ImmunologyControlSetRequest>>,
) {
  setControlForm((current) => ({
    ...current,
    controls: current.controls.map((control, controlIndex) => (
      controlIndex === index ? { ...control, ...patch } : control
    )),
  }))
}

function fixedControls(controlSet: ImmunologyControlSet) {
  return [...controlSet.controls].sort((left, right) => left.displayOrder - right.displayOrder)
}

type AnalysisPreviewItem = {
  controlName: string
  expectedResult: string
  observedResult: string
  status: 'APROVADO' | 'REPROVADO' | 'PENDENTE'
}

function buildAnalysisPreview(controls: ImmunologyControlSet['controls'], observedResults: Record<string, string>) {
  const items = controls.map((control) => {
    const observedResult = observedResults[control.id] ?? ''
    return {
      controlName: control.name,
      expectedResult: control.expectedResult,
      observedResult,
      status: observedResult ? (observedResult === control.expectedResult ? 'APROVADO' : 'REPROVADO') : 'PENDENTE',
    } satisfies AnalysisPreviewItem
  })
  const complete = items.length > 0 && items.every((item) => item.status !== 'PENDENTE')
  const failedControls = items.filter((item) => item.status === 'REPROVADO').map((item) => item.controlName)
  return {
    items,
    failedControls,
    status: complete ? (failedControls.length ? 'REPROVADO' : 'APROVADO') : 'PENDENTE',
  }
}

function buildControlStats(controlSets: ImmunologyControlSet[]) {
  return {
    active: controlSets.filter((controlSet) => controlSet.isActive).length,
    expired: controlSets.filter((controlSet) => controlSet.isActive && controlSet.expired).length,
    inactive: controlSets.filter((controlSet) => !controlSet.isActive).length,
  }
}

function filterRuns(runs: ImmunologyRun[], filters: typeof emptyHistoryFilters) {
  return runs.filter((run) => {
    const lotOk = !filters.lotNumber.trim() || run.lotNumber.toLowerCase().includes(filters.lotNumber.trim().toLowerCase())
    const statusOk = !filters.status || run.status === filters.status
    return lotOk && statusOk
  })
}

function findDuplicateControlSet(
  controlSets: ImmunologyControlSet[],
  form: ImmunologyControlSetRequest,
  editingControlSetId: string | null,
) {
  if (!form.analito.trim() || !form.manufacturer.trim() || !form.lotNumber.trim()) {
    return false
  }
  return controlSets.some((controlSet) => (
    controlSet.isActive &&
    controlSet.id !== editingControlSetId &&
    normalizeKey(controlSet.analito) === normalizeKey(form.analito) &&
    normalizeKey(controlSet.manufacturer) === normalizeKey(form.manufacturer) &&
    normalizeKey(controlSet.lotNumber) === normalizeKey(form.lotNumber)
  ))
}

function normalizeKey(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR')
}

function isControlExpiredForDate(controlSet: ImmunologyControlSet, dataMedicao: string) {
  return Boolean(controlSet.validUntil && dataMedicao && controlSet.validUntil < dataMedicao)
}

function getControlValidityState(controlSet: ImmunologyControlSet, dataMedicao: string) {
  const days = diffInDays(dataMedicao, controlSet.validUntil)
  if (days !== null && days < 0) {
    return {
      severity: 'danger',
      message: `Controle vencido em ${formatLongBR(controlSet.validUntil)} para a data da análise.`,
      className: statusBoxClass('danger'),
    }
  }
  if (days !== null && days <= 30) {
    return {
      severity: 'warning',
      message: `Controle vence em ${days} dia${days === 1 ? '' : 's'} (${formatLongBR(controlSet.validUntil)}).`,
      className: statusBoxClass('warning'),
    }
  }
  return {
    severity: 'ok',
    message: `Controle válido até ${formatLongBR(controlSet.validUntil)}.`,
    className: statusBoxClass('success'),
  }
}

function getReagentValidityState(lot: ReagentLot, dataMedicao: string) {
  if (isTerminalReagentStatus(lot.status)) {
    return {
      severity: 'danger',
      message: `Reagente ${reagentStatusLabel(lot.status).toLowerCase()} não pode ser usado em análise de Imunologia.`,
      className: statusBoxClass('danger'),
    }
  }
  const days = diffInDays(dataMedicao, lot.expiryDate)
  if (days !== null && days < 0) {
    return {
      severity: 'danger',
      message: `Reagente vencido em ${formatLongBR(lot.expiryDate)} para a data da análise.`,
      className: statusBoxClass('danger'),
    }
  }
  if (days !== null && days <= 30) {
    return {
      severity: 'warning',
      message: `Reagente vence em ${days} dia${days === 1 ? '' : 's'} (${formatLongBR(lot.expiryDate)}).`,
      className: statusBoxClass('warning'),
    }
  }
  return {
    severity: 'ok',
    message: `Reagente válido até ${formatLongBR(lot.expiryDate)}.`,
    className: statusBoxClass('success'),
  }
}

function isTerminalReagentStatus(status?: string | null) {
  return status === 'inativo' || status === 'vencido'
}

function statusBoxClass(tone: 'success' | 'warning' | 'danger') {
  const tones = {
    success: 'border-green-200 bg-green-50 text-green-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-800',
  }
  return `flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${tones[tone]}`
}

function reagentStatusLabel(value?: string | null) {
  if (value === 'em_estoque') return 'Em estoque'
  if (value === 'em_uso') return 'Em uso'
  if (value === 'vencido') return 'Vencido'
  if (value === 'inativo') return 'Inativo'
  return value || 'Não informado'
}

function reagentStatusPillClass(value?: string | null) {
  if (value === 'vencido' || value === 'inativo') {
    return 'rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800'
  }
  if (value === 'em_uso') {
    return 'rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800'
  }
  return 'rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800'
}

function formatOptionalDate(value?: string | null) {
  return value ? formatLongBR(value) : 'Não informada'
}

function formatStock(lot: ReagentLot) {
  const inStock = lot.unitsInStock ?? 0
  const inUse = lot.unitsInUse ?? 0
  const total = lot.totalUnits ?? inStock + inUse
  return `${inStock} fechado(s) · ${inUse} em uso · total ${total}`
}

function controlStatusLabel(controlSet: ImmunologyControlSet) {
  if (!controlSet.isActive) return 'inativo'
  if (controlSet.expired) return 'vencido'
  return 'ativo'
}

function resultLabel(value: string) {
  if (value === 'REAGENTE') return 'Reagente'
  if (value === 'NAO_REAGENTE') return 'Não reagente'
  return value
}

function getApiErrorMessage(error: unknown, fallbackMessage: string) {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.message
    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage
    }
  }
  return fallbackMessage
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

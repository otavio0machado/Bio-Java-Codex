import axios from 'axios'
import { Download, Edit3, Plus, Save, Trash2, X } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { useMemo, useState } from 'react'
import {
  useCreateImmunologyControlSet,
  useCreateImmunologyRun,
  useDeactivateImmunologyControlSet,
  useImmunologyControlSets,
  useImmunologyRuns,
  useUpdateImmunologyControlSet,
} from '../../hooks/useImmunology'
import { reportService } from '../../services/reportService'
import type { ImmunologyControlSet, ImmunologyControlSetRequest, ImmunologyResult } from '../../types'
import { formatLongBR, todayLocal } from '../../utils/date'
import { Button, Card, EmptyState, Input, Select, StatusBadge, useToast } from '../ui'

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

const emptyControlForm: ImmunologyControlSetRequest = {
  analito: '',
  manufacturer: '',
  lotNumber: '',
  validUntil: '',
  controls: [
    { name: 'Controle 1', expectedResult: 'REAGENTE' },
    { name: 'Controle 2', expectedResult: 'NAO_REAGENTE' },
  ],
}

function createAnalysisForm() {
  return {
    dataMedicao: todayLocal(),
    analito: '',
    manufacturer: '',
    lotNumber: '',
    controlSetId: '',
    controle1: '',
    controle2: '',
  }
}

export function ImunologiaArea() {
  const { toast } = useToast()
  const [analysisForm, setAnalysisForm] = useState(createAnalysisForm())
  const [controlForm, setControlForm] = useState<ImmunologyControlSetRequest>(emptyControlForm)
  const [editingControlSetId, setEditingControlSetId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const { data: controlSets = [] } = useImmunologyControlSets()
  const { data: runs = [] } = useImmunologyRuns()
  const createControlSet = useCreateImmunologyControlSet()
  const updateControlSet = useUpdateImmunologyControlSet()
  const deactivateControlSet = useDeactivateImmunologyControlSet()
  const createRun = useCreateImmunologyRun()

  const selectedControlSet = useMemo(
    () => controlSets.find((controlSet) => controlSet.id === analysisForm.controlSetId) ?? null,
    [analysisForm.controlSetId, controlSets],
  )
  const selectedControls = selectedControlSet ? fixedControls(selectedControlSet) : []

  const saveControlSet = async () => {
    if (!controlForm.analito || !controlForm.manufacturer || !controlForm.lotNumber || !controlForm.validUntil) {
      toast.warning('Preencha analito, marca, lote e validade.')
      return
    }

    try {
      const request = {
        ...controlForm,
        analito: controlForm.analito.toUpperCase(),
        controls: [
          { name: 'Controle 1', expectedResult: controlForm.controls[0].expectedResult },
          { name: 'Controle 2', expectedResult: controlForm.controls[1].expectedResult },
        ],
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
    if (!selectedControlSet || selectedControls.length < 2) {
      toast.warning('Selecione um controle cadastrado.')
      return
    }
    if (!analysisForm.controle1 || !analysisForm.controle2) {
      toast.warning('Informe controle 1 e controle 2.')
      return
    }

    try {
      const response = await createRun.mutateAsync({
        dataMedicao: analysisForm.dataMedicao,
        controlSetId: selectedControlSet.id,
        results: [
          { controlItemId: selectedControls[0].id, observedResult: analysisForm.controle1 },
          { controlItemId: selectedControls[1].id, observedResult: analysisForm.controle2 },
        ],
      })
      toast[response.status === 'APROVADO' ? 'success' : 'warning'](`Análise registrada: ${response.status}.`)
      setAnalysisForm(createAnalysisForm())
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível registrar a análise.'))
    }
  }

  const selectControlSet = (controlSet: ImmunologyControlSet) => {
    setAnalysisForm({
      dataMedicao: analysisForm.dataMedicao,
      analito: controlSet.analito,
      manufacturer: controlSet.manufacturer,
      lotNumber: controlSet.lotNumber,
      controlSetId: controlSet.id,
      controle1: '',
      controle2: '',
    })
    setPickerOpen(false)
  }

  const editControlSet = (controlSet: ImmunologyControlSet) => {
    const controls = fixedControls(controlSet)
    setEditingControlSetId(controlSet.id)
    setControlForm({
      analito: controlSet.analito,
      manufacturer: controlSet.manufacturer,
      lotNumber: controlSet.lotNumber,
      validUntil: controlSet.validUntil,
      controls: [
        { name: 'Controle 1', expectedResult: controls[0]?.expectedResult ?? 'REAGENTE' },
        { name: 'Controle 2', expectedResult: controls[1]?.expectedResult ?? 'NAO_REAGENTE' },
      ],
    })
    setPickerOpen(false)
  }

  const resetControlForm = () => {
    setEditingControlSetId(null)
    setControlForm(emptyControlForm)
  }

  const removeControlSet = async (id: string) => {
    try {
      await deactivateControlSet.mutateAsync(id)
      toast.success('Controle inativado.')
      if (analysisForm.controlSetId === id) {
        setAnalysisForm(createAnalysisForm())
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível inativar o controle.'))
    }
  }

  const downloadPdf = async () => {
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
    <div className="mx-auto max-w-5xl space-y-6">
      <Card className={`space-y-6 ${PANEL_CLASS}`}>
        <div className="flex flex-col gap-3 border-b border-neutral-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-center text-2xl font-bold uppercase tracking-[0.08em] text-neutral-950 sm:text-left">
            Imunologia
          </h2>
          <Button
            className="h-11 rounded-xl border-neutral-200 bg-white px-4 text-base shadow-sm hover:border-neutral-300 hover:bg-neutral-50"
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={() => void downloadPdf()}
          >
            Gerar PDF
          </Button>
        </div>

        <div className={`grid gap-4 md:grid-cols-4 ${FORM_TONE}`}>
          <Input
            label="Analito"
            value={analysisForm.analito}
            onChange={(event) => setAnalysisForm((current) => ({ ...current, analito: event.target.value.toUpperCase() }))}
          />
          <Input
            label="Data"
            type="date"
            value={analysisForm.dataMedicao}
            onChange={(event) => setAnalysisForm((current) => ({ ...current, dataMedicao: event.target.value }))}
          />
          <Input
            label="Marca"
            value={analysisForm.manufacturer}
            onChange={(event) => setAnalysisForm((current) => ({ ...current, manufacturer: event.target.value }))}
          />
          <Input
            label="Lote"
            value={analysisForm.lotNumber}
            onChange={(event) => setAnalysisForm((current) => ({ ...current, lotNumber: event.target.value }))}
          />
        </div>

        <div className="relative">
          <Button className="h-11 rounded-xl px-5 shadow-sm" onClick={() => setPickerOpen((current) => !current)}>
            Controle +
          </Button>
          {pickerOpen ? (
            <div className="absolute z-20 mt-3 w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-2 shadow-[0_22px_50px_rgba(23,23,23,0.14)]">
              {controlSets.length ? (
                <div className="max-h-72 space-y-2 overflow-auto pr-1">
                  {controlSets.map((controlSet) => (
                    <div key={controlSet.id} className="flex flex-col gap-3 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3 transition hover:border-green-200 hover:bg-green-50/40 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        className="min-w-0 text-left"
                        onClick={() => selectControlSet(controlSet)}
                      >
                        <div className="truncate font-semibold text-neutral-950">{controlSet.analito}</div>
                        <div className="mt-1 text-sm text-neutral-500">
                          {controlSet.manufacturer} · lote {controlSet.lotNumber} · validade {formatLongBR(controlSet.validUntil)}
                        </div>
                      </button>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" icon={<Edit3 className="h-4 w-4" />} onClick={() => editControlSet(controlSet)}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => void removeControlSet(controlSet.id)}>
                          Inativar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-neutral-50 px-3 py-4 text-sm font-medium text-neutral-500">Nenhum controle cadastrado.</div>
              )}
            </div>
          ) : null}
        </div>

        <div className={`divide-y divide-neutral-100 rounded-2xl border border-neutral-100 bg-neutral-50/50 px-4 py-1 ${FORM_TONE}`}>
          <div className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_16rem] md:items-end">
            <div className="text-lg font-semibold text-neutral-950">Análise controle 1</div>
            <Select
              label="Resultado"
              value={analysisForm.controle1}
              onChange={(event) => setAnalysisForm((current) => ({ ...current, controle1: event.target.value }))}
            >
              <option value="">Selecione</option>
              {RESULT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_16rem] md:items-end">
            <div className="text-lg font-semibold text-neutral-950">Análise controle 2</div>
            <Select
              label="Resultado"
              value={analysisForm.controle2}
              onChange={(event) => setAnalysisForm((current) => ({ ...current, controle2: event.target.value }))}
            >
              <option value="">Selecione</option>
              {RESULT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
        </div>

        <Button className={`w-full ${PRIMARY_ACTION_CLASS}`} icon={<Save className="h-4 w-4" />} onClick={() => void saveAnalysis()} loading={createRun.isPending}>
          Salvar análise
        </Button>
      </Card>

      <Card className={`space-y-5 ${PANEL_CLASS}`}>
        <div className="flex flex-col gap-3 border-b border-neutral-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-bold text-neutral-950">Cadastro de controles</h3>
          {editingControlSetId ? (
            <Button variant="ghost" icon={<X className="h-4 w-4" />} onClick={resetControlForm}>
              Cancelar edição
            </Button>
          ) : null}
        </div>

        <div className={`grid gap-4 md:grid-cols-4 ${FORM_TONE}`}>
          <Input
            label="Analito"
            value={controlForm.analito}
            onChange={(event) => setControlForm((current) => ({ ...current, analito: event.target.value.toUpperCase() }))}
          />
          <Input
            label="Marca"
            value={controlForm.manufacturer}
            onChange={(event) => setControlForm((current) => ({ ...current, manufacturer: event.target.value }))}
          />
          <Input
            label="Lote"
            value={controlForm.lotNumber}
            onChange={(event) => setControlForm((current) => ({ ...current, lotNumber: event.target.value }))}
          />
          <Input
            label="Validade"
            type="date"
            value={controlForm.validUntil}
            onChange={(event) => setControlForm((current) => ({ ...current, validUntil: event.target.value }))}
          />
        </div>

        <div className={`grid gap-4 md:grid-cols-2 ${FORM_TONE}`}>
          <div className="grid gap-3 rounded-2xl border border-neutral-100 bg-neutral-50/50 p-4 md:grid-cols-[minmax(0,1fr)_14rem] md:items-end">
            <div className="text-lg font-semibold text-neutral-950">Controle 1</div>
            <Select
              label="Esperado"
              value={controlForm.controls[0].expectedResult}
              onChange={(event) => updateExpectedControl(0, event.target.value, setControlForm)}
            >
              {RESULT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 rounded-2xl border border-neutral-100 bg-neutral-50/50 p-4 md:grid-cols-[minmax(0,1fr)_14rem] md:items-end">
            <div className="text-lg font-semibold text-neutral-950">Controle 2</div>
            <Select
              label="Esperado"
              value={controlForm.controls[1].expectedResult}
              onChange={(event) => updateExpectedControl(1, event.target.value, setControlForm)}
            >
              {RESULT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
        </div>

        <Button className={`w-full ${PRIMARY_ACTION_CLASS}`} icon={<Save className="h-4 w-4" />} onClick={() => void saveControlSet()} loading={createControlSet.isPending || updateControlSet.isPending}>
          {editingControlSetId ? 'Atualizar controle' : 'Salvar controle'}
        </Button>
      </Card>

      <Card className={`space-y-4 ${PANEL_CLASS}`}>
        <h3 className="border-b border-neutral-100 pb-5 text-xl font-bold text-neutral-950">Histórico</h3>
        {runs.length ? (
          <div className="space-y-3">
            {runs.map((run) => (
              <div key={run.id} className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow-[0_10px_24px_rgba(23,23,23,0.06)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold text-neutral-950">
                      {run.analito} · {formatLongBR(run.dataMedicao)}
                    </div>
                    <div className="mt-1 text-sm text-neutral-500">
                      {run.manufacturer} · lote {run.lotNumber}
                    </div>
                  </div>
                  <StatusBadge status={run.status} />
                </div>
                <div className="mt-4 grid gap-2 border-t border-neutral-100 pt-3 text-sm font-medium text-neutral-600 md:grid-cols-2">
                  {run.results.map((result) => (
                    <div key={result.id}>
                      {result.controlName}: {resultLabel(result.observedResult)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Plus className="h-8 w-8" />} title="Sem análises" description="Nenhuma análise registrada." />
        )}
      </Card>
    </div>
  )
}

function updateExpectedControl(
  index: 0 | 1,
  expectedResult: string,
  setControlForm: Dispatch<SetStateAction<ImmunologyControlSetRequest>>,
) {
  setControlForm((current) => ({
    ...current,
    controls: current.controls.map((control, controlIndex) => (
      controlIndex === index ? { ...control, expectedResult } : control
    )),
  }))
}

function fixedControls(controlSet: ImmunologyControlSet) {
  return [...controlSet.controls].sort((left, right) => left.displayOrder - right.displayOrder).slice(0, 2)
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

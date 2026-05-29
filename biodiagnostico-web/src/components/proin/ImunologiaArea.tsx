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
      <Card className="space-y-6 border border-neutral-200 bg-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-center text-2xl font-semibold uppercase tracking-wide text-neutral-900 sm:text-left">
            Imunologia
          </h2>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => void downloadPdf()}>
            Gerar PDF
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
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
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setPickerOpen((current) => !current)}>
            Controle +
          </Button>
          {pickerOpen ? (
            <div className="absolute z-20 mt-2 w-full max-w-xl rounded-xl border border-neutral-200 bg-white p-3 shadow-elevated">
              {controlSets.length ? (
                <div className="max-h-72 space-y-2 overflow-auto">
                  {controlSets.map((controlSet) => (
                    <div key={controlSet.id} className="flex flex-col gap-2 rounded-lg border border-neutral-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => selectControlSet(controlSet)}
                      >
                        <div className="font-semibold text-neutral-900">{controlSet.analito}</div>
                        <div className="text-sm text-neutral-500">
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
                <div className="px-3 py-4 text-sm text-neutral-500">Nenhum controle cadastrado.</div>
              )}
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem] md:items-end">
            <div className="text-lg font-semibold text-neutral-900">Análise controle 1</div>
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
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem] md:items-end">
            <div className="text-lg font-semibold text-neutral-900">Análise controle 2</div>
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

        <Button className="w-full" icon={<Save className="h-4 w-4" />} onClick={() => void saveAnalysis()} loading={createRun.isPending}>
          Salvar análise
        </Button>
      </Card>

      <Card className="space-y-5 border border-neutral-200 bg-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-semibold text-neutral-900">Cadastro de controles</h3>
          {editingControlSetId ? (
            <Button variant="ghost" icon={<X className="h-4 w-4" />} onClick={resetControlForm}>
              Cancelar edição
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
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

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem] md:items-end">
            <div className="text-lg font-semibold text-neutral-900">Controle 1</div>
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
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem] md:items-end">
            <div className="text-lg font-semibold text-neutral-900">Controle 2</div>
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

        <Button className="w-full" icon={<Save className="h-4 w-4" />} onClick={() => void saveControlSet()} loading={createControlSet.isPending || updateControlSet.isPending}>
          {editingControlSetId ? 'Atualizar controle' : 'Salvar controle'}
        </Button>
      </Card>

      <Card className="space-y-4 border border-neutral-200 bg-white">
        <h3 className="text-xl font-semibold text-neutral-900">Histórico</h3>
        {runs.length ? (
          <div className="space-y-3">
            {runs.map((run) => (
              <div key={run.id} className="rounded-xl border border-neutral-200 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold text-neutral-900">
                      {run.analito} · {formatLongBR(run.dataMedicao)}
                    </div>
                    <div className="text-sm text-neutral-500">
                      {run.manufacturer} · lote {run.lotNumber}
                    </div>
                  </div>
                  <StatusBadge status={run.status} />
                </div>
                <div className="mt-3 grid gap-2 text-sm text-neutral-600 md:grid-cols-2">
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

import axios from 'axios'
import { Download, FlaskConical, Pencil, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react'
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
import type {
  ImmunologyControlItemRequest,
  ImmunologyControlSet,
  ImmunologyControlSetRequest,
  ImmunologyResult,
} from '../../types'
import { diffInDays, formatLongBR, todayLocal } from '../../utils/date'
import { Button, Card, EmptyState, Input, Select, StatusBadge, TextArea, useToast } from '../ui'

const RESULT_OPTIONS: Array<{ value: ImmunologyResult; label: string }> = [
  { value: 'REAGENTE', label: 'Reagente' },
  { value: 'NAO_REAGENTE', label: 'Não reagente' },
]

const QUICK_ANALYTES = ['HIV', 'HBsAg', 'HCV', 'VDRL', 'DENGUE NS1', 'DENGUE IgG', 'DENGUE IgM']

const defaultControls: ImmunologyControlItemRequest[] = [
  { name: 'Controle 1', expectedResult: 'REAGENTE' },
  { name: 'Controle 2', expectedResult: 'NAO_REAGENTE' },
]

const emptyControlForm: ImmunologyControlSetRequest = {
  analito: '',
  manufacturer: '',
  lotNumber: '',
  validUntil: '',
  controls: defaultControls,
}

function createRunForm() {
  return {
    dataMedicao: todayLocal(),
    controlSetId: '',
    analyst: '',
    notes: '',
  }
}

export function ImunologiaArea() {
  const { toast } = useToast()
  const [controlForm, setControlForm] = useState<ImmunologyControlSetRequest>(emptyControlForm)
  const [runForm, setRunForm] = useState(createRunForm())
  const [observedResults, setObservedResults] = useState<Record<string, string>>({})
  const [analitoFilter, setAnalitoFilter] = useState('')
  const [editingControlSetId, setEditingControlSetId] = useState<string | null>(null)

  const runFilters = useMemo(() => ({ analito: analitoFilter || undefined }), [analitoFilter])
  const { data: controlSets = [] } = useImmunologyControlSets()
  const { data: runs = [] } = useImmunologyRuns(runFilters)
  const createControlSet = useCreateImmunologyControlSet()
  const updateControlSet = useUpdateImmunologyControlSet()
  const deactivateControlSet = useDeactivateImmunologyControlSet()
  const createRun = useCreateImmunologyRun()

  const availableAnalitos = useMemo(() => {
    return Array.from(new Set([...QUICK_ANALYTES, ...controlSets.map((item) => item.analito), ...runs.map((item) => item.analito)]))
      .sort((left, right) => left.localeCompare(right))
  }, [controlSets, runs])

  const selectedControlSet = useMemo(
    () => controlSets.find((item) => item.id === runForm.controlSetId) ?? null,
    [controlSets, runForm.controlSetId],
  )

  const saveControlSet = async () => {
    if (!controlForm.analito || !controlForm.manufacturer || !controlForm.lotNumber || !controlForm.validUntil) {
      toast.warning('Preencha analito, marca, lote e validade.')
      return
    }
    if (!controlForm.controls.length || controlForm.controls.some((item) => !item.name || !item.expectedResult)) {
      toast.warning('Cadastre todos os controles esperados.')
      return
    }

    try {
      const request = {
        ...controlForm,
        analito: controlForm.analito.toUpperCase(),
      }
      if (editingControlSetId) {
        await updateControlSet.mutateAsync({ id: editingControlSetId, request })
        toast.success('Controle de imunologia atualizado.')
      } else {
        await createControlSet.mutateAsync(request)
        toast.success('Controle de imunologia cadastrado.')
      }
      resetControlForm()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível salvar o controle.'))
    }
  }

  const saveRun = async () => {
    if (!selectedControlSet) {
      toast.warning('Selecione um controle cadastrado.')
      return
    }
    const missing = selectedControlSet.controls.some((item) => !observedResults[item.id])
    if (missing) {
      toast.warning('Informe o resultado observado de todos os controles.')
      return
    }

    try {
      const response = await createRun.mutateAsync({
        dataMedicao: runForm.dataMedicao,
        controlSetId: selectedControlSet.id,
        analyst: runForm.analyst || undefined,
        notes: runForm.notes || undefined,
        results: selectedControlSet.controls.map((item) => ({
          controlItemId: item.id,
          observedResult: observedResults[item.id],
        })),
      })
      toast[response.status === 'APROVADO' ? 'success' : 'warning'](`Análise registrada: ${response.status}.`)
      setRunForm(createRunForm())
      setObservedResults({})
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível registrar a análise.'))
    }
  }

  const removeControlSet = async (id: string) => {
    try {
      await deactivateControlSet.mutateAsync(id)
      toast.success('Controle inativado.')
      if (runForm.controlSetId === id) {
        setRunForm((current) => ({ ...current, controlSetId: '' }))
        setObservedResults({})
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível inativar o controle.'))
    }
  }

  const editControlSet = (controlSet: ImmunologyControlSet) => {
    setEditingControlSetId(controlSet.id)
    setControlForm({
      analito: controlSet.analito,
      manufacturer: controlSet.manufacturer,
      lotNumber: controlSet.lotNumber,
      validUntil: controlSet.validUntil,
      controls: controlSet.controls.map((item) => ({
        name: item.name,
        expectedResult: item.expectedResult,
      })),
    })
  }

  const resetControlForm = () => {
    setEditingControlSetId(null)
    setControlForm(emptyControlForm)
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
      toast.error('Não foi possível gerar o PDF de imunologia.')
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border border-emerald-100 bg-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5" />
              CQ qualitativo
            </div>
            <h2 className="text-2xl font-semibold text-neutral-900">Imunologia</h2>
            <p className="max-w-3xl text-sm text-neutral-600">
              Controle por analito, marca, lote e validade, comparando resultado esperado e observado como reagente ou não reagente.
            </p>
          </div>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => void downloadPdf()}>
            Gerar PDF
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Cadastro de controles</h3>
            <p className="text-sm text-neutral-500">
              {editingControlSetId ? 'Atualize o controle ativo com cuidado: análises já registradas mantêm snapshot histórico.' : 'Configure o resultado esperado antes de usar o lote na rotina.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {availableAnalitos.slice(0, 8).map((analito) => (
              <button
                key={analito}
                type="button"
                className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-800 transition hover:bg-emerald-50"
                onClick={() => setControlForm((current) => ({ ...current, analito }))}
              >
                {analito}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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

          <div className="space-y-3">
            {controlForm.controls.map((control, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 md:grid-cols-[1fr_13rem_auto]">
                <Input
                  label={`Controle ${index + 1}`}
                  value={control.name}
                  onChange={(event) => updateControlItem(index, { name: event.target.value }, setControlForm)}
                />
                <Select
                  label="Esperado"
                  value={control.expectedResult}
                  onChange={(event) => updateControlItem(index, { expectedResult: event.target.value }, setControlForm)}
                >
                  {RESULT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Button
                  className="self-end"
                  variant="ghost"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => removeControlItem(index, setControlForm)}
                  disabled={controlForm.controls.length <= 1}
                >
                  Remover
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="flex-1"
              variant="secondary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => addControlItem(setControlForm)}
            >
              Adicionar controle
            </Button>
            <Button
              className="flex-1"
              icon={<Save className="h-4 w-4" />}
              onClick={() => void saveControlSet()}
              loading={createControlSet.isPending || updateControlSet.isPending}
            >
              {editingControlSetId ? 'Atualizar cadastro' : 'Salvar cadastro'}
            </Button>
          </div>

          {editingControlSetId ? (
            <Button variant="ghost" icon={<X className="h-4 w-4" />} onClick={resetControlForm}>
              Cancelar edição
            </Button>
          ) : null}
        </Card>

        <Card className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Análise de controle</h3>
            <p className="text-sm text-neutral-500">O backend calcula a decisão comparando observado contra esperado.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Data"
              type="date"
              value={runForm.dataMedicao}
              onChange={(event) => setRunForm((current) => ({ ...current, dataMedicao: event.target.value }))}
            />
            <Select
              label="Controle cadastrado"
              value={runForm.controlSetId}
              onChange={(event) => {
                setRunForm((current) => ({ ...current, controlSetId: event.target.value }))
                setObservedResults({})
              }}
            >
              <option value="">Selecione</option>
              {controlSets.map((controlSet) => (
                <option key={controlSet.id} value={controlSet.id}>
                  {formatControlSetLabel(controlSet)}
                </option>
              ))}
            </Select>
            <Input
              label="Responsável"
              value={runForm.analyst}
              onChange={(event) => setRunForm((current) => ({ ...current, analyst: event.target.value }))}
            />
          </div>

          {selectedControlSet ? (
            <div className={selectedControlSet.expired ? 'rounded-xl border border-red-200 bg-red-50 p-4' : 'rounded-xl border border-emerald-200 bg-emerald-50 p-4'}>
              <div className="text-sm font-semibold text-neutral-900">
                {selectedControlSet.analito} · {selectedControlSet.manufacturer} · lote {selectedControlSet.lotNumber}
              </div>
              <div className="mt-1 text-sm text-neutral-600">
                Validade {formatLongBR(selectedControlSet.validUntil)} · {formatExpiryState(selectedControlSet)}
              </div>
            </div>
          ) : null}

          {selectedControlSet ? (
            <div className="space-y-3">
              {selectedControlSet.controls.map((control) => (
                <div key={control.id} className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-3 md:grid-cols-[1fr_12rem_13rem]">
                  <div>
                    <div className="font-semibold text-neutral-900">{control.name}</div>
                    <div className="mt-1 text-sm text-neutral-500">Esperado: {resultLabel(control.expectedResult)}</div>
                  </div>
                  <Select
                    label="Observado"
                    value={observedResults[control.id] ?? ''}
                    onChange={(event) => setObservedResults((current) => ({ ...current, [control.id]: event.target.value }))}
                  >
                    <option value="">Selecione</option>
                    {RESULT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <div className="self-end">
                    {observedResults[control.id] ? (
                      <StatusBadge status={observedResults[control.id] === control.expectedResult ? 'APROVADO' : 'REPROVADO'} />
                    ) : (
                      <span className="inline-flex rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-semibold text-neutral-600">
                        Pendente
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<FlaskConical className="h-8 w-8" />}
              title="Selecione um controle"
              description="Os controles cadastrados aparecerão aqui para lançar a análise qualitativa da rotina."
            />
          )}

          <TextArea
            label="Observação"
            value={runForm.notes}
            onChange={(event) => setRunForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Registre repetição, troca de lote, não conformidade ou contexto operacional relevante."
          />

          <Button className="w-full" onClick={() => void saveRun()} loading={createRun.isPending}>
            Registrar análise
          </Button>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Controles cadastrados</h3>
              <p className="text-sm text-neutral-500">Somente controles ativos ficam disponíveis para análise.</p>
            </div>
            <Select label="Filtro analito" value={analitoFilter} onChange={(event) => setAnalitoFilter(event.target.value)}>
              <option value="">Todos</option>
              {availableAnalitos.map((analito) => (
                <option key={analito} value={analito}>
                  {analito}
                </option>
              ))}
            </Select>
          </div>

          {controlSets.length ? (
            <div className="space-y-3">
              {controlSets
                .filter((controlSet) => !analitoFilter || controlSet.analito === analitoFilter)
                .map((controlSet) => (
                  <div key={controlSet.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold text-neutral-900">{formatControlSetLabel(controlSet)}</div>
                        <div className="mt-1 text-sm text-neutral-500">
                          Validade {formatLongBR(controlSet.validUntil)} · {formatExpiryState(controlSet)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil className="h-4 w-4" />}
                          onClick={() => editControlSet(controlSet)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="h-4 w-4" />}
                          onClick={() => void removeControlSet(controlSet.id)}
                          loading={deactivateControlSet.isPending}
                        >
                          Inativar
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {controlSet.controls.map((control) => (
                        <span key={control.id} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
                          {control.name}: {resultLabel(control.expectedResult)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <EmptyState
              icon={<FlaskConical className="h-8 w-8" />}
              title="Nenhum controle cadastrado"
              description="Cadastre o primeiro lote para liberar a análise qualitativa da Imunologia."
            />
          )}
        </Card>

        <Card className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Histórico de análises</h3>
            <p className="text-sm text-neutral-500">Cada linha mantém snapshot do lote e do resultado esperado.</p>
          </div>

          {runs.length ? (
            <div className="space-y-3">
              {runs.map((run) => (
                <div key={run.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold text-neutral-900">
                        {run.analito} · {run.manufacturer} · lote {run.lotNumber}
                      </div>
                      <div className="text-sm text-neutral-500">{formatLongBR(run.dataMedicao)}</div>
                    </div>
                    <StatusBadge status={run.status} />
                  </div>
                  <div className="mt-3 space-y-2">
                    {run.results.map((result) => (
                      <div key={result.id} className="grid gap-2 text-sm text-neutral-600 sm:grid-cols-[1fr_1fr_1fr_auto]">
                        <div>{result.controlName}</div>
                        <div>Esperado: {resultLabel(result.expectedResult)}</div>
                        <div>Observado: {resultLabel(result.observedResult)}</div>
                        <StatusBadge status={result.status} />
                      </div>
                    ))}
                  </div>
                  {run.notes ? <div className="mt-3 text-sm text-neutral-500">{run.notes}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<ShieldCheck className="h-8 w-8" />}
              title="Nenhuma análise registrada"
              description="Depois do primeiro lançamento, o histórico qualitativo da Imunologia aparece aqui."
            />
          )}
        </Card>
      </div>
    </div>
  )
}

function updateControlItem(
  index: number,
  patch: Partial<ImmunologyControlItemRequest>,
  setControlForm: Dispatch<SetStateAction<ImmunologyControlSetRequest>>,
) {
  setControlForm((current) => ({
    ...current,
    controls: current.controls.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
  }))
}

function addControlItem(setControlForm: Dispatch<SetStateAction<ImmunologyControlSetRequest>>) {
  setControlForm((current) => ({
    ...current,
    controls: [
      ...current.controls,
      { name: `Controle ${current.controls.length + 1}`, expectedResult: 'REAGENTE' },
    ],
  }))
}

function removeControlItem(index: number, setControlForm: Dispatch<SetStateAction<ImmunologyControlSetRequest>>) {
  setControlForm((current) => ({
    ...current,
    controls: current.controls.filter((_, itemIndex) => itemIndex !== index),
  }))
}

function resultLabel(value: string) {
  if (value === 'REAGENTE') return 'Reagente'
  if (value === 'NAO_REAGENTE') return 'Não reagente'
  return value.replace(/_/g, ' ')
}

function formatControlSetLabel(controlSet: ImmunologyControlSet) {
  return `${controlSet.analito} · ${controlSet.manufacturer} · lote ${controlSet.lotNumber}`
}

function formatExpiryState(controlSet: ImmunologyControlSet) {
  const days = diffInDays(todayLocal(), controlSet.validUntil)
  if (days === null) return 'validade sem cálculo'
  if (days < 0) return 'vencido'
  if (days === 0) return 'vence hoje'
  return `${days} dia${days === 1 ? '' : 's'} restantes`
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

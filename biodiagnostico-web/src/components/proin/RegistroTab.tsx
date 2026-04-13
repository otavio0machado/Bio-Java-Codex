import axios from 'axios'
import { Activity, Bot, ChevronDown, ChevronUp, Send, X } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { useUsers } from '../../hooks/useAdmin'
import { useAiAnalysis } from '../../hooks/useAiAnalysis'
import { useMaintenanceRecords } from '../../hooks/useMaintenance'
import { useCreateQcRecord, useQcExams, useQcRecords, useQcReferences } from '../../hooks/useQcRecords'
import type { QcRecord, QcRecordRequest, QcReferenceValue } from '../../types'
import { Button, Card, Input, Modal, Select, Skeleton, StatusBadge, useToast } from '../ui'
import { PostCalibrationModal } from './PostCalibrationModal'
import { VoiceRecorderModal } from './VoiceRecorderModal'

const MarkdownRenderer = lazy(() => import('react-markdown').then((module) => ({ default: module.default })))
const LeveyJenningsChart = lazy(() =>
  import('../charts/LeveyJenningsChart').then((module) => ({ default: module.LeveyJenningsChart })),
)

interface RegistroTabProps {
  area: string
}

interface AiHistoryItem {
  id: string
  prompt: string
  response: string
}

type ReferenceResolutionStatus =
  | 'idle'
  | 'auto'
  | 'manual'
  | 'ambiguous'
  | 'lot_required'
  | 'missing'

interface ReferenceResolution {
  status: ReferenceResolutionStatus
  message: string
  resolvedReference: QcReferenceValue | null
  selectionReferences: QcReferenceValue[]
}

// Nível não é mais selecionável pelo usuário — usa 'Normal' como padrão interno

export function RegistroTab({ area }: RegistroTabProps) {
  const { toast } = useToast()
  const createRecord = useCreateQcRecord()
  const aiMutation = useAiAnalysis()
  const { data: exams = [] } = useQcExams(area)
  const { data: references = [] } = useQcReferences(undefined, true)
  const { data: maintenanceRecords = [] } = useMaintenanceRecords()
  const { data: allUsers = [] } = useUsers()

  const equipmentOptions = useMemo(() => {
    const set = new Set(maintenanceRecords.map((r) => r.equipment).filter(Boolean))
    return Array.from(set).sort()
  }, [maintenanceRecords])

  const analystOptions = useMemo(() => {
    return allUsers.filter((u) => u.isActive).map((u) => u.name).sort()
  }, [allUsers])

  const [createdRecord, setCreatedRecord] = useState<QcRecord | null>(null)
  const [isPostCalibrationOpen, setIsPostCalibrationOpen] = useState(false)
  const [postCalibrationRegistered, setPostCalibrationRegistered] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [aiHistory, setAiHistory] = useState<AiHistoryItem[]>([])
  const [aiPrompt, setAiPrompt] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [form, setForm] = useState<QcRecordRequest>({
    examName: '',
    area,
    date: new Date().toISOString().slice(0, 10),
    level: 'Normal',
    lotNumber: '',
    value: 0,
    targetValue: 0,
    targetSd: 0,
    cvLimit: 10,
    equipment: '',
    analyst: '',
  })

  const datedReferences = useMemo(
    () =>
      references.filter(
        (reference) =>
          reference.isActive &&
          reference.exam?.area === area &&
          (!form.examName || reference.exam.name === form.examName) &&
          isReferenceValidOnDate(reference, form.date),
      ),
    [area, form.date, form.examName, references],
  )
  const currentLotNumber = normalizeNullable(form.lotNumber)
  const compatibleReferences = useMemo(
    () =>
      datedReferences.filter((reference) => {
        if (!currentLotNumber) {
          return true
        }
        const referenceLotNumber = normalizeNullable(reference.lotNumber)
        return referenceLotNumber === null || referenceLotNumber === currentLotNumber
      }),
    [currentLotNumber, datedReferences],
  )
  const referenceResolution = useMemo<ReferenceResolution>(() => {
    if (!form.examName) {
      return {
        status: 'idle',
        message: 'Selecione exame, nível e data para localizar a referência aplicável.',
        resolvedReference: null,
        selectionReferences: [],
      }
    }

    const selectionReferences = currentLotNumber ? compatibleReferences : datedReferences
    const explicitReference = form.referenceId
      ? selectionReferences.find((reference) => reference.id === form.referenceId) ?? null
      : null
    const exactLotReferences = currentLotNumber
      ? compatibleReferences.filter((reference) => normalizeNullable(reference.lotNumber) === currentLotNumber)
      : []
    const genericReferences = compatibleReferences.filter((reference) => normalizeNullable(reference.lotNumber) === null)

    if (explicitReference) {
      return {
        status: 'manual',
        message: `Referência selecionada manualmente: ${formatReferenceSummary(explicitReference)}.`,
        resolvedReference: explicitReference,
        selectionReferences,
      }
    }

    if (currentLotNumber) {
      if (exactLotReferences.length === 1) {
        return {
          status: 'auto',
          message: `Uma referência compatível com o lote informado foi encontrada e será usada: ${formatReferenceSummary(exactLotReferences[0])}.`,
          resolvedReference: exactLotReferences[0],
          selectionReferences,
        }
      }
      if (exactLotReferences.length > 1) {
        return {
          status: 'ambiguous',
          message: 'Mais de uma referência vigente combina com o lote informado. Selecione explicitamente a referência correta.',
          resolvedReference: null,
          selectionReferences,
        }
      }
      if (genericReferences.length === 1) {
        return {
          status: 'auto',
          message: `Nenhuma referência específica de lote foi encontrada; será usada a referência genérica vigente: ${formatReferenceSummary(genericReferences[0])}.`,
          resolvedReference: genericReferences[0],
          selectionReferences,
        }
      }
      if (genericReferences.length > 1) {
        return {
          status: 'ambiguous',
          message: 'Mais de uma referência genérica vigente foi encontrada para este exame e nível. Selecione explicitamente a referência correta.',
          resolvedReference: null,
          selectionReferences,
        }
      }
      return {
        status: 'missing',
        message: 'Nenhuma referência vigente é compatível com o exame, nível, data e lote informados.',
        resolvedReference: null,
        selectionReferences,
      }
    }

    if (genericReferences.length === 1) {
      return {
        status: 'auto',
        message:
          selectionReferences.length > 1
            ? `Uma referência genérica vigente foi encontrada e será usada automaticamente: ${formatReferenceSummary(genericReferences[0])}. Outras referências dependentes de lote continuam disponíveis para seleção explícita.`
            : `Uma única referência vigente foi encontrada e será usada: ${formatReferenceSummary(genericReferences[0])}.`,
        resolvedReference: genericReferences[0],
        selectionReferences,
      }
    }
    if (genericReferences.length > 1) {
      return {
        status: 'ambiguous',
        message: 'Mais de uma referência genérica vigente foi encontrada. Selecione explicitamente a referência correta.',
        resolvedReference: null,
        selectionReferences,
      }
    }
    if (datedReferences.length > 0) {
      return {
        status: 'lot_required',
        message: 'Há referências vigentes dependentes de lote para este exame e nível. Informe o lote do controle ou selecione manualmente a referência correta.',
        resolvedReference: null,
        selectionReferences,
      }
    }
    return {
      status: 'missing',
      message: 'Nenhuma referência vigente foi encontrada para o exame, nível e data informados.',
      resolvedReference: null,
      selectionReferences,
    }
  }, [compatibleReferences, currentLotNumber, datedReferences, form.examName, form.referenceId])
  const resolvedReference = referenceResolution.resolvedReference
  const resolvedLotNumber = normalizeNullable(form.lotNumber) ?? resolvedReference?.lotNumber ?? ''
  const resolvedTargetValue = resolvedReference ? resolvedReference.targetValue : form.targetValue || 0
  const resolvedTargetSd = resolvedReference ? resolvedReference.targetSd : form.targetSd || 0
  const resolvedCvLimit = form.cvLimit || resolvedReference?.cvMaxThreshold || 10

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    if (!form.examName || !form.value) {
      toast.warning('Selecione um exame e informe o valor medido.')
      return
    }
    if (!resolvedReference) {
      toast.warning(referenceResolution.message)
      return
    }

    try {
      const response = await createRecord.mutateAsync({
        ...form,
        area,
        referenceId: resolvedReference.id,
        lotNumber: resolvedLotNumber,
        value: Number(form.value),
        targetValue: Number(resolvedTargetValue),
        targetSd: Number(resolvedTargetSd),
        cvLimit: Number(resolvedCvLimit),
      })
      setCreatedRecord(response)
      setPostCalibrationRegistered(false)
      if (response.status === 'APROVADO') {
        toast.success('Registro aprovado e salvo com sucesso.')
      } else if (response.status === 'ALERTA') {
        toast.warning(
          response.violations.length
            ? `Registro com alerta: ${response.violations.map((item) => item.rule).join(', ')}`
            : 'Registro salvo com alerta.',
        )
      } else {
        toast.error(
          response.violations.length
            ? `Registro reprovado: ${response.violations.map((item) => item.rule).join(', ')}`
            : 'Registro reprovado.',
        )
      }
      if (response.needsCalibration) {
        toast.warning('Registro com pendência corretiva. Clique em "REPROVADO" no histórico para registrar a pós-calibração.')
      }
    } catch (error) {
      const message = getApiErrorMessage(error, 'Não foi possível salvar o registro de CQ.')
      setSubmitError(message)
      toast.error(message)
    }
  }

  const handleAiAnalysis = async () => {
    if (!aiPrompt.trim()) {
      toast.warning('Digite uma pergunta para o assistente de IA.')
      return
    }
    try {
      const response = await aiMutation.mutateAsync({
        prompt: aiPrompt,
        area,
        examName: form.examName || undefined,
        days: 30,
      })
      setAiHistory((current) => [
        { id: crypto.randomUUID(), prompt: aiPrompt, response },
        ...current,
      ])
      setAiPrompt('')
    } catch {
      toast.error('Não foi possível analisar os dados com IA.')
    }
  }

  const { data: allRecords = [], isLoading: isLoadingRecords } = useQcRecords({ area })
  const [chartRecord, setChartRecord] = useState<{ examName: string; level: string } | null>(null)
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true)
  const [postCalibrationRecord, setPostCalibrationRecord] = useState<QcRecord | null>(null)

  return (
    <div className="space-y-6">
    <div className="grid gap-6">
      <Card>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Registro CQ</h3>
            <p className="text-sm text-neutral-500">Lance o valor medido e valide regras de Westgard em tempo real.</p>
          </div>
          <VoiceRecorderModal
            formType="registro"
            title="Preencher registro CQ por voz"
            onApply={(data) => {
              setForm((current) => ({
                ...current,
                examName: typeof data.exam_name === 'string' ? data.exam_name : current.examName,
                value: typeof data.value === 'number' ? data.value : current.value,
                targetValue: typeof data.target_value === 'number' ? data.target_value : current.targetValue,
                equipment: typeof data.equipment === 'string' ? data.equipment : current.equipment,
                analyst: typeof data.analyst === 'string' ? data.analyst : current.analyst,
              }))
            }}
          />
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <Select
            label="Selecionar Exame"
            value={form.examName}
            onChange={(event) => {
              const selectedName = event.target.value
              setForm((current) => ({
                ...current,
                examName: selectedName,
                referenceId: undefined,
                lotNumber: '',
                targetValue: 0,
                targetSd: 0,
                cvLimit: 10,
              }))
            }}
          >
            <option value="">Selecione o exame</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.name}>
                {exam.name}
              </option>
            ))}
          </Select>
          <Input
            label="Data"
            type="date"
            value={form.date}
            onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
          />
          <Input
            label="Medição"
            type="number"
            step="0.01"
            value={String(form.value)}
            onChange={(event) => setForm((current) => ({ ...current, value: Number(event.target.value) }))}
            placeholder="Valor medido"
          />
          <Input
            label="Valor Alvo"
            type="number"
            step="0.01"
            value={String(resolvedTargetValue)}
            onChange={(event) => setForm((current) => ({ ...current, targetValue: Number(event.target.value) }))}
            disabled={Boolean(resolvedReference)}
          />
          <Input
            label="Desvio Padrão"
            type="number"
            step="0.01"
            value={String(resolvedTargetSd)}
            onChange={(event) => setForm((current) => ({ ...current, targetSd: Number(event.target.value) }))}
            disabled={Boolean(resolvedReference)}
          />
          <Input
            label="Variação (CV Limite %)"
            type="number"
            step="0.01"
            value={String(resolvedCvLimit)}
            onChange={(event) => setForm((current) => ({ ...current, cvLimit: Number(event.target.value) }))}
          />
          <Select
            label="Equipamento"
            value={form.equipment}
            onChange={(event) => setForm((current) => ({ ...current, equipment: event.target.value }))}
          >
            <option value="">Selecione o equipamento</option>
            {equipmentOptions.map((eq) => (
              <option key={eq} value={eq}>
                {eq}
              </option>
            ))}
          </Select>
          <Select
            label="Analista"
            value={form.analyst}
            onChange={(event) => setForm((current) => ({ ...current, analyst: event.target.value }))}
          >
            <option value="">Selecione o analista</option>
            {analystOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>

          {(referenceResolution.status !== 'idle' || form.examName) ? (
            <div className="md:col-span-2 space-y-3">
              <div className={getResolutionPanelClasses(referenceResolution.status)}>
                <div className="text-sm font-medium">{referenceResolution.message}</div>
                {resolvedReference ? (
                  <div className="mt-2 text-sm text-neutral-700">
                    Referência em uso: {formatReferenceSummary(resolvedReference)}
                  </div>
                ) : null}
              </div>

              {referenceResolution.selectionReferences.length ? (
                <div className="space-y-2">
                  <Select
                    label="Referência aplicável"
                    value={form.referenceId ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        referenceId: event.target.value || undefined,
                      }))
                    }
                  >
                    <option value="">
                      {resolvedReference
                        ? 'Usar a resolução automática exibida acima'
                        : 'Selecione manualmente a referência correta'}
                    </option>
                    {referenceResolution.selectionReferences.map((reference) => (
                      <option key={reference.id} value={reference.id}>
                        {formatReferenceOption(reference)}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-neutral-500">
                    O backend continua validando exame, área, nível, vigência, lote e referência explícita antes de salvar.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="md:col-span-2">
            <Button type="submit" className="w-full" loading={createRecord.isPending}>
              Salvar Registro
            </Button>
          </div>

          {submitError ? (
            <div className="md:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="font-medium">O backend bloqueou o envio deste registro.</div>
              <div className="mt-1">{submitError}</div>
            </div>
          ) : null}
        </form>

        {createdRecord ? (
          <Card className="mt-6 border border-neutral-200 bg-neutral-50/80 p-5 shadow-none">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h4 className="text-base font-semibold text-neutral-900">Ultimo resultado confirmado pelo backend</h4>
                <p className="text-sm text-neutral-500">
                  Este bloco reflete a decisao canônica retornada pela API para o registro salvo.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={createdRecord.status} />
                {createdRecord.needsCalibration ? (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    Pendencia corretiva ativa
                  </span>
                ) : postCalibrationRegistered ? (
                  <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                    Pos-calibracao registrada
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                    Sem pendencia corretiva
                  </span>
                )}
              </div>
            </div>

            <div className={getDecisionPanelClasses(createdRecord.status, createdRecord.needsCalibration, postCalibrationRegistered)}>
              <div className="text-sm font-medium">{getDecisionMessage(createdRecord, postCalibrationRegistered)}</div>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-neutral-700 md:grid-cols-2 xl:grid-cols-4">
              <DecisionMetric label="Valor medido" value={createdRecord.value.toFixed(2)} />
              <DecisionMetric label="Valor alvo" value={createdRecord.targetValue.toFixed(2)} />
              <DecisionMetric label="CV (%)" value={createdRecord.cv.toFixed(2)} />
              <DecisionMetric label="Z-Score" value={createdRecord.zScore.toFixed(2)} />
              <DecisionMetric label="Lote aplicado" value={createdRecord.lotNumber ?? 'Nao informado'} />
              <DecisionMetric label="Analista" value={createdRecord.analyst ?? 'Nao informado'} />
              <DecisionMetric label="Equipamento" value={createdRecord.equipment ?? 'Nao informado'} />
              <DecisionMetric label="Referencia validada" value={createdRecord.referenceId ? 'Sim' : 'Nao'} />
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium text-neutral-900">Violacoes devolvidas pelo backend</div>
              {createdRecord.violations.length ? (
                <div className="mt-2 space-y-2">
                  {createdRecord.violations.map((violation) => (
                    <div key={`${violation.rule}-${violation.description}`} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900">{violation.rule}</span>
                        <span className={getViolationSeverityClasses(violation.severity)}>
                          {violation.severity === 'REJECTION' ? 'Rejeicao' : 'Alerta'}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-neutral-600">{violation.description}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  Nenhuma violacao de Westgard foi retornada para este registro.
                </div>
              )}
            </div>
          </Card>
        ) : null}
      </Card>

      <PostCalibrationModal
        key={postCalibrationRecord ? `hist-${postCalibrationRecord.id}` : createdRecord ? `created-${createdRecord.id}-${isPostCalibrationOpen ? 'o' : 'c'}` : 'none'}
        record={postCalibrationRecord ?? createdRecord}
        isOpen={postCalibrationRecord !== null || isPostCalibrationOpen}
        onClose={() => {
          setPostCalibrationRecord(null)
          setIsPostCalibrationOpen(false)
        }}
        onSaved={() => {
          if (postCalibrationRecord) {
            setPostCalibrationRecord(null)
            toast.success('Pós-calibração registrada com sucesso.')
          } else {
            setPostCalibrationRegistered(true)
            setCreatedRecord((current) => (current ? { ...current, needsCalibration: false } : current))
            setIsPostCalibrationOpen(false)
          }
        }}
      />
    </div>

      <Card>
        <button
          type="button"
          className="flex w-full items-center justify-between"
          onClick={() => setIsHistoryExpanded((v) => !v)}
        >
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Histórico de Registros CQ</h3>
            <p className="text-sm text-neutral-500">
              {allRecords.length} registro{allRecords.length !== 1 ? 's' : ''} encontrado{allRecords.length !== 1 ? 's' : ''}
            </p>
          </div>
          {isHistoryExpanded
            ? <ChevronUp className="h-5 w-5 text-neutral-400" />
            : <ChevronDown className="h-5 w-5 text-neutral-400" />}
        </button>

        {isHistoryExpanded ? (
          isLoadingRecords ? (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-neutral-100" />
              ))}
            </div>
          ) : allRecords.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
              Nenhum registro CQ encontrado para esta área.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-xs uppercase tracking-wider text-neutral-500">
                    <th className="px-3 py-2.5">Data</th>
                    <th className="px-3 py-2.5">Exame</th>
                    <th className="px-3 py-2.5">Nível</th>
                    <th className="px-3 py-2.5">Valor</th>
                    <th className="px-3 py-2.5">Alvo</th>
                    <th className="px-3 py-2.5">CV%</th>
                    <th className="px-3 py-2.5">Z-Score</th>
                    <th className="px-3 py-2.5">Lote</th>
                    <th className="px-3 py-2.5">Analista</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Violações</th>
                    <th className="px-3 py-2.5 text-center">Gráfico</th>
                  </tr>
                </thead>
                <tbody>
                  {allRecords.map((record) => (
                    <tr key={record.id} className="border-b border-neutral-50 hover:bg-neutral-50/50">
                      <td className="whitespace-nowrap px-3 py-2.5 text-neutral-700">
                        {formatRecordDate(record.date)}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-neutral-900">{record.examName}</td>
                      <td className="px-3 py-2.5 text-neutral-600">{record.level}</td>
                      <td className="px-3 py-2.5 font-mono text-neutral-900">{record.value.toFixed(2)}</td>
                      <td className="px-3 py-2.5 font-mono text-neutral-600">{record.targetValue.toFixed(2)}</td>
                      <td className="px-3 py-2.5 font-mono text-neutral-600">{record.cv.toFixed(2)}</td>
                      <td className="px-3 py-2.5 font-mono text-neutral-600">{record.zScore.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-neutral-600">{record.lotNumber ?? '—'}</td>
                      <td className="px-3 py-2.5 text-neutral-600">{record.analyst ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        {record.needsCalibration ? (
                          <button
                            type="button"
                            className="group flex items-center gap-1"
                            title="Clique para registrar pós-calibração"
                            onClick={() => setPostCalibrationRecord(record)}
                          >
                            <StatusBadge status={record.status} />
                            <span className="text-[10px] text-amber-600 opacity-0 transition group-hover:opacity-100">
                              calibrar
                            </span>
                          </button>
                        ) : (
                          <StatusBadge status={record.status} />
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {record.violations.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {record.violations.map((v) => (
                              <span
                                key={`${record.id}-${v.rule}`}
                                className={v.severity === 'REJECTION'
                                  ? 'inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800'
                                  : 'inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800'}
                              >
                                {v.rule}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-green-700 transition hover:bg-green-50"
                          title={`Gráfico Levey-Jennings: ${record.examName} · ${record.level}`}
                          onClick={() => setChartRecord({ examName: record.examName, level: record.level })}
                        >
                          <Activity className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </Card>

      <Modal
        isOpen={chartRecord !== null}
        onClose={() => setChartRecord(null)}
        title={chartRecord ? `Levey-Jennings — ${chartRecord.examName} · ${chartRecord.level}` : ''}
        size="lg"
      >
        {chartRecord ? (
          <>
            <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Últimos 30 registros canônicos de CQ para <strong>{chartRecord.examName}</strong> · nível <strong>{chartRecord.level}</strong>.
              Eventos de pós-calibração não entram nesta curva.
            </div>
            <Suspense fallback={<Skeleton height="24rem" />}>
              <LeveyJenningsChart examName={chartRecord.examName} level={chartRecord.level} area={area} />
            </Suspense>
          </>
        ) : null}
      </Modal>

      {/* Floating AI Chat */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {isChatOpen ? (
          <div className="mb-3 flex w-[22rem] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-green-700" />
                <span className="text-sm font-semibold text-neutral-900">Assistente IA</span>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="rounded-lg p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex max-h-80 flex-1 flex-col-reverse gap-3 overflow-y-auto p-4">
              {aiHistory.length === 0 ? (
                <p className="text-center text-sm text-neutral-400">
                  Pergunte sobre tendências, alertas e recomendações de CQ.
                </p>
              ) : (
                aiHistory.map((item) => (
                  <div key={item.id} className="space-y-1.5">
                    <div className="ml-auto max-w-[85%] rounded-xl bg-green-50 px-3 py-2 text-sm text-green-900">
                      {item.prompt}
                    </div>
                    <div className="max-w-[85%] rounded-xl bg-neutral-50 px-3 py-2">
                      <div className="prose prose-sm max-w-none text-neutral-700">
                        <Suspense fallback={<div className="whitespace-pre-wrap text-sm">{item.response}</div>}>
                          <MarkdownRenderer>{item.response}</MarkdownRenderer>
                        </Suspense>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-neutral-100 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAiAnalysis()
                    }
                  }}
                  placeholder="Ex.: Há tendência de desvio?"
                  rows={1}
                  className="max-h-24 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-green-400 focus:ring-1 focus:ring-green-400"
                />
                <button
                  type="button"
                  onClick={handleAiAnalysis}
                  disabled={aiMutation.isPending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-700 text-white transition hover:bg-green-800 disabled:opacity-50"
                >
                  {aiMutation.isPending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setIsChatOpen((v) => !v)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-green-700 text-white shadow-lg transition hover:bg-green-800 hover:shadow-xl"
          title="Assistente IA"
        >
          {isChatOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
        </button>
      </div>
    </div>
  )
}

function isReferenceValidOnDate(reference: QcReferenceValue, referenceDate: string) {
  const effectiveDate = referenceDate || new Date().toISOString().slice(0, 10)
  const validFrom = normalizeDate(reference.validFrom)
  const validUntil = normalizeDate(reference.validUntil)
  return (!validFrom || validFrom <= effectiveDate) && (!validUntil || validUntil >= effectiveDate)
}

function normalizeDate(value?: string) {
  return value ? value.slice(0, 10) : null
}

function normalizeNullable(value?: string | null) {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  return trimmed ? trimmed.toLowerCase() : null
}

function formatReferenceSummary(reference: QcReferenceValue) {
  const lot = reference.lotNumber?.trim() ? `lote ${reference.lotNumber}` : 'sem lote definido'
  const validFrom = normalizeDate(reference.validFrom)
  const validUntil = normalizeDate(reference.validUntil)
  const validity = validUntil
    ? `${validFrom ?? 'sem início'} até ${validUntil}`
    : validFrom
      ? `a partir de ${validFrom}`
      : 'sem janela de validade definida'
  return `${reference.name} (${reference.exam.name} · ${reference.level} · ${lot} · ${validity})`
}

function formatReferenceOption(reference: QcReferenceValue) {
  const lot = reference.lotNumber?.trim() ? `Lote ${reference.lotNumber}` : 'Sem lote'
  const validUntil = normalizeDate(reference.validUntil)
  return `${reference.name} · ${lot} · ${validUntil ? `até ${validUntil}` : 'sem validade final'}`
}

function getResolutionPanelClasses(status: ReferenceResolutionStatus) {
  switch (status) {
    case 'auto':
    case 'manual':
      return 'rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-900'
    case 'ambiguous':
    case 'lot_required':
      return 'rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900'
    case 'missing':
      return 'rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-900'
    default:
      return 'rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-700'
  }
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

function getDecisionPanelClasses(status: QcRecord['status'], needsCalibration: boolean, postCalibrationRegistered: boolean) {
  if (postCalibrationRegistered) {
    return 'mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900'
  }
  if (needsCalibration) {
    return 'mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900'
  }
  if (status === 'REPROVADO') {
    return 'mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-900'
  }
  if (status === 'ALERTA') {
    return 'mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900'
  }
  return 'mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-900'
}

function getDecisionMessage(record: QcRecord, postCalibrationRegistered: boolean) {
  if (postCalibrationRegistered) {
    return `A acao corretiva vinculada a este evento foi registrada. O status original permanece ${record.status}.`
  }
  if (record.needsCalibration) {
    return 'Existe uma pendencia corretiva ativa. O pos-calibracao encerra a pendencia, mas nao altera o resultado original do CQ.'
  }
  if (record.status === 'REPROVADO') {
    return 'O backend manteve este evento como reprovado, sem pendencia corretiva ativa no momento.'
  }
  if (record.status === 'ALERTA') {
    return 'O backend salvou o evento com alerta. Acompanhe as violacoes retornadas abaixo.'
  }
  return 'O backend aprovou este registro e nao indicou pendencia corretiva ativa.'
}

function getViolationSeverityClasses(severity: string) {
  if (severity === 'REJECTION') {
    return 'inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800'
  }
  return 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800'
}

function formatRecordDate(date: string) {
  try {
    return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return date
  }
}

function DecisionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  )
}

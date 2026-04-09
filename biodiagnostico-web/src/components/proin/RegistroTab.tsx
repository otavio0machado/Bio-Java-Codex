import axios from 'axios'
import { Bot, Sparkles } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { useAiAnalysis } from '../../hooks/useAiAnalysis'
import { useCreateQcRecord, useQcExams, useQcReferences } from '../../hooks/useQcRecords'
import type { QcRecord, QcRecordRequest, QcReferenceValue } from '../../types'
import { Button, Card, Input, Select, StatusBadge, TextArea, useToast } from '../ui'
import { PostCalibrationModal } from './PostCalibrationModal'
import { VoiceRecorderModal } from './VoiceRecorderModal'

const MarkdownRenderer = lazy(() => import('react-markdown').then((module) => ({ default: module.default })))

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

const levels = ['Normal', 'Patológico', 'Alto', 'Baixo']

export function RegistroTab({ area }: RegistroTabProps) {
  const { toast } = useToast()
  const createRecord = useCreateQcRecord()
  const aiMutation = useAiAnalysis()
  const { data: exams = [] } = useQcExams(area)
  const { data: references = [] } = useQcReferences(undefined, true)

  const [createdRecord, setCreatedRecord] = useState<QcRecord | null>(null)
  const [isPostCalibrationOpen, setIsPostCalibrationOpen] = useState(false)
  const [postCalibrationRegistered, setPostCalibrationRegistered] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [aiHistory, setAiHistory] = useState<AiHistoryItem[]>([])
  const [aiPrompt, setAiPrompt] = useState('')
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
          (!form.level || reference.level === form.level) &&
          isReferenceValidOnDate(reference, form.date),
      ),
    [area, form.date, form.examName, form.level, references],
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
        toast.warning('Existe uma pendência corretiva ativa. Registre a pós-calibração para encerrar essa pendência.')
        setIsPostCalibrationOpen(true)
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

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
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
            label="Exame"
            value={form.examName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                examName: event.target.value,
                referenceId: undefined,
                lotNumber: '',
                targetValue: 0,
                targetSd: 0,
                cvLimit: 10,
              }))
            }
          >
            <option value="">Selecione</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.name}>
                {exam.name}
              </option>
            ))}
          </Select>
          <Select
            label="Nível"
            value={form.level}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                level: event.target.value,
                referenceId: undefined,
                lotNumber: '',
                targetValue: 0,
                targetSd: 0,
                cvLimit: 10,
              }))
            }
          >
            {levels.map((level) => (
              <option key={level} value={level}>
                {level}
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
            label="Valor medido"
            type="number"
            step="0.01"
            value={String(form.value)}
            onChange={(event) => setForm((current) => ({ ...current, value: Number(event.target.value) }))}
          />
          <Input
            label="Valor alvo"
            type="number"
            step="0.01"
            value={String(resolvedTargetValue)}
            onChange={(event) => setForm((current) => ({ ...current, targetValue: Number(event.target.value) }))}
            disabled={Boolean(resolvedReference)}
          />
          <Input
            label="Desvio padrão alvo"
            type="number"
            step="0.01"
            value={String(resolvedTargetSd)}
            onChange={(event) => setForm((current) => ({ ...current, targetSd: Number(event.target.value) }))}
            disabled={Boolean(resolvedReference)}
          />
          <Input
            label="CV Limite %"
            type="number"
            step="0.01"
            value={String(resolvedCvLimit)}
            onChange={(event) => setForm((current) => ({ ...current, cvLimit: Number(event.target.value) }))}
          />
          <Input
            label="Equipamento"
            value={form.equipment}
            onChange={(event) => setForm((current) => ({ ...current, equipment: event.target.value }))}
          />
          <Input
            label="Analista"
            value={form.analyst}
            onChange={(event) => setForm((current) => ({ ...current, analyst: event.target.value }))}
          />
          <Input
            label="Lote"
            value={resolvedLotNumber}
            onChange={(event) => setForm((current) => ({ ...current, lotNumber: event.target.value }))}
          />

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

      <div className="space-y-6">
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-3 text-green-800">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Assistente IA</h3>
              <p className="text-sm text-neutral-500">Pergunte sobre tendências, alertas e recomendações.</p>
            </div>
          </div>

          <TextArea
            label="Pergunta"
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            placeholder="Ex.: Há tendência de desvio sistemático para este exame?"
          />
          <Button className="mt-4 w-full" onClick={handleAiAnalysis} loading={aiMutation.isPending} icon={<Bot className="h-4 w-4" />}>
            Analisar com IA
          </Button>
        </Card>

        <div className="space-y-4">
          {aiHistory.map((item) => (
            <Card key={item.id}>
              <div className="mb-3 text-sm font-medium text-neutral-500">{item.prompt}</div>
              <div className="prose prose-sm max-w-none text-neutral-700">
                <Suspense fallback={<div className="whitespace-pre-wrap text-sm text-neutral-700">{item.response}</div>}>
                  <MarkdownRenderer>{item.response}</MarkdownRenderer>
                </Suspense>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <PostCalibrationModal
        key={createdRecord ? `${createdRecord.id}-${isPostCalibrationOpen ? 'open' : 'closed'}` : 'no-record'}
        record={createdRecord}
        isOpen={isPostCalibrationOpen}
        onClose={() => setIsPostCalibrationOpen(false)}
        onSaved={() => {
          setPostCalibrationRegistered(true)
          setCreatedRecord((current) => (current ? { ...current, needsCalibration: false } : current))
          setIsPostCalibrationOpen(false)
        }}
      />
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

function DecisionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  )
}

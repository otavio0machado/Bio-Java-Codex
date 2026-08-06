import axios from 'axios'
import { Activity, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, CircleX, Layers, Microscope, Search, Sparkles, Trash2, X, XCircle } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCreateQcBatch, useCreateQcRecord, useQcExams, useQcRecords, useQcReferences } from '../../hooks/useQcRecords'
import { useAuth } from '../../hooks/useAuth'
import { useExplainQc, useRootCause, useValidateBatch } from '../../hooks/useAiAssist'
import { canImport } from '../../lib/permissions'
import { formatQcExamOption, getVisibleQcExams } from '../../lib/qcAreas'
import { qcService } from '../../services/qcService'
import type { QcRecord, QcRecordRequest, QcReferenceValue, ValidateBatchRow } from '../../types'
import { Button, Card, Input, Modal, Select, Skeleton, StatusBadge, useToast } from '../ui'
import { AiAssistResult } from './AiAssistShared'
import { BatchValidationPanel } from './BatchValidationPanel'
import { PostCalibrationModal } from './PostCalibrationModal'
import { ExamHistoryModal } from './ExamHistoryModal'
import { getOperationalReferences, pickRecommendedReference, rankOperationalReferences } from './qcReferenceResolution'

const LeveyJenningsChart = lazy(() =>
  import('../charts/LeveyJenningsChart').then((module) => ({ default: module.LeveyJenningsChart })),
)

interface RegistroTabProps {
  area: string
}

interface WestgardInfo {
  title: string
  detail: string
  action: string
}

const WESTGARD_INFO: Record<string, WestgardInfo> = {
  '1-2s': {
    title: 'Valor fora da faixa de alerta (±2 DP)',
    detail: 'Apenas um controle excedeu 2 desvios padrão.',
    action: 'Alerta preventivo: pode liberar o resultado, mas observe a próxima corrida.',
  },
  '1-3s': {
    title: 'Valor fora da faixa crítica (±3 DP)',
    detail: 'Erro aleatório: o valor está muito distante do alvo.',
    action: 'Não libere resultados. Recalibre e refaça o CQ antes de continuar.',
  },
  '2-2s': {
    title: 'Dois controles seguidos fora de ±2 DP',
    detail: 'Erro sistemático: padrão de desvio persistente.',
    action: 'Verifique calibração/reagente. Refaça o CQ antes de liberar resultados.',
  },
  'R-4s': {
    title: 'Diferença entre controles maior que 4 DP',
    detail: 'Erro aleatório grave entre corridas consecutivas.',
    action: 'Não libere resultados. Recalibre e refaça o CQ.',
  },
  '4-1s': {
    title: 'Quatro controles seguidos fora de ±1 DP',
    detail: 'Tendência persistente — possível erro sistemático leve.',
    action: 'Inspecione reagente, calibração e condições antes do próximo lote.',
  },
  '10x': {
    title: 'Dez controles seguidos do mesmo lado da média',
    detail: 'Viés sistemático detectado.',
    action: 'Revise calibração, reagente e armazenamento. Refaça o CQ.',
  },
  'SD=0': {
    title: 'Desvio padrão zerado na referência',
    detail: 'A referência está sem DP, o cálculo Westgard não é confiável.',
    action: 'Ajuste o DP na aba Referências antes de registrar novos valores.',
  },
}

function getWestgardInfo(rule: string): WestgardInfo {
  return WESTGARD_INFO[rule] ?? {
    title: rule,
    detail: 'Regra Westgard acionada.',
    action: 'Verifique o controle antes de liberar resultados.',
  }
}

const today = () => new Date().toISOString().slice(0, 10)

function calcCv(value: number, target: number) {
  if (!target) return 0
  return (Math.abs(value - target) / Math.abs(target)) * 100
}

export function RegistroTab({ area }: RegistroTabProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const canUseBatch = canImport(user)
  const queryClient = useQueryClient()
  const createRecord = useCreateQcRecord()
  const createBatch = useCreateQcBatch()
  const validateBatch = useValidateBatch()
  const { data: fetchedExams = [] } = useQcExams(area)
  const exams = useMemo(() => getVisibleQcExams(fetchedExams, area), [area, fetchedExams])
  const { data: references = [] } = useQcReferences({ area, activeOnly: true })

  // --- Undo delete ---
  const [deletedRecord, setDeletedRecord] = useState<{ request: QcRecordRequest; timeout: number } | null>(null)

  // --- Batch mode ---
  const [batchMode, setBatchMode] = useState(false)
  const [batchRows, setBatchRows] = useState<Array<{
    examName: string; value: string; targetValue: string; targetSd: string; cvLimit: string
  }>>([{ examName: '', value: '', targetValue: '', targetSd: '', cvLimit: '10' }])

  // --- Estado do formulario ---
  const emptyForm: QcRecordRequest = {
    examName: '', area, date: today(), level: 'Normal',
    lotNumber: '', value: 0, targetValue: 0, targetSd: 0,
    cvLimit: 10, equipment: '', analyst: '',
  }
  const [form, setForm] = useState<QcRecordRequest>(emptyForm)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<QcRecord | null>(null)

  // --- Pos-calibracao ---
  const [postCalRecord, setPostCalRecord] = useState<QcRecord | null>(null)
  const [isPostCalOpen, setIsPostCalOpen] = useState(false)
  const [lastCreated, setLastCreated] = useState<QcRecord | null>(null)

  // --- Historico ---
  const [historyDate, setHistoryDate] = useState(today())
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const { data: allRecords = [], isLoading } = useQcRecords({ area })
  const [chartRecord, setChartRecord] = useState<{ examName: string; level: string } | null>(null)
  const [historyExam, setHistoryExam] = useState<{ examName: string; level: string | null } | null>(null)
  const [explainRecord, setExplainRecord] = useState<QcRecord | null>(null)

  // --- Resolucao de referencia (B4: sugestao deterministica, nao bloqueia) ---
  const referenceCandidates = useMemo(
    () => getOperationalReferences(references, area, form.examName, form.date),
    [area, form.date, form.examName, references],
  )

  // Candidatas ranqueadas pela heuristica deterministica (ver qcReferenceResolution).
  const rankedCandidates = useMemo(
    () => rankOperationalReferences(referenceCandidates, form.date),
    [referenceCandidates, form.date],
  )

  // Override manual: o usuario pode trocar a referencia recomendada.
  // Guardamos so o id; o efetivo e derivado durante o render contra as
  // candidatas atuais. Se o id deixar de ser candidato (troca de exame/data),
  // a derivacao cai automaticamente na recomendada — sem precisar resetar
  // estado em useEffect (evita o warning react-hooks/set-state-in-effect).
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null)

  // Quando ha ambiguidade, recomendamos o topo do ranking; com 1 candidata,
  // ela mesma; com 0, nenhuma. O override so vale se ainda for candidata valida.
  const recommendedRef = useMemo<QcReferenceValue | null>(
    () => pickRecommendedReference(rankedCandidates, form.date),
    [rankedCandidates, form.date],
  )

  const resolvedRef = useMemo<QcReferenceValue | null>(() => {
    if (rankedCandidates.length === 0) return null
    if (selectedRefId) {
      const chosen = rankedCandidates.find((ref) => ref.id === selectedRefId)
      if (chosen) return chosen
    }
    return recommendedRef
  }, [rankedCandidates, recommendedRef, selectedRefId])

  // Ha ambiguidade quando mais de uma referencia vigente atende exame+nivel.
  const hasAmbiguity = rankedCandidates.length > 1

  const targetValue = resolvedRef ? resolvedRef.targetValue : form.targetValue || 0
  const targetSd = resolvedRef ? resolvedRef.targetSd : form.targetSd || 0
  const cvLimit = form.cvLimit || resolvedRef?.cvMaxThreshold || 10

  // Variacao percentual em tempo real
  const liveCv = calcCv(Number(form.value), targetValue)
  const cvOk = liveCv <= cvLimit

  // Filtro de historico por dia
  const filteredRecords = useMemo(() => {
    return allRecords
      .filter((r) => r.date === historyDate)
      .filter((r) => !searchTerm || r.examName.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter((r) => {
        if (statusFilter === 'Todos') return true
        if (statusFilter === 'OK') return r.status === 'APROVADO'
        if (statusFilter === 'ALERTA') return r.status === 'ALERTA'
        if (statusFilter === 'ERRO') return r.status === 'REPROVADO'
        return true
      })
  }, [allRecords, historyDate, searchTerm, statusFilter])

  const clearMessages = () => { setFeedback(null); setSubmitError(null) }

  const clearForm = () => {
    setForm(emptyForm)
    clearMessages()
  }

  const handleSubmit = async () => {
    // Trava anti-duplo-submit: ignora cliques enquanto a gravacao esta em voo.
    if (createRecord.isPending) return
    clearMessages()
    if (!form.examName || !form.value) {
      toast.warning('Selecione um exame e informe o valor.')
      return
    }
    if (!resolvedRef) {
      setSubmitError('Cadastre uma referência para este exame antes de registrar.')
      return
    }
    const ref = resolvedRef
    const payload: QcRecordRequest = {
      ...form, area, referenceId: ref.id,
      lotNumber: form.lotNumber?.trim() || ref.lotNumber?.trim() || '',
      value: Number(form.value), targetValue: targetValue,
      targetSd: targetSd, cvLimit: cvLimit,
    }

    try {
      const response = await createRecord.mutateAsync(payload)
      setLastCreated(response)
      setFeedback(response)
      if (response.referenceWarning) {
        toast.warning(response.referenceWarning)
      }
      setForm({ ...emptyForm, equipment: form.equipment, analyst: form.analyst })
    } catch (error) {
      const msg = axios.isAxiosError(error) && error.response?.data?.message
        ? error.response.data.message : 'Erro ao salvar registro.'
      setSubmitError(msg)
      toast.error(msg)
    }
  }

  const shiftDay = (delta: number) => {
    const d = new Date(historyDate + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setHistoryDate(d.toISOString().slice(0, 10))
  }

  const loadRecords = () => {
    void queryClient.invalidateQueries({ queryKey: ['qc-records'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  // --- Undo delete handlers ---
  const handleDeleteRecord = async (record: QcRecord) => {
    try {
      await qcService.deleteRecord(record.id)
      const undoRequest: QcRecordRequest = {
        examName: record.examName, area: record.area, date: record.date,
        level: record.level, lotNumber: record.lotNumber ?? '',
        value: record.value, targetValue: record.targetValue,
        targetSd: record.targetSd, cvLimit: record.cvLimit,
        equipment: record.equipment ?? '', analyst: record.analyst ?? '',
        referenceId: record.referenceId ?? undefined,
      }
      if (deletedRecord?.timeout) window.clearTimeout(deletedRecord.timeout)
      const timeout = window.setTimeout(() => setDeletedRecord(null), 5000)
      setDeletedRecord({ request: undoRequest, timeout })
      loadRecords()
    } catch { toast.error('Erro ao excluir registro.') }
  }

  const handleUndo = async () => {
    if (!deletedRecord) return
    window.clearTimeout(deletedRecord.timeout)
    try {
      await qcService.createRecord(deletedRecord.request)
      setDeletedRecord(null)
      loadRecords()
      toast.success('Registro restaurado.')
    } catch { toast.error('Erro ao restaurar registro.') }
  }

  // Define o exame de uma linha do lote e re-resolve alvo/DP/limite de variacao a partir da
  // referencia (mesma logica do <select> da linha). Usado pelo seletor e pelo
  // "Aplicar" da validacao por IA, para manter o comportamento identico.
  const setBatchRowExam = (rowIndex: number, examName: string) => {
    const matchingRefs = getOperationalReferences(references, area, examName, form.date)
    setBatchRows(prev => prev.map((r, idx) => {
      if (idx !== rowIndex) return r
      if (matchingRefs.length === 1) {
        const ref = matchingRefs[0]
        return {
          ...r, examName,
          targetValue: String(ref.targetValue ?? ''),
          targetSd: String(ref.targetSd ?? ''),
          cvLimit: String(ref.cvMaxThreshold ?? '10'),
        }
      }
      return { ...r, examName, targetValue: '', targetSd: '', cvLimit: '10' }
    }))
  }

  // --- B5: validacao assistiva do lote (read-only, antes de submeter) ---
  // O backend devolve `row` como indice na LISTA ENVIADA. Como filtramos linhas
  // vazias antes de enviar, guardamos o mapa indice-enviado -> indice no
  // batchRows original, para o "Aplicar" corrigir a linha certa do formulario.
  const [validatedRowMap, setValidatedRowMap] = useState<number[]>([])

  const handleValidateBatch = () => {
    if (validateBatch.isPending) return
    const toNumberOrNull = (raw: string): number | null => {
      const trimmed = raw.trim()
      if (trimmed === '') return null
      const parsed = Number(trimmed)
      return Number.isFinite(parsed) ? parsed : null
    }
    // Mantem so linhas com algum conteudo (exame ou valor); preserva o indice
    // original de cada uma para o mapeamento de volta.
    const indexed = batchRows
      .map((r, originalIndex) => ({ r, originalIndex }))
      .filter(({ r }) => r.examName.trim() || r.value.trim())
    if (indexed.length === 0) {
      toast.warning('Preencha ao menos uma linha (exame ou valor) para validar.')
      return
    }
    const rows: ValidateBatchRow[] = indexed.map(({ r }) => ({
      examName: r.examName.trim() || null,
      level: 'Normal',
      value: toNumberOrNull(r.value),
      targetValue: toNumberOrNull(r.targetValue),
      targetSd: toNumberOrNull(r.targetSd),
      cvLimit: toNumberOrNull(r.cvLimit),
    }))
    setValidatedRowMap(indexed.map(({ originalIndex }) => originalIndex))
    validateBatch.mutate({ area, rows })
  }

  // Aplica um nome de exame sugerido pela IA a uma linha. So edita o formulario;
  // nada e importado. Traduz o indice da lista enviada de volta para o batchRows.
  const handleApplyExamName = (sentRow: number, examName: string) => {
    const originalIndex = validatedRowMap[sentRow] ?? sentRow
    setBatchRowExam(originalIndex, examName)
    toast.success(`Exame da linha ${originalIndex + 1} ajustado para ${examName}. Revise antes de registrar.`)
  }

  // --- Batch submit handler ---
  const handleBatchSubmit = async () => {
    // Trava anti-duplo-submit: ignora cliques enquanto o lote esta em voo.
    if (createBatch.isPending) return
    const validRows = batchRows.filter(r => r.examName && r.value)
    if (validRows.length === 0) return
    const referenceErrors = validRows
      .map((row, index) => {
        const candidates = getOperationalReferences(references, area, row.examName, form.date)
        if (candidates.length === 0) {
          return `Linha ${index + 1}: cadastre uma referência ativa para ${row.examName} antes de registrar.`
        }
        if (candidates.length > 1) {
          return `Linha ${index + 1}: há mais de uma referência ativa para ${row.examName}; revise a aba Referências.`
        }
        return null
      })
      .filter((message): message is string => Boolean(message))
    if (referenceErrors.length > 0) {
      toast.error(referenceErrors[0])
      return
    }
    const requests: QcRecordRequest[] = validRows.map(row => {
      const reference = getOperationalReferences(references, area, row.examName, form.date)[0]
      return {
        examName: row.examName,
        area,
        date: form.date || new Date().toISOString().slice(0, 10),
        level: 'Normal',
        lotNumber: reference?.lotNumber?.trim() || '',
        value: parseFloat(row.value),
        targetValue: parseFloat(row.targetValue) || 0,
        targetSd: parseFloat(row.targetSd) || 0,
        cvLimit: parseFloat(row.cvLimit) || 10,
        equipment: form.equipment || '',
        analyst: form.analyst || '',
        referenceId: reference?.id,
      }
    })
    try {
      const result = await createBatch.mutateAsync(requests)
      const firstFailure = result.results.find((rowResult) => !rowResult.success)?.message
      const successLabel = `${result.successCount} ${result.successCount === 1 ? 'registro criado' : 'registros criados'}`
      const failureLabel = `${result.failureCount} ${result.failureCount === 1 ? 'linha falhou' : 'linhas falharam'}`
      if (result.failureCount === 0) {
        toast.success(`${successLabel} com sucesso!`)
        setBatchRows([{ examName: '', value: '', targetValue: '', targetSd: '', cvLimit: '10' }])
      } else {
        const detail = firstFailure ? ` Primeira falha: ${firstFailure}` : ''
        if (result.successCount > 0) {
          toast.warning(`${successLabel}; ${failureLabel}.${detail}`)
        } else {
          toast.error(`Nenhum registro foi criado; ${failureLabel}.${detail}`)
        }
        const failedIndexes = new Set(
          result.results.filter((rowResult) => !rowResult.success).map((rowResult) => rowResult.rowIndex),
        )
        setBatchRows(validRows.filter((_, index) => failedIndexes.has(index)))
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? err.response.data.message : 'Erro ao criar registros em lote.'
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">Registro de CQ</h3>
            <p className="text-base text-neutral-500">Insira os dados diários para cálculo automático da Variação %</p>
          </div>
          <div className="flex items-center gap-2">
            {canUseBatch ? (
              <button onClick={() => setBatchMode(!batchMode)}
                className={`rounded-full px-3 py-1 text-sm ${batchMode ? 'bg-green-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                {batchMode ? 'Modo Normal' : 'Modo Planilha'}
              </button>
            ) : null}
          </div>
        </div>

        {canUseBatch && batchMode ? (
          /* --- Batch / Planilha Mode --- */
          <div className="space-y-3">
            {/* Shared fields: date, equipment, analyst */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="Data" type="date" value={form.date} onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))} />
              <Input label="Equipamento" placeholder="Ex: Cobas c111" value={form.equipment} onChange={(e) => setForm((c) => ({ ...c, equipment: e.target.value }))} />
              <Input label="Analista" placeholder="Nome do analista" value={form.analyst} onChange={(e) => setForm((c) => ({ ...c, analyst: e.target.value }))} />
            </div>

            {/* Batch grid header */}
            <div className="grid grid-cols-[1fr_100px_100px_100px_100px_40px] gap-2 text-xs font-medium text-neutral-500 px-1">
              <span>Exame</span><span>Valor</span><span>Alvo</span><span>DP</span><span>Lim. var. %</span><span></span>
            </div>

            {/* Batch rows */}
            {batchRows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_100px_100px_100px_40px] gap-2 items-center">
                <select aria-label={`Exame da linha ${i + 1}`} value={row.examName} onChange={e => setBatchRowExam(i, e.target.value)}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm">
                  <option value="">Selecione...</option>
                  {exams.map(e => <option key={e.id} value={e.name}>{formatQcExamOption(area, e)}</option>)}
                </select>
                <input aria-label={`Valor da linha ${i + 1}`} type="number" step="0.01" value={row.value}
                  onChange={e => setBatchRows(prev => prev.map((r, idx) => idx === i ? { ...r, value: e.target.value } : r))}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm" placeholder="0.00" />
                <input type="number" step="0.01" value={row.targetValue} disabled
                  className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm text-neutral-500" />
                <input type="number" step="0.01" value={row.targetSd} disabled
                  className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm text-neutral-500" />
                <input type="number" step="0.01" value={row.cvLimit} disabled
                  className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm text-neutral-500" />
                <button onClick={() => setBatchRows(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)}
                  className="text-red-400 hover:text-red-600 text-lg" title="Remover linha">&times;</button>
              </div>
            ))}

            <div className="flex gap-2">
              <button onClick={() => setBatchRows(prev => [...prev, { examName: '', value: '', targetValue: '', targetSd: '', cvLimit: '10' }])}
                className="text-sm text-green-700 hover:text-green-800 underline">
                + Adicionar linha
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleBatchSubmit}
                loading={createBatch.isPending}
                disabled={batchRows.every(r => !r.examName || !r.value)}
              >
                Registrar Todos ({batchRows.filter(r => r.examName && r.value).length})
              </Button>
              {/* B5 — Passo opcional, ANTES de registrar: a IA aponta erros de
                  digitacao, exames desconhecidos e valores suspeitos. Read-only;
                  nao importa nada. O operador revisa e (opcionalmente) aplica. */}
              <Button
                variant="secondary"
                icon={<Sparkles className="h-4 w-4 text-violet-500" />}
                onClick={handleValidateBatch}
                loading={validateBatch.isPending}
                disabled={batchRows.every(r => !r.examName.trim() && !r.value.trim())}
              >
                Validar planilha com IA
              </Button>
            </div>

            <BatchValidationPanel
              isPending={validateBatch.isPending}
              isError={validateBatch.isError}
              result={validateBatch.data ?? null}
              examOptions={exams.map(e => e.name)}
              onApplyExamName={handleApplyExamName}
              resolveLineNumber={(row) => (validatedRowMap[row] ?? row) + 1}
            />
          </div>
        ) : (
          /* --- Normal Mode --- */
          <>
            {/* Linha 1: Exame, Data, Medição, Valor Alvo */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select label="Exame" value={form.examName} onChange={(e) => setForm((c) => ({ ...c, examName: e.target.value, referenceId: undefined, targetValue: 0, targetSd: 0 }))}>
                <option value="">Selecione o exame</option>
                {exams.map((ex) => <option key={ex.id} value={ex.name}>{formatQcExamOption(area, ex)}</option>)}
              </Select>
              <Input label="Data" type="date" value={form.date} onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))} />
              <Input label="Medição" type="number" step="0.01" placeholder="0.00" value={String(form.value)} onChange={(e) => setForm((c) => ({ ...c, value: Number(e.target.value) }))} />
              <Input label="Valor Alvo" type="number" step="0.01" placeholder="0.00" value={String(targetValue)} onChange={(e) => setForm((c) => ({ ...c, targetValue: Number(e.target.value) }))} disabled={Boolean(resolvedRef)} />
            </div>

            {/* Linha 2: limite e variacao percentual em tempo real, lote, equipamento e analista */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input label="Limite de variação (%)" type="number" step="0.01" placeholder="10" value={String(cvLimit)} onChange={(e) => setForm((c) => ({ ...c, cvLimit: Number(e.target.value) }))} />
              <div className="space-y-1">
                <span className="text-base font-medium text-neutral-700">Variação %</span>
                <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 ${cvOk ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                  <span className={`text-lg font-bold ${cvOk ? 'text-green-700' : 'text-red-700'}`}>
                    {liveCv.toFixed(2)}%
                  </span>
                  {cvOk ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                </div>
              </div>
              <Input label="Lote do controle" value={form.lotNumber ?? ''} onChange={(e) => setForm((c) => ({ ...c, lotNumber: e.target.value }))} />
              <Input label="Equipamento" placeholder="Ex: Cobas c111" value={form.equipment} onChange={(e) => setForm((c) => ({ ...c, equipment: e.target.value }))} />
              <Input label="Analista" placeholder="Nome do analista" value={form.analyst} onChange={(e) => setForm((c) => ({ ...c, analyst: e.target.value }))} />
            </div>

            {/* Indicador de referência compacto */}
            {resolvedRef ? (
              <div className="mt-3 space-y-2">
                {/* B4 — Seletor de desambiguacao: quando ha >1 referencia vigente,
                    pre-selecionamos a recomendada (topo do ranking deterministico)
                    e deixamos o usuario trocar, sem bloquear o lancamento. */}
                {hasAmbiguity ? (
                  <ReferenceAmbiguityPicker
                    candidates={rankedCandidates}
                    recommendedId={recommendedRef?.id ?? null}
                    selectedRef={resolvedRef}
                    onSelect={setSelectedRefId}
                  />
                ) : null}
                <div className="flex flex-wrap items-center gap-1 rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-semibold text-neutral-600">Ref:</span>
                  <span className="text-sm">{resolvedRef.name}</span>
                  <span className="text-sm text-neutral-500">
                    | Alvo: {resolvedRef.targetValue} | DP: {resolvedRef.targetSd}
                    {resolvedRef.lotNumber ? ` | Lote: ${resolvedRef.lotNumber}` : ''}
                  </span>
                </div>
              </div>
            ) : form.examName ? (
              <div className="mt-3 flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <CircleX className="h-4 w-4" /> Sem referência ativa. Cadastre uma referência para este exame.
              </div>
            ) : null}

            {/* Botões */}
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="secondary" onClick={clearForm}>Limpar</Button>
              <Button onClick={handleSubmit} loading={createRecord.isPending}>Salvar Registro</Button>
            </div>

            {/* Feedback estruturado */}
            {feedback ? (
              <FeedbackPanel
                record={feedback}
                onDismiss={() => setFeedback(null)}
                onOpenPostCal={() => setIsPostCalOpen(true)}
              />
            ) : null}
            {submitError ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800">
                <XCircle className="mt-0.5 h-5 w-5 flex-none" />
                <span>{submitError}</span>
              </div>
            ) : null}
          </>
        )}
      </Card>

      {/* Modal pos-calibracao */}
      <PostCalibrationModal
        key={postCalRecord ? `h-${postCalRecord.id}` : lastCreated ? `c-${lastCreated.id}` : 'none'}
        record={postCalRecord ?? lastCreated}
        isOpen={postCalRecord !== null || isPostCalOpen}
        onClose={() => { setPostCalRecord(null); setIsPostCalOpen(false) }}
        onSaved={() => {
          setPostCalRecord(null); setIsPostCalOpen(false)
          toast.success('Pós-calibração registrada.')
        }}
      />

      {/* Historico */}
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-neutral-900">Histórico</h3>
        </div>

        {/* Busca e filtro */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="relative max-w-[280px] flex-1">
            <Input placeholder="Buscar exame..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[130px]">
            <option>Todos</option>
            <option>OK</option>
            <option>ALERTA</option>
            <option>ERRO</option>
          </Select>
          <span className="text-sm text-neutral-500">{filteredRecords.length} registros no dia</span>
        </div>

        {/* Tabela */}
        {isLoading ? (
          <div className="mt-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-neutral-100" />)}</div>
        ) : filteredRecords.length === 0 ? (
          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-base text-neutral-500">Nenhum registro encontrado.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-100 text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-3 py-2.5">Data</th>
                  <th className="px-3 py-2.5">Exame</th>
                  <th className="px-3 py-2.5">Valor</th>
                  <th className="px-3 py-2.5">Variação %</th>
                  <th className="px-3 py-2.5">Limite de variação %</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Calibrar?</th>
                  <th className="px-3 py-2.5">Pós-Calib</th>
                  <th className="px-3 py-2.5">LJ</th>
                  <th className="px-3 py-2.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => {
                  const rCv = r.cv ?? 0
                  const rCvLimit = r.cvLimit ?? 10
                  const needsCal = r.needsCalibration
                  return (
                    <tr key={r.id} className="border-b border-neutral-50 hover:bg-neutral-50/50">
                      <td className="whitespace-nowrap px-3 py-2.5 text-base text-neutral-600">{formatDate(r.date)}</td>
                      <td className="px-3 py-2.5 text-base font-semibold">
                        <button
                          type="button"
                          onClick={() => setHistoryExam({ examName: r.examName, level: r.level })}
                          className="text-left text-green-900 underline-offset-2 hover:underline focus:outline-none focus:underline"
                          title={`Ver histórico completo de ${r.examName}`}
                        >
                          {r.examName}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-base">{r.value.toFixed(2)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`font-semibold ${rCv <= rCvLimit ? 'text-green-700' : 'text-red-700'}`}>{rCv.toFixed(2)}%</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-neutral-700">{rCvLimit.toFixed(2)}%</span>
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2.5">
                        {needsCal ? (
                          r.needsCalibration ? (
                            <button onClick={() => setPostCalRecord(r)} className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-800 transition hover:bg-red-200" title="Clique para registrar pós-calibração">
                              SIM
                            </button>
                          ) : (
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800" title="Pós-calibração já registrada">FEITO</span>
                          )
                        ) : (
                          <span className="rounded-full border border-green-300 px-3 py-1 text-sm font-semibold text-green-700">NÃO</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.postCalibrationStatus ? (
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${
                                r.postCalibrationStatus === 'APROVADO'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {r.postCalibrationStatus}
                            </span>
                            <span className="font-mono text-xs text-neutral-500">
                              {r.postCalibrationValue?.toFixed(2)} ({r.postCalibrationCv?.toFixed(2)}%)
                            </span>
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setChartRecord({ examName: r.examName, level: r.level })} className="rounded-lg p-1.5 text-green-700 hover:bg-green-50" title="Levey-Jennings">
                            <Activity className="h-5 w-5" />
                          </button>
                          <button onClick={() => setExplainRecord(r)} className="rounded-lg p-1.5 text-violet-600 hover:bg-violet-50" title="Entender este resultado (IA)">
                            <Sparkles className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={() => handleDeleteRecord(r)}
                          className="text-red-400 hover:text-red-600 transition-colors" title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Navegação por dia */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <button onClick={() => shiftDay(-1)} className="rounded-lg border border-neutral-200 p-2 hover:bg-neutral-50" title="Dia anterior"><ChevronLeft className="h-5 w-5" /></button>
          <input type="date" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} className="rounded-lg border border-neutral-200 px-3 py-2 text-base" />
          <button onClick={() => shiftDay(1)} className="rounded-lg border border-neutral-200 p-2 hover:bg-neutral-50" title="Próximo dia"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </Card>

      {/* Modal Levey-Jennings */}
      <Modal isOpen={chartRecord !== null} onClose={() => setChartRecord(null)} title={chartRecord ? `Levey-Jennings — ${chartRecord.examName}` : ''} size="lg">
        {chartRecord ? (
          <Suspense fallback={<Skeleton height="24rem" />}>
            <LeveyJenningsChart examName={chartRecord.examName} level={chartRecord.level} area={area} />
          </Suspense>
        ) : null}
      </Modal>

      {/* Modal Historico do Exame (clique no nome do exame) */}
      <ExamHistoryModal
        area={area}
        examName={historyExam?.examName ?? null}
        level={historyExam?.level ?? null}
        onClose={() => setHistoryExam(null)}
      />

      {/* Modal A1 — Explicacao assistiva de Westgard (linha do historico) */}
      <ExplainRecordModal record={explainRecord} onClose={() => setExplainRecord(null)} />

      {/* Undo delete banner */}
      {deletedRecord && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-lg animate-slideUp">
          <span className="text-base text-neutral-700">Registro excluído.</span>
          <button onClick={handleUndo} className="font-semibold text-green-700 hover:text-green-800">
            Desfazer
          </button>
        </div>
      )}
    </div>
  )
}

interface ReferenceAmbiguityPickerProps {
  candidates: QcReferenceValue[]
  recommendedId: string | null
  selectedRef: QcReferenceValue
  onSelect: (id: string) => void
}

/**
 * B4 — Seletor de desambiguacao de referencia.
 *
 * Quando ha mais de uma referencia vigente para o mesmo exame+nivel, em vez de
 * bloquear, mostramos as candidatas ranqueadas (mais provavel pre-selecionada)
 * e deixamos o operador trocar. A escolha alimenta alvo, DP e limite de variacao.
 * A ordem das opcoes ja vem ranqueada pela heuristica deterministica; nao ha
 * IA nem calculo de regra de CQ aqui — apenas selecao da fonte.
 */
function ReferenceAmbiguityPicker({ candidates, recommendedId, selectedRef, onSelect }: ReferenceAmbiguityPickerProps) {
  const usingRecommended = selectedRef.id === recommendedId
  // Domínio (B4): se as candidatas vigentes divergem em alvo ou DP, e provavel
  // erro de cadastro (dois lotes diferentes ativos ao mesmo tempo). Avisamos de
  // forma discreta para o operador confirmar o lote em uso. So sinal visual —
  // nao altera ranking nem calculo de CQ.
  const divergentTargets = referencesDiverge(candidates)
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-900">
      <div className="flex items-start gap-2">
        <Layers className="mt-0.5 h-4 w-4 flex-none text-amber-600" />
        <div className="flex-1 space-y-2">
          <p className="text-sm">
            <span className="font-semibold">{candidates.length} referências vigentes</span> para este exame/nível
            {usingRecommended ? ' — usando a mais recente: ' : ' — usando: '}
            <span className="font-semibold">{selectedRef.name}</span>
            {selectedRef.lotNumber ? <> (lote {selectedRef.lotNumber}{selectedRef.validUntil ? `, validade ${formatRefDate(selectedRef.validUntil)}` : ''})</> : selectedRef.validUntil ? <> (validade {formatRefDate(selectedRef.validUntil)})</> : null}
            . Trocar?
          </p>
          {divergentTargets ? (
            <p className="flex items-start gap-1.5 text-sm font-medium text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              <span>Atenção: as referências vigentes têm alvo/DP diferentes — confirme qual lote está em uso.</span>
            </p>
          ) : null}
          <select
            aria-label="Referência operacional"
            value={selectedRef.id}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
          >
            {candidates.map((ref) => (
              <option key={ref.id} value={ref.id}>
                {formatRefOption(ref, ref.id === recommendedId)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

/**
 * B4 (domínio): detecta divergencia de alvo/DP entre as candidatas vigentes.
 * Qualquer diferenca em targetValue OU targetSd entre as referencias dispara o
 * aviso (cvMaxThreshold e opcional e nao entra aqui). Comparacao simples por
 * unicidade — nao toca em nenhuma regra de calculo de CQ.
 */
function referencesDiverge(candidates: QcReferenceValue[]): boolean {
  if (candidates.length < 2) return false
  const first = candidates[0]
  return candidates.some(
    (ref) => ref.targetValue !== first.targetValue || ref.targetSd !== first.targetSd,
  )
}

/** Rotulo de uma opcao do seletor: nome, lote, validade e alvo/DP. */
function formatRefOption(ref: QcReferenceValue, isRecommended: boolean): string {
  const parts: string[] = [ref.name]
  if (ref.lotNumber) parts.push(`lote ${ref.lotNumber}`)
  if (ref.validUntil) parts.push(`val. ${formatRefDate(ref.validUntil)}`)
  parts.push(`alvo ${ref.targetValue} ± ${ref.targetSd}`)
  const label = parts.join(' · ')
  return isRecommended ? `★ ${label} (recomendada)` : label
}

/** Formata uma data ISO (YYYY-MM-DD...) como dd/mm/aaaa; vazio vira string vazia. */
function formatRefDate(value: string): string {
  const iso = value.slice(0, 10)
  if (!iso) return ''
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

interface FeedbackPanelProps {
  record: QcRecord
  onDismiss: () => void
  onOpenPostCal: () => void
}

function FeedbackPanel({ record, onDismiss, onOpenPostCal }: FeedbackPanelProps) {
  const explainQc = useExplainQc()
  const rootCause = useRootCause()
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [rootCauseOpen, setRootCauseOpen] = useState(false)

  const handleExplain = () => {
    if (explainQc.isPending) return
    setExplanationOpen(true)
    explainQc.mutate(record.id)
  }

  // A3 — hipotese assistiva de causa-raiz (read-only). Disponivel sempre, mas
  // faz mais sentido para registros com violacao (ALERTA/REPROVADO).
  const handleRootCause = () => {
    if (rootCause.isPending) return
    setRootCauseOpen(true)
    rootCause.mutate(record.id)
  }

  const status = record.status
  const tone =
    status === 'APROVADO'
      ? { border: 'border-green-200', bg: 'bg-green-50', text: 'text-green-900', iconColor: 'text-green-600', title: 'Registro aprovado' }
      : status === 'ALERTA'
        ? { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-900', iconColor: 'text-amber-600', title: 'Atenção necessária' }
        : { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-900', iconColor: 'text-red-600', title: 'Registro reprovado' }

  const Icon = status === 'APROVADO' ? CheckCircle2 : status === 'ALERTA' ? AlertTriangle : XCircle

  const target = record.targetValue ?? 0
  const sd = record.targetSd ?? 0
  const context = `${record.examName} · ${record.value.toFixed(2)} · Alvo ${target.toFixed(2)} ± ${sd.toFixed(2)} · Z ${record.zScore.toFixed(2)}`

  return (
    <div className={`mt-3 rounded-2xl border ${tone.border} ${tone.bg} px-5 py-4 ${tone.text}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-7 w-7 flex-none ${tone.iconColor}`} />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">{tone.title}</div>
              <div className="text-sm opacity-80">{context}</div>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg p-1 text-current opacity-60 transition hover:bg-black/5 hover:opacity-100"
              aria-label="Dispensar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {record.violations.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {record.violations.map((v, idx) => {
                const info = getWestgardInfo(v.rule)
                return (
                  <li key={idx} className="rounded-xl bg-white/70 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{info.title}</span>
                      <span className="rounded-full bg-black/10 px-2 py-0.5 font-mono text-xs">{v.rule}</span>
                    </div>
                    <div className="text-sm opacity-80">{info.detail}</div>
                    <div className="mt-1 text-sm font-medium">→ {info.action}</div>
                  </li>
                )
              })}
            </ul>
          ) : status === 'APROVADO' ? (
            <div className="mt-2 text-sm opacity-80">Valor dentro da faixa aceitável. Pode liberar os resultados.</div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {record.needsCalibration ? (
              <button
                type="button"
                onClick={onOpenPostCal}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Registrar pós-calibração agora
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleExplain}
              disabled={explainQc.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
              title="Explicação assistiva gerada por IA"
            >
              <Sparkles className="h-4 w-4" />
              Entender este resultado
            </button>
            <button
              type="button"
              onClick={handleRootCause}
              disabled={rootCause.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
              title="Hipótese de causa-raiz gerada por IA (apoio à decisão, não decisão)"
            >
              <Microscope className="h-4 w-4" />
              Análise de causa-raiz
            </button>
          </div>

          {explanationOpen ? (
            <div className="mt-3">
              <AiAssistResult
                isPending={explainQc.isPending}
                isError={explainQc.isError}
                text={explainQc.data ?? null}
                loadingLabel="Gerando explicação com IA..."
              />
            </div>
          ) : null}

          {rootCauseOpen ? (
            <div className="mt-3">
              <RootCauseResult
                isPending={rootCause.isPending}
                isError={rootCause.isError}
                text={rootCause.data ?? null}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

interface RootCauseResultProps {
  isPending: boolean
  isError: boolean
  text: string | null
}

/**
 * A3 — Exibe a hipotese de causa-raiz gerada por IA. Reusa o bloco padrao de
 * resultado (estados de loading/erro) mas com cabecalho e disclaimer proprios
 * que deixam explicito que e HIPOTESE assistiva, nao decisao tecnica. Read-only.
 */
function RootCauseResult({ isPending, isError, text }: RootCauseResultProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-violet-700">
        <Microscope className="h-4 w-4" />
        <span>Hipótese de causa-raiz (IA)</span>
      </div>
      <AiAssistResult
        isPending={isPending}
        isError={isError}
        text={text}
        loadingLabel="Analisando possíveis causas com IA..."
        errorLabel="Não foi possível gerar a análise de causa-raiz agora. Tente novamente."
        withDisclaimer={false}
      />
      {!isPending && !isError && text ? (
        <p className="text-xs text-neutral-500">
          Hipótese assistiva gerada por IA — apoio à investigação, não decisão. Confirme com a
          avaliação técnica antes de agir.
        </p>
      ) : null}
    </div>
  )
}

interface ExplainRecordModalProps {
  record: QcRecord | null
  onClose: () => void
}

/**
 * A1 — Modal de explicacao assistiva de um registro de CQ acionado pela linha
 * do historico. Dispara a chamada quando o registro muda (keyed por id) e
 * exibe a explicacao com estados de loading/erro. Read-only: nao altera o CQ.
 */
function ExplainRecordModal({ record, onClose }: ExplainRecordModalProps) {
  const explainQc = useExplainQc()
  const rootCause = useRootCause()
  const reset = explainQc.reset
  const resetRootCause = rootCause.reset
  const [rootCauseOpen, setRootCauseOpen] = useState(false)

  useEffect(() => {
    if (!record) {
      reset()
      resetRootCause()
      setRootCauseOpen(false)
      return
    }
    explainQc.mutate(record.id)
    // A3 e sob demanda (botao); aqui apenas limpamos o estado anterior ao trocar
    // de registro para nao exibir analise de outro exame.
    resetRootCause()
    setRootCauseOpen(false)
    // Dispara apenas quando o id do registro muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id])

  const handleRootCause = () => {
    if (!record || rootCause.isPending) return
    setRootCauseOpen(true)
    rootCause.mutate(record.id)
  }

  return (
    <Modal
      isOpen={record !== null}
      onClose={onClose}
      title={record ? `Entender resultado — ${record.examName}` : ''}
      size="md"
    >
      {record ? (
        <div className="space-y-3">
          <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            {record.examName} · {record.value.toFixed(2)} · Alvo {record.targetValue.toFixed(2)} ± {record.targetSd.toFixed(2)} · Z {record.zScore.toFixed(2)}
          </div>
          <AiAssistResult
            isPending={explainQc.isPending}
            isError={explainQc.isError}
            text={explainQc.data ?? null}
            loadingLabel="Gerando explicação com IA..."
          />

          {/* A3 — análise de causa-raiz ao lado da explicação (A1), sob demanda. */}
          <div>
            <button
              type="button"
              onClick={handleRootCause}
              disabled={rootCause.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
              title="Hipótese de causa-raiz gerada por IA (apoio à decisão, não decisão)"
            >
              <Microscope className="h-4 w-4" />
              Análise de causa-raiz
            </button>
          </div>

          {rootCauseOpen ? (
            <RootCauseResult
              isPending={rootCause.isPending}
              isError={rootCause.isError}
              text={rootCause.data ?? null}
            />
          ) : null}
        </div>
      ) : null}
    </Modal>
  )
}

function formatDate(date: string) {
  try { return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return date }
}

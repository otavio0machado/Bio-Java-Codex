import {
  Activity,
  AlertTriangle,
  Beaker,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  useCreateQcBatch,
  useQcRecords,
  useQcReferences,
} from '../../hooks/useQcRecords'
import { qcService } from '../../services/qcService'
import type { QcRecord, QcRecordRequest, QcReferenceValue } from '../../types'
import { Button, Card, EmptyState, Input, Modal, Select, Skeleton, StatusBadge, useToast } from '../ui'
import { formatLongBR } from '../../utils/date'
import { CoagulacaoPncqModal } from './CoagulacaoPncqModal'
import { ExamHistoryModal } from './ExamHistoryModal'
import { PostCalibrationModal } from './PostCalibrationModal'

const LeveyJenningsChart = lazy(() =>
  import('../charts/LeveyJenningsChart').then((module) => ({
    default: module.LeveyJenningsChart,
  })),
)

export function CoagulacaoArea() {
  const { user } = useAuth()
  const { toast } = useToast()

  // Filtros da seção de Histórico
  const [historyDate, setHistoryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('Todos')

  const {
    data: references = [],
    isLoading: isRefLoading,
    refetch: refetchReferences,
  } = useQcReferences({ area: 'coagulacao' })
  const {
    data: records = [],
    isLoading: isRecordsLoading,
    refetch: refetchRecords,
  } = useQcRecords({
    area: 'coagulacao',
    startDate: historyDate,
    endDate: historyDate,
  })

  const createBatchMutation = useCreateQcBatch()

  // Modais
  const [isPncqModalOpen, setIsPncqModalOpen] = useState(false)
  const [postCalRecord, setPostCalRecord] = useState<QcRecord | null>(null)
  const [chartRecord, setChartRecord] = useState<{ examName: string; level: string } | null>(null)
  const [historyExam, setHistoryExam] = useState<{ examName: string; level: string } | null>(null)

  // Entrada Rápida Diária
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedLot, setSelectedLot] = useState<string>('')
  const operatorName = user?.name || 'Bioquímico'
  const equipmentName = 'Coagulômetro'

  // Campos do formulário
  const [tpAtividade, setTpAtividade] = useState('')
  const [tpInr, setTpInr] = useState('')
  const [ttpa, setTtpa] = useState('')
  const [fibrinogenio, setFibrinogenio] = useState('')

  // Agrupar referências por lote
  const availableLots = useMemo(() => {
    const lotSet = new Set<string>()
    references.forEach((r) => {
      if (r.lotNumber && r.isActive) lotSet.add(r.lotNumber)
    })
    return Array.from(lotSet)
  }, [references])

  const currentLot = selectedLot || availableLots[0] || ''

  // Referências do lote selecionado
  const currentLotRefs = useMemo(() => {
    const map = new Map<string, QcReferenceValue>()
    references
      .filter((r) => r.lotNumber === currentLot && r.isActive)
      .forEach((r) => {
        const examName = r.exam?.name || r.name
        map.set(examName.toLowerCase(), r)
      })
    return map
  }, [references, currentLot])

  const getRefFor = (name: string): QcReferenceValue | undefined => {
    const lower = name.toLowerCase()
    for (const [key, ref] of currentLotRefs.entries()) {
      if (key.includes(lower) || lower.includes(key)) {
        return ref
      }
    }
    return undefined
  }

  // Cálculos em tempo real para a barra de entrada rápida
  const liveTpAtiv = useMemo(() => {
    const val = parseFloat(tpAtividade.replace(',', '.'))
    if (isNaN(val)) return null
    const ref = getRefFor('TP - Atividade (%)')
    if (!ref || !ref.targetSd) return { val, zScore: undefined, status: undefined }
    const z = (val - ref.targetValue) / ref.targetSd
    return {
      val,
      zScore: z,
      status: Math.abs(z) > 3 ? 'REJEICAO' : Math.abs(z) > 2 ? 'ALERTA' : 'OK',
    }
  }, [tpAtividade, references, currentLot])

  const liveTpInr = useMemo(() => {
    const val = parseFloat(tpInr.replace(',', '.'))
    if (isNaN(val)) return null
    const ref = getRefFor('TP - INR')
    if (!ref || !ref.targetSd) return { val, zScore: undefined, status: undefined }
    const z = (val - ref.targetValue) / ref.targetSd
    return {
      val,
      zScore: z,
      status: Math.abs(z) > 3 ? 'REJEICAO' : Math.abs(z) > 2 ? 'ALERTA' : 'OK',
    }
  }, [tpInr, references, currentLot])

  const liveTtpa = useMemo(() => {
    const val = parseFloat(ttpa.replace(',', '.'))
    if (isNaN(val)) return null
    const ref = getRefFor('TTPa - Tempo (s)')
    if (!ref || !ref.targetSd) return { val, zScore: undefined, status: undefined }
    const z = (val - ref.targetValue) / ref.targetSd
    return {
      val,
      zScore: z,
      status: Math.abs(z) > 3 ? 'REJEICAO' : Math.abs(z) > 2 ? 'ALERTA' : 'OK',
    }
  }, [ttpa, references, currentLot])

  const liveFib = useMemo(() => {
    const val = parseFloat(fibrinogenio.replace(',', '.'))
    if (isNaN(val)) return null
    const ref = getRefFor('Fibrinogênio (g/L)')
    if (!ref || !ref.targetSd) return { val, zScore: undefined, status: undefined }
    const z = (val - ref.targetValue) / ref.targetSd
    return {
      val,
      zScore: z,
      status: Math.abs(z) > 3 ? 'REJEICAO' : Math.abs(z) > 2 ? 'ALERTA' : 'OK',
    }
  }, [fibrinogenio, references, currentLot])

  const handleConfirmRun = async () => {
    if (!currentLot) {
      toast.error('Selecione ou cadastre um Lote PNCQ antes de registrar a corrida.')
      return
    }

    const requests: QcRecordRequest[] = []

    const addAnalyte = (examCanonicalName: string, rawVal: string) => {
      const val = parseFloat(rawVal.replace(',', '.'))
      if (isNaN(val)) return
      const ref = getRefFor(examCanonicalName)
      requests.push({
        examName: examCanonicalName,
        area: 'coagulacao',
        date: selectedDate,
        level: ref?.level || 'Normal',
        lotNumber: currentLot,
        value: val,
        targetValue: ref?.targetValue || 0,
        targetSd: ref?.targetSd || 0,
        cvLimit: ref?.cvMaxThreshold || 15,
        equipment: equipmentName.trim() || 'Coagulômetro',
        analyst: operatorName.trim() || user?.name || 'Operador',
        referenceId: ref?.id,
      })
    }

    addAnalyte('TP - Atividade (%)', tpAtividade)
    addAnalyte('TP - INR', tpInr)
    addAnalyte('TTPa - Tempo (s)', ttpa)
    addAnalyte('Fibrinogênio (g/L)', fibrinogenio)

    if (requests.length === 0) {
      toast.warning('Preencha ao menos um parâmetro (TP % / INR / TTPa) para confirmar a corrida.')
      return
    }

    try {
      await createBatchMutation.mutateAsync(requests)
      toast.success('Corrida de Coagulação gravada com sucesso!')
      setTpAtividade('')
      setTpInr('')
      setTtpa('')
      setFibrinogenio('')
      await Promise.all([refetchRecords(), refetchReferences()])
    } catch {
      toast.error('Não foi possível gravar a corrida de coagulação no servidor.')
    }
  }

  const handleDeleteRecord = async (record: QcRecord) => {
    if (!confirm(`Deseja excluir o lançamento de ${record.examName} (${formatLongBR(record.date)})?`)) {
      return
    }
    try {
      await qcService.deleteRecord(record.id)
      toast.success('Registro de coagulação excluído com sucesso.')
      await refetchRecords()
    } catch {
      toast.error('Erro ao excluir registro de coagulação.')
    }
  }

  // Filtragem dos registros para a tabela de Histórico
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase()
        const matchExam = r.examName.toLowerCase().includes(query)
        const matchLot = r.lotNumber?.toLowerCase().includes(query)
        const matchDate = r.date.toLowerCase().includes(query)
        if (!matchExam && !matchLot && !matchDate) return false
      }

      if (statusFilter !== 'Todos') {
        if (statusFilter === 'OK' && r.status !== 'APROVADO') return false
        if (statusFilter === 'ALERTA' && r.status !== 'ALERTA') return false
        if (statusFilter === 'REPROVADO' && r.status !== 'REPROVADO') return false
      }

      if (historyDate && r.date !== historyDate) {
        return false
      }

      return true
    })
  }, [records, searchTerm, statusFilter, historyDate])

  const shiftDay = (delta: number) => {
    const base = historyDate ? new Date(`${historyDate}T00:00:00`) : new Date()
    base.setDate(base.getDate() + delta)
    const yyyy = base.getFullYear()
    const mm = String(base.getMonth() + 1).padStart(2, '0')
    const dd = String(base.getDate()).padStart(2, '0')
    setHistoryDate(`${yyyy}-${mm}-${dd}`)
  }

  const isLoading = isRefLoading || isRecordsLoading

  return (
    <div className="space-y-6">
      {/* Ações da Área */}
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={() => void Promise.all([refetchReferences(), refetchRecords()])}
        >
          Atualizar
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setIsPncqModalOpen(true)}
        >
          Gerenciar Lotes PNCQ
        </Button>
      </div>

      {/* Registro de CQ */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 pb-4">
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">Registro de CQ</h3>
            <p className="text-sm text-neutral-500">
              Lançamento diário de hemostasia para cálculo e validação automática
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <span className="mr-2 text-xs font-semibold text-neutral-500">Lote Ativo:</span>
              {availableLots.length > 0 ? (
                <Select
                  value={currentLot}
                  onChange={(e) => setSelectedLot(e.target.value)}
                  className="w-48 font-mono text-xs font-semibold text-green-900"
                >
                  {availableLots.map((lot) => (
                    <option key={lot} value={lot}>
                      {lot}
                    </option>
                  ))}
                </Select>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsPncqModalOpen(true)}
                  className="text-xs text-orange-600"
                >
                  <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                  Cadastrar 1º Lote
                </Button>
              )}
            </div>

            <div>
              <span className="mr-2 text-xs font-semibold text-neutral-500">Data:</span>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-36 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Grade de Entrada dos Analitos */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* TP Atividade */}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-neutral-800">TP — Atividade (%)</span>
              {getRefFor('TP - Atividade (%)') && (
                <span className="font-mono text-[10px] text-neutral-500">
                  Alvo: {getRefFor('TP - Atividade (%)')?.targetValue} ±{' '}
                  {getRefFor('TP - Atividade (%)')?.targetSd}%
                </span>
              )}
            </div>
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Ex: 86"
                value={tpAtividade}
                onChange={(e) => setTpAtividade(e.target.value)}
                className="text-base font-bold"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              {liveTpAtiv?.status === 'OK' && (
                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> OK (Z: {liveTpAtiv.zScore?.toFixed(2)})
                </span>
              )}
              {liveTpAtiv?.status === 'ALERTA' && (
                <span className="flex items-center gap-1 font-semibold text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> Alerta ±2DP (Z:{' '}
                  {liveTpAtiv.zScore?.toFixed(2)})
                </span>
              )}
              {liveTpAtiv?.status === 'REJEICAO' && (
                <span className="flex items-center gap-1 font-semibold text-red-700">
                  <XCircle className="h-3.5 w-3.5" /> Rejeição ±3DP (Z:{' '}
                  {liveTpAtiv.zScore?.toFixed(2)})
                </span>
              )}
              {!liveTpAtiv && <span className="text-neutral-400">Aguardando valor</span>}
            </div>
          </div>

          {/* TP INR */}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-neutral-800">TP — INR</span>
              {getRefFor('TP - INR') && (
                <span className="font-mono text-[10px] text-neutral-500">
                  Alvo: {getRefFor('TP - INR')?.targetValue} ±{' '}
                  {getRefFor('TP - INR')?.targetSd}
                </span>
              )}
            </div>
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Ex: 1.07"
                value={tpInr}
                onChange={(e) => setTpInr(e.target.value)}
                className="text-base font-bold"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              {liveTpInr?.status === 'OK' && (
                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> OK (Z: {liveTpInr.zScore?.toFixed(2)})
                </span>
              )}
              {liveTpInr?.status === 'ALERTA' && (
                <span className="flex items-center gap-1 font-semibold text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> Alerta ±2DP (Z:{' '}
                  {liveTpInr.zScore?.toFixed(2)})
                </span>
              )}
              {liveTpInr?.status === 'REJEICAO' && (
                <span className="flex items-center gap-1 font-semibold text-red-700">
                  <XCircle className="h-3.5 w-3.5" /> Rejeição ±3DP (Z:{' '}
                  {liveTpInr.zScore?.toFixed(2)})
                </span>
              )}
              {!liveTpInr && <span className="text-neutral-400">Aguardando valor</span>}
            </div>
          </div>

          {/* TTPa */}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-neutral-800">TTPa — Tempo (s)</span>
              {getRefFor('TTPa - Tempo (s)') && (
                <span className="font-mono text-[10px] text-neutral-500">
                  Alvo: {getRefFor('TTPa - Tempo (s)')?.targetValue} ±{' '}
                  {getRefFor('TTPa - Tempo (s)')?.targetSd}s
                </span>
              )}
            </div>
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Ex: 36"
                value={ttpa}
                onChange={(e) => setTtpa(e.target.value)}
                className="text-base font-bold"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              {liveTtpa?.status === 'OK' && (
                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> OK (Z: {liveTtpa.zScore?.toFixed(2)})
                </span>
              )}
              {liveTtpa?.status === 'ALERTA' && (
                <span className="flex items-center gap-1 font-semibold text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> Alerta ±2DP (Z:{' '}
                  {liveTtpa.zScore?.toFixed(2)})
                </span>
              )}
              {liveTtpa?.status === 'REJEICAO' && (
                <span className="flex items-center gap-1 font-semibold text-red-700">
                  <XCircle className="h-3.5 w-3.5" /> Rejeição ±3DP (Z:{' '}
                  {liveTtpa.zScore?.toFixed(2)})
                </span>
              )}
              {!liveTtpa && <span className="text-neutral-400">Aguardando valor</span>}
            </div>
          </div>

          {/* Fibrinogênio */}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-neutral-800">Fibrinogênio (g/L)</span>
              {getRefFor('Fibrinogênio (g/L)') ? (
                <span className="font-mono text-[10px] text-neutral-500">
                  Alvo: {getRefFor('Fibrinogênio (g/L)')?.targetValue} ±{' '}
                  {getRefFor('Fibrinogênio (g/L)')?.targetSd}
                </span>
              ) : (
                <span className="text-[10px] text-neutral-400">Opcional</span>
              )}
            </div>
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Ex: 1.50"
                value={fibrinogenio}
                onChange={(e) => setFibrinogenio(e.target.value)}
                className="text-base font-bold"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              {liveFib?.status === 'OK' && (
                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> OK (Z: {liveFib.zScore?.toFixed(2)})
                </span>
              )}
              {liveFib?.status === 'ALERTA' && (
                <span className="flex items-center gap-1 font-semibold text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> Alerta (Z: {liveFib.zScore?.toFixed(2)})
                </span>
              )}
              {liveFib?.status === 'REJEICAO' && (
                <span className="flex items-center gap-1 font-semibold text-red-700">
                  <XCircle className="h-3.5 w-3.5" /> Rejeição (Z: {liveFib.zScore?.toFixed(2)})
                </span>
              )}
              {!liveFib && <span className="text-neutral-400">Não informado</span>}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3">
          <div className="text-xs text-neutral-500">
            Operador: <span className="font-semibold text-neutral-700">{operatorName}</span> ·
            Equipamento: <span className="font-semibold text-neutral-700">{equipmentName}</span>
          </div>
          <Button
            variant="primary"
            icon={<CheckCircle2 className="h-4 w-4" />}
            onClick={handleConfirmRun}
            disabled={createBatchMutation.isPending}
            className="px-6"
          >
            {createBatchMutation.isPending ? 'Gravando...' : 'Confirmar Corrida de Coagulação'}
          </Button>
        </div>
      </Card>

      {/* Seção Única: Histórico de Coagulação (Paridade com Bioquímica) */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">Histórico</h3>
            <p className="text-xs text-neutral-500">
              Registros individuais por parâmetro, status de calibração e gráficos Levey-Jennings.
            </p>
          </div>
        </div>

        {/* Busca e Filtros */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-[280px] flex-1">
            <Input
              placeholder="Buscar exame ou lote..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs"
            />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-[140px] text-xs"
          >
            <option value="Todos">Todos os status</option>
            <option value="OK">OK / Aprovado</option>
            <option value="ALERTA">Alerta</option>
            <option value="REPROVADO">Reprovado</option>
          </Select>

          <span className="ml-auto text-xs text-neutral-500">
            {filteredRecords.length} {filteredRecords.length === 1 ? 'registro carregado no dia' : 'registros carregados no dia'}
          </span>
        </div>

        {/* Tabela de Histórico */}
        {isLoading ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-neutral-100" />
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <EmptyState
            icon={<Beaker className="h-8 w-8 text-neutral-400" />}
            title="Nenhum registro encontrado"
            description="Nenhuma medição de coagulação corresponde aos filtros aplicados."
          />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-xs font-bold uppercase tracking-wider text-neutral-500">
                  <th className="px-3 py-2.5">Data</th>
                  <th className="px-3 py-2.5">Exame</th>
                  <th className="px-3 py-2.5">Lote / Nível</th>
                  <th className="px-3 py-2.5">Valor</th>
                  <th className="px-3 py-2.5">Alvo ± DP</th>
                  <th className="px-3 py-2.5">CV%</th>
                  <th className="px-3 py-2.5">CV Lim%</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-center">Calibrar?</th>
                  <th className="px-3 py-2.5">Pós-Calib</th>
                  <th className="px-3 py-2.5 text-center">LJ</th>
                  <th className="px-3 py-2.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredRecords.map((r) => {
                  const rCv = r.cv ?? 0
                  const rCvLimit = r.cvLimit ?? 15
                  const needsCal = rCv > rCvLimit

                  return (
                    <tr key={r.id} className="hover:bg-neutral-50/50">
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-neutral-900">
                        {formatLongBR(r.date)}
                      </td>
                      <td className="px-3 py-2.5 font-semibold">
                        <button
                          type="button"
                          onClick={() => setHistoryExam({ examName: r.examName, level: r.level })}
                          className="text-left text-green-900 underline-offset-2 hover:underline focus:outline-none focus:underline"
                          title={`Ver histórico completo de ${r.examName}`}
                        >
                          {r.examName}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-neutral-600">
                        {r.lotNumber || '—'} ({r.level})
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-neutral-900">
                        {r.value.toFixed(2)}{' '}
                        {r.examName.includes('%')
                          ? '%'
                          : r.examName.includes('INR')
                          ? ''
                          : r.examName.includes('Tempo')
                          ? 's'
                          : ''}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-neutral-600">
                        {r.targetValue?.toFixed(2)} ± {r.targetSd?.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`font-mono font-semibold ${
                            rCv <= rCvLimit ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {r.cv !== undefined && r.cv !== null ? `${rCv.toFixed(2)}%` : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-neutral-600">
                        {rCvLimit.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {needsCal ? (
                          r.needsCalibration ? (
                            <button
                              type="button"
                              onClick={() => setPostCalRecord(r)}
                              className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 transition hover:bg-red-200"
                              title="Clique para registrar pós-calibração"
                            >
                              SIM
                            </button>
                          ) : (
                            <span
                              className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800"
                              title="Pós-calibração já registrada"
                            >
                              FEITO
                            </span>
                          )
                        ) : (
                          <span className="rounded-full border border-green-300 px-3 py-1 text-xs font-semibold text-green-700">
                            NÃO
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.postCalibrationStatus ? (
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                r.postCalibrationStatus === 'APROVADO'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {r.postCalibrationStatus}
                            </span>
                            <span className="font-mono text-[11px] text-neutral-500">
                              {r.postCalibrationValue?.toFixed(2)} ({r.postCalibrationCv?.toFixed(2)}%)
                            </span>
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => setChartRecord({ examName: r.examName, level: r.level })}
                          className="rounded-lg p-1.5 text-green-700 transition hover:bg-green-50"
                          title={`Ver gráfico Levey-Jennings de ${r.examName}`}
                        >
                          <Activity className="h-5 w-5" />
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(r)}
                          className="text-neutral-400 transition hover:text-red-600"
                          title="Excluir medição"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Navegação de Datas */}
        <div className="mt-6 flex items-center justify-center gap-3 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={() => shiftDay(-1)}
            className="rounded-lg border border-neutral-200 p-2 text-neutral-600 transition hover:bg-neutral-50"
            title="Dia anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={historyDate}
            onChange={(e) => setHistoryDate(e.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700"
          />
          <button
            type="button"
            onClick={() => shiftDay(1)}
            className="rounded-lg border border-neutral-200 p-2 text-neutral-600 transition hover:bg-neutral-50"
            title="Próximo dia"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </Card>

      {/* Modal Levey-Jennings */}
      <Modal
        isOpen={chartRecord !== null}
        onClose={() => setChartRecord(null)}
        title={chartRecord ? `Levey-Jennings — ${chartRecord.examName}` : ''}
        size="lg"
      >
        {chartRecord ? (
          <Suspense fallback={<Skeleton height="24rem" />}>
            <LeveyJenningsChart
              examName={chartRecord.examName}
              level={chartRecord.level}
              area="coagulacao"
            />
          </Suspense>
        ) : null}
      </Modal>

      {/* Modal Histórico do Exame (clique no nome do exame) */}
      <ExamHistoryModal
        area="coagulacao"
        examName={historyExam?.examName ?? null}
        level={historyExam?.level ?? null}
        onClose={() => setHistoryExam(null)}
      />

      {/* Modal Pós-Calibração */}
      <PostCalibrationModal
        record={postCalRecord}
        isOpen={postCalRecord !== null}
        onClose={() => setPostCalRecord(null)}
        onSaved={() => {
          setPostCalRecord(null)
          void refetchRecords()
          toast.success('Pós-calibração registrada.')
        }}
      />

      {/* Modal de Gestão de Lotes PNCQ */}
      <CoagulacaoPncqModal
        isOpen={isPncqModalOpen}
        onClose={() => setIsPncqModalOpen(false)}
        onLotCreated={(lot) => {
          setSelectedLot(lot)
          void Promise.all([refetchReferences(), refetchRecords()])
        }}
      />
    </div>
  )
}

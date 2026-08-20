import {
  Activity,
  AlertTriangle,
  Beaker,
  CheckCircle2,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  useCreateQcBatch,
  useQcRecords,
  useQcReferences,
} from '../../hooks/useQcRecords'
import { qcService } from '../../services/qcService'
import type { QcRecord, QcRecordRequest, QcReferenceValue, QcStatus } from '../../types'
import { Button, Card, EmptyState, Input, Select, Skeleton, StatusBadge, useToast } from '../ui'
import { formatLongBR } from '../../utils/date'
import { CoagulacaoPncqModal } from './CoagulacaoPncqModal'

export function CoagulacaoArea() {
  const { user } = useAuth()
  const { toast } = useToast()

  const {
    data: references = [],
    isLoading: isRefLoading,
    refetch: refetchReferences,
  } = useQcReferences({ area: 'coagulacao' })
  const {
    data: records = [],
    isLoading: isRecordsLoading,
    refetch: refetchRecords,
  } = useQcRecords({ area: 'coagulacao' })

  const createBatchMutation = useCreateQcBatch()

  // Modal PNCQ
  const [isPncqModalOpen, setIsPncqModalOpen] = useState(false)

  // Quick Daily Entry State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedLot, setSelectedLot] = useState<string>('')
  const operatorName = user?.name || 'Bioquímico'
  const equipmentName = 'Coagulômetro'

  // Form values
  const [tpAtividade, setTpAtividade] = useState('')
  const [tpInr, setTpInr] = useState('')
  const [ttpa, setTtpa] = useState('')
  const [fibrinogenio, setFibrinogenio] = useState('')

  // Chart Tab State
  const [activeChartAnalyte, setActiveChartAnalyte] = useState<string>('TP - Atividade (%)')

  // Agrupar referências por lote
  const availableLots = useMemo(() => {
    const lotSet = new Set<string>()
    references.forEach((r) => {
      if (r.lotNumber && r.isActive) lotSet.add(r.lotNumber)
    })
    return Array.from(lotSet)
  }, [references])

  // Selecionar o primeiro lote disponível por padrão se nenhum estiver selecionado
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

  // Helper para buscar referência pelo nome canônico do exame
  const getRefFor = (name: string): QcReferenceValue | undefined => {
    const lower = name.toLowerCase()
    for (const [key, ref] of currentLotRefs.entries()) {
      if (key.includes(lower) || lower.includes(key)) {
        return ref
      }
    }
    return undefined
  }



  // Cálculos em tempo real para o formulário rápido
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
      // Limpar campos
      setTpAtividade('')
      setTpInr('')
      setTtpa('')
      setFibrinogenio('')
      await Promise.all([refetchRecords(), refetchReferences()])
    } catch {
      toast.error('Não foi possível gravar a corrida de coagulação no servidor.')
    }
  }

  // Agrupamento de registros por data + lote para a Matriz de Planilha
  interface CoagulationRunGroup {
    key: string
    date: string
    lotNumber: string
    level: string
    operator: string
    tpAtivRecord?: QcRecord
    tpInrRecord?: QcRecord
    ttpaRecord?: QcRecord
    fibRecord?: QcRecord
    overallStatus: QcStatus
  }

  const matrixRuns = useMemo(() => {
    const map = new Map<string, CoagulationRunGroup>()

    records.forEach((rec) => {
      const key = `${rec.date}_${rec.lotNumber || 'SEM_LOTE'}`
      let group = map.get(key)
      if (!group) {
        group = {
          key,
          date: rec.date,
          lotNumber: rec.lotNumber || '—',
          level: rec.level || 'Normal',
          operator: rec.analyst || '—',
          overallStatus: 'APROVADO',
        }
        map.set(key, group)
      }

      const examLower = rec.examName.toLowerCase()
      if (examLower.includes('atividade') || examLower.includes('tp - ativ')) {
        group.tpAtivRecord = rec
      } else if (examLower.includes('inr')) {
        group.tpInrRecord = rec
      } else if (examLower.includes('ttpa')) {
        group.ttpaRecord = rec
      } else if (examLower.includes('fibrinog')) {
        group.fibRecord = rec
      }

      if (rec.status === 'REPROVADO') {
        group.overallStatus = 'REPROVADO'
      } else if (rec.status === 'ALERTA' && group.overallStatus !== 'REPROVADO') {
        group.overallStatus = 'ALERTA'
      }
    })

    // Ordenar decrescente por data
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date))
  }, [records])

  // Registros para o Gráfico Levey-Jennings selecionado
  const chartRecords = useMemo(() => {
    const lower = activeChartAnalyte.toLowerCase()
    return records
      .filter((r) => r.examName.toLowerCase().includes(lower) || lower.includes(r.examName.toLowerCase()))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [records, activeChartAnalyte])

  const chartReference = getRefFor(activeChartAnalyte)

  const handleDeleteRun = async (group: CoagulationRunGroup) => {
    if (!confirm(`Deseja excluir os lançamentos de coagulação do dia ${formatLongBR(group.date)}?`))
      return
    try {
      const toDelete = [
        group.tpAtivRecord?.id,
        group.tpInrRecord?.id,
        group.ttpaRecord?.id,
        group.fibRecord?.id,
      ].filter(Boolean) as string[]

      for (const id of toDelete) {
        await qcService.deleteRecord(id)
      }

      toast.success('Lançamentos excluídos.')
      await refetchRecords()
    } catch {
      toast.error('Erro ao excluir lançamentos.')
    }
  }

  const isLoading = isRefLoading || isRecordsLoading

  return (
    <div className="space-y-6">
      {/* Header com Ações Rápidas */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">
            Controle de Qualidade — Coagulação
          </h2>
          <p className="text-sm text-neutral-500">
            Lançamento unificado de hemostasia (TP %, INR, TTPa) e matriz de controle mensal.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => void Promise.all([refetchReferences(), refetchRecords()])}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsPncqModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Gerenciar Lotes PNCQ
          </Button>
        </div>
      </div>

      {/* Banner / Barra de Entrada Rápida de Corrida Diária */}
      <Card className="border-2 border-green-700/20 bg-white p-5 shadow-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-800 text-white shadow-sm">
              <Activity className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-bold text-neutral-900">Entrada Rápida da Corrida Diária</h3>
              <p className="text-xs text-neutral-500">
                Preencha os dados do controle do dia e valide a hemostasia simultaneamente.
              </p>
            </div>
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
            onClick={handleConfirmRun}
            disabled={createBatchMutation.isPending}
            className="flex items-center gap-2 px-6"
          >
            <CheckCircle2 className="h-4 w-4" />
            {createBatchMutation.isPending ? 'Gravando...' : 'Confirmar Corrida de Coagulação'}
          </Button>
        </div>
      </Card>

      {/* Grid Principal: Planilha Mensal (Esquerda) + Gráfico Levey-Jennings (Direita) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Planilha Matriz Mensal */}
        <div className="lg:col-span-7">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50/80 px-5 py-4">
              <div>
                <h3 className="font-bold text-neutral-900">Planilha Mensal de Coagulação</h3>
                <p className="text-xs text-neutral-500">
                  Visão consolidada de todas as corridas registradas no mês.
                </p>
              </div>
              <span className="rounded-full bg-green-100 px-3 py-1 font-mono text-xs font-semibold text-green-900">
                {matrixRuns.length} {matrixRuns.length === 1 ? 'corrida' : 'corridas'}
              </span>
            </div>

            {isLoading ? (
              <div className="p-6">
                <Skeleton height="16rem" />
              </div>
            ) : matrixRuns.length === 0 ? (
              <EmptyState
                icon={<Beaker className="h-8 w-8 text-neutral-400" />}
                title="Sem corridas de coagulação registradas"
                description="Use a barra de entrada rápida acima para lançar o controle diário de TP e TTPa."
              />
            ) : (
              <div className="max-h-[500px] overflow-x-auto overflow-y-auto">
                <table className="min-w-full divide-y divide-neutral-200 text-xs">
                  <thead className="sticky top-0 bg-neutral-100/90 backdrop-blur-sm">
                    <tr>
                      <th className="px-3 py-3 text-left font-bold text-neutral-700">Data</th>
                      <th className="px-3 py-3 text-left font-bold text-neutral-700">Lote</th>
                      <th className="px-3 py-3 text-center font-bold text-neutral-700">TP Ativ (%)</th>
                      <th className="px-3 py-3 text-center font-bold text-neutral-700">TP INR</th>
                      <th className="px-3 py-3 text-center font-bold text-neutral-700">TTPa (s)</th>
                      <th className="px-3 py-3 text-center font-bold text-neutral-700">Fibrinogênio</th>
                      <th className="px-3 py-3 text-center font-bold text-neutral-700">Status</th>
                      <th className="px-3 py-3 text-right font-bold text-neutral-700">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 bg-white">
                    {matrixRuns.map((group) => (
                      <tr key={group.key} className="hover:bg-neutral-50/80">
                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-neutral-900">
                          {formatLongBR(group.date)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-neutral-600">
                          {group.lotNumber}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-center font-mono font-bold ${
                            group.tpAtivRecord?.status === 'REPROVADO'
                              ? 'bg-red-50 text-red-700'
                              : group.tpAtivRecord?.status === 'ALERTA'
                              ? 'bg-amber-50 text-amber-700'
                              : 'text-neutral-900'
                          }`}
                        >
                          {group.tpAtivRecord?.value !== undefined
                            ? `${group.tpAtivRecord.value}%`
                            : '—'}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-center font-mono font-bold ${
                            group.tpInrRecord?.status === 'REPROVADO'
                              ? 'bg-red-50 text-red-700'
                              : group.tpInrRecord?.status === 'ALERTA'
                              ? 'bg-amber-50 text-amber-700'
                              : 'text-neutral-900'
                          }`}
                        >
                          {group.tpInrRecord?.value !== undefined
                            ? group.tpInrRecord.value.toFixed(2)
                            : '—'}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-center font-mono font-bold ${
                            group.ttpaRecord?.status === 'REPROVADO'
                              ? 'bg-red-50 text-red-700'
                              : group.ttpaRecord?.status === 'ALERTA'
                              ? 'bg-amber-50 text-amber-700'
                              : 'text-neutral-900'
                          }`}
                        >
                          {group.ttpaRecord?.value !== undefined
                            ? `${group.ttpaRecord.value}s`
                            : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-neutral-600">
                          {group.fibRecord?.value !== undefined
                            ? `${group.fibRecord.value} g/L`
                            : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <StatusBadge status={group.overallStatus} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right">
                          <button
                            type="button"
                            className="text-neutral-400 transition hover:text-red-600"
                            onClick={() => handleDeleteRun(group)}
                            title="Excluir corrida"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Painel do Gráfico Levey-Jennings */}
        <div className="lg:col-span-5">
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-bold text-neutral-900">Gráfico Levey-Jennings</h3>
                <p className="text-xs text-neutral-500">Curva de controle estatístico por parâmetro.</p>
              </div>
            </div>

            {/* Abas dos Analitos para o Gráfico */}
            <div className="flex flex-wrap gap-1 rounded-xl bg-neutral-100 p-1">
              {[
                { name: 'TP - Atividade (%)', label: 'TP (%)' },
                { name: 'TP - INR', label: 'INR' },
                { name: 'TTPa - Tempo (s)', label: 'TTPa (s)' },
                { name: 'Fibrinogênio (g/L)', label: 'Fibrinogênio' },
              ].map((tab) => (
                <button
                  key={tab.name}
                  type="button"
                  className={`flex-1 rounded-lg px-2.5 py-1.5 text-center text-xs font-bold transition ${
                    activeChartAnalyte === tab.name
                      ? 'bg-white text-green-900 shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                  onClick={() => setActiveChartAnalyte(tab.name)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Renderização do Gráfico ou Valores de Referência */}
            {chartRecords.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 p-6 text-center text-xs text-neutral-500">
                <Activity className="mb-2 h-8 w-8 text-neutral-300" />
                Sem pontos registrados para {activeChartAnalyte}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-neutral-600">
                  <span>
                    Total de pontos: <strong>{chartRecords.length}</strong>
                  </span>
                  {chartReference && (
                    <span className="font-mono text-[11px]">
                      Alvo: <strong>{chartReference.targetValue}</strong> · DP:{' '}
                      <strong>{chartReference.targetSd}</strong>
                    </span>
                  )}
                </div>

                {/* Lista visual dos últimos pontos com limites */}
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {chartRecords.slice(-8).map((rec) => {
                    const z = rec.zScore ?? 0
                    return (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/80 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-neutral-800">
                            {formatLongBR(rec.date)}
                          </span>
                          <span className="font-mono font-bold text-neutral-900">
                            {rec.value} {activeChartAnalyte.includes('%') ? '%' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-[11px] font-semibold ${
                              Math.abs(z) >= 3
                                ? 'text-red-600'
                                : Math.abs(z) >= 2
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                            }`}
                          >
                            Z: {z.toFixed(2)}
                          </span>
                          <StatusBadge status={rec.status} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

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

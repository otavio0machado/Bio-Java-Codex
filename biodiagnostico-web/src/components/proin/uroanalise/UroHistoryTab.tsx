import { useState, useMemo } from 'react'
import {
  Trash2,
  TestTube,
  Microscope,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react'
import { Card, Input, Select, StatusBadge, EmptyState, StatCard, useToast } from '../../ui'
import {
  useUroStripRuns,
  useUroSedimentRuns,
  useDeleteUroStripRun,
  useDeleteUroSedimentRun,
} from '../../../hooks/useUroanalise'
import { useAuth } from '../../../hooks/useAuth'
import { canWriteQc } from '../../../lib/permissions'
import { formatLongBR } from '../../../utils/date'
import { cn } from '../../../utils/cn'
import type { UroStripRun, UroSedimentRun } from '../../../types'

export function UroHistoryTab() {
  const { toast } = useToast()
  const { user } = useAuth()
  const canManage = canWriteQc(user)

  const [activeView, setActiveView] = useState<'strip' | 'sediment'>('strip')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APROVADO' | 'REPROVADO'>('ALL')

  const stripFilters = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [startDate, endDate]
  )

  const sedimentFilters = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [startDate, endDate]
  )

  const { data: stripRuns = [] } = useUroStripRuns(stripFilters)
  const { data: sedimentRuns = [] } = useUroSedimentRuns(sedimentFilters)

  const deleteStripRun = useDeleteUroStripRun()
  const deleteSedimentRun = useDeleteUroSedimentRun()

  // KPIs exclusivos da aba de histórico
  const totalRuns = stripRuns.length + sedimentRuns.length
  const reprovedCount = useMemo(() => {
    const stripReproved = stripRuns.filter((r) => r.statusGeral === 'REPROVADO').length
    const sedimentReproved = sedimentRuns.filter((r) => r.statusGeral === 'REPROVADO').length
    return stripReproved + sedimentReproved
  }, [stripRuns, sedimentRuns])

  const filteredStripRuns = useMemo(() => {
    return stripRuns.filter((r) => {
      if (statusFilter !== 'ALL' && r.statusGeral !== statusFilter) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchLot = r.controlLotSnapshot?.toLowerCase().includes(q)
        const matchReagent = r.reagentLotNumberSnapshot?.toLowerCase().includes(q) || r.reagentManufacturerSnapshot?.toLowerCase().includes(q)
        const matchAnalyst = r.analyst?.toLowerCase().includes(q)
        if (!matchLot && !matchReagent && !matchAnalyst) return false
      }
      return true
    })
  }, [stripRuns, statusFilter, searchTerm])

  const filteredSedimentRuns = useMemo(() => {
    return sedimentRuns.filter((r) => {
      if (statusFilter !== 'ALL' && r.statusGeral !== statusFilter) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchPatient = r.patientCode?.toLowerCase().includes(q)
        const matchA1 = r.analyst1Name?.toLowerCase().includes(q)
        const matchA2 = r.analyst2Name?.toLowerCase().includes(q)
        if (!matchPatient && !matchA1 && !matchA2) return false
      }
      return true
    })
  }, [sedimentRuns, statusFilter, searchTerm])

  const hasActiveFilters = Boolean(startDate || endDate || statusFilter !== 'ALL' || searchTerm.trim())

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setSearchTerm('')
    setStatusFilter('ALL')
  }

  const handleDeleteStrip = async (run: UroStripRun) => {
    if (!window.confirm(`Excluir corrida de fita do dia ${formatLongBR(run.dataMedicao)}?`)) return
    try {
      await deleteStripRun.mutateAsync(run.id)
      toast.success('Corrida de fita excluída com sucesso.')
    } catch {
      toast.error('Erro ao excluir corrida.')
    }
  }

  const handleDeleteSediment = async (run: UroSedimentRun) => {
    if (!window.confirm(`Excluir corrida de sedimento da amostra ${run.patientCode}?`)) return
    try {
      await deleteSedimentRun.mutateAsync(run.id)
      toast.success('Corrida de sedimento excluída com sucesso.')
    } catch {
      toast.error('Erro ao excluir corrida.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Grade de KPIs / StatCards exclusivamente no Histórico */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total de Corridas"
          value={totalRuns}
          icon={<TestTube className="h-5 w-5" />}
          iconColor="bg-green-800"
        />
        <StatCard
          label="Tiras Físico-Químico"
          value={stripRuns.length}
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconColor="bg-green-600"
        />
        <StatCard
          label="Sedimento (Dupla Leitura)"
          value={sedimentRuns.length}
          icon={<Microscope className="h-5 w-5" />}
          iconColor="bg-blue-600"
        />
        <StatCard
          label="Divergências / Ações"
          value={reprovedCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          iconColor={reprovedCount > 0 ? 'bg-red-500' : 'bg-neutral-400'}
        />
      </div>

      {/* Filtros Padronizados (idênticos ao padrão de Manutenção e Reagentes) */}
      <Card className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Data Inicial"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="Data Final"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <Select
            label="Status Geral"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="ALL">Todos os status</option>
            <option value="APROVADO">Aprovados</option>
            <option value="REPROVADO">Reprovados</option>
          </Select>
          <Input
            label="Busca Geral"
            placeholder={activeView === 'strip' ? 'Lote, reagente, analista...' : 'Paciente, analistas...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-500">Exibição:</span>
            <button
              type="button"
              onClick={() => setActiveView('strip')}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition flex items-center gap-1.5',
                activeView === 'strip'
                  ? 'bg-green-700 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              )}
            >
              <TestTube className="h-4 w-4" />
              Tiras de Urina ({filteredStripRuns.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveView('sediment')}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition flex items-center gap-1.5',
                activeView === 'sediment'
                  ? 'bg-green-700 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              )}
            >
              <Microscope className="h-4 w-4" />
              Sedimento Urinário ({filteredSedimentRuns.length})
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700"
            >
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
        </div>
      </Card>

      {/* Visualização de Tiras de Urina */}
      {activeView === 'strip' && (
        <div>
          {filteredStripRuns.length === 0 ? (
            <Card>
              <EmptyState
                icon={<TestTube className="h-8 w-8 text-neutral-400" />}
                title="Nenhum registro de fita reativa encontrado"
                description="Lançamentos do controle de tiras de urina aparecerão nesta tabela."
              />
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-xs">
              <table className="min-w-full divide-y divide-neutral-200 text-sm whitespace-nowrap">
                <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-600">
                  <tr>
                    <th className="py-3 px-4 text-left">Data</th>
                    <th className="py-3 px-4 text-left">Lote Controle</th>
                    <th className="py-3 px-4 text-left">Tira / Reagente</th>
                    <th className="py-3 px-4 text-center">pH</th>
                    <th className="py-3 px-4 text-center">Densidade</th>
                    <th className="py-3 px-4 text-center">Proteínas</th>
                    <th className="py-3 px-4 text-center">Glicose</th>
                    <th className="py-3 px-4 text-center">Status Geral</th>
                    <th className="py-3 px-4 text-left">Ação Corretiva</th>
                    <th className="py-3 px-4 text-left">Analista</th>
                    {canManage && <th className="py-3 px-4 text-center">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredStripRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-neutral-50/60 transition">
                      <td className="py-3 px-4 font-semibold text-neutral-900">
                        {formatLongBR(run.dataMedicao)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-neutral-800">{run.controlLotSnapshot}</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-600">
                        {run.reagentLotNumberSnapshot ? (
                          <span>
                            {run.reagentManufacturerSnapshot || run.reagentLabelSnapshot} — Lote: {run.reagentLotNumberSnapshot}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        {run.measuredPh?.toFixed(1) ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        {run.measuredDensity?.toFixed(3) ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-center text-xs font-medium">
                        {run.measuredProteins}
                      </td>
                      <td className="py-3 px-4 text-center text-xs font-medium">
                        {run.measuredGlucose}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={run.statusGeral} />
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-xs text-neutral-700" title={run.correctiveAction || ''}>
                        {run.correctiveAction ? (
                          <span className="text-red-700 font-medium">{run.correctiveAction}</span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-600">
                        {run.analyst || 'Sistema'}
                      </td>
                      {canManage && (
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteStrip(run)}
                            className="text-neutral-400 hover:text-red-600 p-1 rounded-md transition"
                            title="Excluir corrida"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Visualização de Sedimento Urinário */}
      {activeView === 'sediment' && (
        <div>
          {filteredSedimentRuns.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Microscope className="h-8 w-8 text-neutral-400" />}
                title="Nenhum ensaio inter-observador encontrado"
                description="Registros de dupla leitura de sedimento urinário aparecerão nesta tabela."
              />
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-xs">
              <table className="min-w-full divide-y divide-neutral-200 text-sm whitespace-nowrap">
                <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-600">
                  <tr>
                    <th className="py-3 px-4 text-left">Data</th>
                    <th className="py-3 px-4 text-left">Amostra / Paciente</th>
                    <th className="py-3 px-4 text-left">Analistas (1 vs 2)</th>
                    <th className="py-3 px-4 text-center">Leucócitos (CV)</th>
                    <th className="py-3 px-4 text-center">Hemácias (CV)</th>
                    <th className="py-3 px-4 text-center">Bactérias</th>
                    <th className="py-3 px-4 text-center">Status Geral</th>
                    <th className="py-3 px-4 text-left">Ação Corretiva</th>
                    {canManage && <th className="py-3 px-4 text-center">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredSedimentRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-neutral-50/60 transition">
                      <td className="py-3 px-4 font-semibold text-neutral-900">
                        {formatLongBR(run.dataMedicao)}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-neutral-800">
                        {run.patientCode}
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-700">
                        <strong>{run.analyst1Name}</strong> vs <strong>{run.analyst2Name}</strong>
                      </td>
                      <td className="py-3 px-4 text-center text-xs">
                        <span className="font-mono">
                          {run.leukocytesA1} vs {run.leukocytesA2}
                        </span>
                        <span className="ml-1.5 font-bold text-neutral-600">({run.leukocytesCv}%)</span>
                      </td>
                      <td className="py-3 px-4 text-center text-xs">
                        <span className="font-mono">
                          {run.erythrocytesA1} vs {run.erythrocytesA2}
                        </span>
                        <span className="ml-1.5 font-bold text-neutral-600">({run.erythrocytesCv}%)</span>
                      </td>
                      <td className="py-3 px-4 text-center text-xs">
                        {run.bacteriaA1 === run.bacteriaA2 ? (
                          <span>{run.bacteriaA1}</span>
                        ) : (
                          <span className="text-red-700 font-semibold">{run.bacteriaA1} vs {run.bacteriaA2}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={run.statusGeral} />
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-xs text-neutral-700" title={run.correctiveAction || ''}>
                        {run.correctiveAction ? (
                          <span className="text-red-700 font-medium">{run.correctiveAction}</span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      {canManage && (
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteSediment(run)}
                            className="text-neutral-400 hover:text-red-600 p-1 rounded-md transition"
                            title="Excluir ensaio"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

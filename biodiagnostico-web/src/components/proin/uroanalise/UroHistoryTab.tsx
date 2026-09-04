import { useState, useMemo } from 'react'
import {
  Trash2,
  TestTube,
  Microscope,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
} from 'lucide-react'
import { Card, Input, Select, StatusBadge, EmptyState, StatCard, Modal, Button, useToast } from '../../ui'
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
  const [selectedStrip, setSelectedStrip] = useState<UroStripRun | null>(null)
  const [selectedSediment, setSelectedSediment] = useState<UroSedimentRun | null>(null)

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
                    <th className="py-3 px-4 text-center">Corpos Cetônicos</th>
                    <th className="py-3 px-4 text-center">Sangue / Hb</th>
                    <th className="py-3 px-4 text-center">Urobilinogênio</th>
                    <th className="py-3 px-4 text-center">Nitrito</th>
                    <th className="py-3 px-4 text-center">Status Geral</th>
                    <th className="py-3 px-4 text-left">Ação Corretiva</th>
                    <th className="py-3 px-4 text-left">Analista</th>
                    <th className="py-3 px-4 text-left">Notas / Obs</th>
                    <th className="py-3 px-4 text-center">Ações</th>
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
                      <td className="py-3 px-4 text-center text-xs font-medium">
                        {run.measuredKetones || '—'}
                      </td>
                      <td className="py-3 px-4 text-center text-xs font-medium">
                        {run.measuredBlood || '—'}
                      </td>
                      <td className="py-3 px-4 text-center text-xs font-medium">
                        {run.measuredUrobilinogen || '—'}
                      </td>
                      <td className="py-3 px-4 text-center text-xs font-medium">
                        {run.measuredNitrite || '—'}
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
                      <td className="py-3 px-4 max-w-xs truncate text-xs text-neutral-500" title={run.notes || ''}>
                        {run.notes || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedStrip(run)}
                            className="text-neutral-500 hover:text-green-800 p-1.5 rounded-lg hover:bg-neutral-100 transition"
                            title="Ver todos os dados da fita"
                            aria-label="Ver detalhes da fita"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleDeleteStrip(run)}
                              className="text-neutral-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                              title="Excluir corrida"
                              aria-label="Excluir corrida"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
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
                    <th className="py-3 px-4 text-center">Células Epiteliais</th>
                    <th className="py-3 px-4 text-center">Filamento de Muco</th>
                    <th className="py-3 px-4 text-center">Cristais</th>
                    <th className="py-3 px-4 text-center">Outros</th>
                    <th className="py-3 px-4 text-center">Status Geral</th>
                    <th className="py-3 px-4 text-left">Ação Corretiva</th>
                    <th className="py-3 px-4 text-left">Notas / Obs</th>
                    <th className="py-3 px-4 text-center">Ações</th>
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
                      <td className="py-3 px-4 text-center text-xs">
                        {run.epithelialCellsA1 === run.epithelialCellsA2 ? (
                          <span>{run.epithelialCellsA1}</span>
                        ) : (
                          <span className="text-red-700 font-semibold">{run.epithelialCellsA1} vs {run.epithelialCellsA2}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-xs">
                        {run.mucusThreadsA1 === run.mucusThreadsA2 ? (
                          <span>{run.mucusThreadsA1}</span>
                        ) : (
                          <span className="text-red-700 font-semibold">{run.mucusThreadsA1} vs {run.mucusThreadsA2}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-xs">
                        {run.crystalsA1 === run.crystalsA2 ? (
                          <span>{run.crystalsA1}</span>
                        ) : (
                          <span className="text-red-700 font-semibold">{run.crystalsA1} vs {run.crystalsA2}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-xs">
                        {run.othersA1 === run.othersA2 ? (
                          <span>{run.othersA1}</span>
                        ) : (
                          <span className="text-red-700 font-semibold">{run.othersA1} vs {run.othersA2}</span>
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
                      <td className="py-3 px-4 max-w-xs truncate text-xs text-neutral-500" title={run.notes || ''}>
                        {run.notes || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedSediment(run)}
                            className="text-neutral-500 hover:text-green-800 p-1.5 rounded-lg hover:bg-neutral-100 transition"
                            title="Ver todos os dados do sedimento"
                            aria-label="Ver detalhes do sedimento"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSediment(run)}
                              className="text-neutral-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                              title="Excluir ensaio"
                              aria-label="Excluir ensaio"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de Detalhes da Fita Reativa (Todos os Dados do CQ de Uroanálise) */}
      {selectedStrip && (
        <Modal
          isOpen={Boolean(selectedStrip)}
          onClose={() => setSelectedStrip(null)}
          title="Todos os Dados do Controle de Qualidade — Tiras de Urina"
          size="lg"
          footer={
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedStrip(null)}>
                Fechar
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            {/* Metadados da Corrida */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 text-xs">
              <div>
                <span className="text-neutral-400 block font-medium">Data da Medição</span>
                <span className="font-semibold text-neutral-900">{formatLongBR(selectedStrip.dataMedicao)}</span>
              </div>
              <div>
                <span className="text-neutral-400 block font-medium">Lote de Controle</span>
                <span className="font-semibold text-neutral-900">{selectedStrip.controlLotSnapshot}</span>
              </div>
              <div>
                <span className="text-neutral-400 block font-medium">Analista Responsável</span>
                <span className="font-semibold text-neutral-900">{selectedStrip.analyst || 'Sistema'}</span>
              </div>
              <div>
                <span className="text-neutral-400 block font-medium">Status Geral</span>
                <div className="mt-0.5">
                  <StatusBadge status={selectedStrip.statusGeral} />
                </div>
              </div>
              {selectedStrip.reagentLotNumberSnapshot && (
                <div className="col-span-2 sm:col-span-4 border-t border-neutral-200/60 pt-2 text-neutral-600">
                  <span className="font-medium">Reagente/Tira: </span>
                  <span>
                    {selectedStrip.reagentManufacturerSnapshot || selectedStrip.reagentLabelSnapshot} — Lote: {selectedStrip.reagentLotNumberSnapshot}
                  </span>
                </div>
              )}
            </div>

            {/* Grid dos 8 Parâmetros da Fita Reativa com Seus Respectivos Status */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-green-800 mb-2.5">
                Constituintes da Fita Reativa (Físico-Químico)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border border-neutral-200 bg-white space-y-1">
                  <span className="text-xs text-neutral-500 block font-medium">pH</span>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold font-mono text-neutral-900">
                      {selectedStrip.measuredPh?.toFixed(1) ?? '—'}
                    </span>
                    <StatusBadge status={selectedStrip.statusPh} />
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-neutral-200 bg-white space-y-1">
                  <span className="text-xs text-neutral-500 block font-medium">Densidade</span>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold font-mono text-neutral-900">
                      {selectedStrip.measuredDensity?.toFixed(3) ?? '—'}
                    </span>
                    <StatusBadge status={selectedStrip.statusDensity} />
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-neutral-200 bg-white space-y-1">
                  <span className="text-xs text-neutral-500 block font-medium">Proteínas</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-neutral-900">{selectedStrip.measuredProteins}</span>
                    <StatusBadge status={selectedStrip.statusProteins} />
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-neutral-200 bg-white space-y-1">
                  <span className="text-xs text-neutral-500 block font-medium">Glicose</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-neutral-900">{selectedStrip.measuredGlucose}</span>
                    <StatusBadge status={selectedStrip.statusGlucose} />
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-neutral-200 bg-white space-y-1">
                  <span className="text-xs text-neutral-500 block font-medium">Corpos Cetônicos</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-neutral-900">{selectedStrip.measuredKetones}</span>
                    <StatusBadge status={selectedStrip.statusKetones} />
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-neutral-200 bg-white space-y-1">
                  <span className="text-xs text-neutral-500 block font-medium">Sangue / Hemoglobina</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-neutral-900">{selectedStrip.measuredBlood}</span>
                    <StatusBadge status={selectedStrip.statusBlood} />
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-neutral-200 bg-white space-y-1">
                  <span className="text-xs text-neutral-500 block font-medium">Urobilinogênio</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-neutral-900">{selectedStrip.measuredUrobilinogen}</span>
                    <StatusBadge status={selectedStrip.statusUrobilinogen} />
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-neutral-200 bg-white space-y-1">
                  <span className="text-xs text-neutral-500 block font-medium">Nitrito</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-neutral-900">{selectedStrip.measuredNitrite}</span>
                    <StatusBadge status={selectedStrip.statusNitrite} />
                  </div>
                </div>
              </div>
            </div>

            {/* Ação Corretiva se houver */}
            {selectedStrip.correctiveAction && (
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 space-y-1">
                <span className="text-xs font-bold text-red-800 uppercase tracking-wider block">
                  Ação Corretiva Registrada
                </span>
                <p className="text-sm text-red-900">{selectedStrip.correctiveAction}</p>
              </div>
            )}

            {/* Observações / Notas */}
            {selectedStrip.notes && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3.5 space-y-1">
                <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider block">
                  Observações Técnicas
                </span>
                <p className="text-sm text-neutral-800 whitespace-pre-wrap">{selectedStrip.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal de Detalhes do Sedimento (Todos os Dados do Ensaio Inter-Observador) */}
      {selectedSediment && (
        <Modal
          isOpen={Boolean(selectedSediment)}
          onClose={() => setSelectedSediment(null)}
          title="Todos os Dados do Controle de Qualidade — Sedimento Urinário"
          size="lg"
          footer={
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedSediment(null)}>
                Fechar
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            {/* Metadados do Ensaio */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 text-xs">
              <div>
                <span className="text-neutral-400 block font-medium">Data da Leitura</span>
                <span className="font-semibold text-neutral-900">{formatLongBR(selectedSediment.dataMedicao)}</span>
              </div>
              <div>
                <span className="text-neutral-400 block font-medium">Código do Paciente</span>
                <span className="font-semibold text-neutral-900 font-mono">{selectedSediment.patientCode}</span>
              </div>
              <div>
                <span className="text-neutral-400 block font-medium">Dupla Leitura</span>
                <span className="font-semibold text-neutral-900">
                  {selectedSediment.analyst1Name} vs {selectedSediment.analyst2Name}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block font-medium">Status Geral</span>
                <div className="mt-0.5">
                  <StatusBadge status={selectedSediment.statusGeral} />
                </div>
              </div>
            </div>

            {/* Tabela com Todos os 7 Constituintes Microscópicos */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-green-800 mb-2.5">
                Avaliação Comparativa de Sedimento Urinário (Microscopia)
              </h4>
              <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                <table className="min-w-full divide-y divide-neutral-200 text-sm">
                  <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-600">
                    <tr>
                      <th className="py-2.5 px-4 text-left">Parâmetro Microscópico</th>
                      <th className="py-2.5 px-4 text-center">{selectedSediment.analyst1Name}</th>
                      <th className="py-2.5 px-4 text-center">{selectedSediment.analyst2Name}</th>
                      <th className="py-2.5 px-4 text-center">Concordância / CV</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    <tr className="hover:bg-neutral-50/50">
                      <td className="py-2.5 px-4 font-semibold text-neutral-900">Leucócitos</td>
                      <td className="py-2.5 px-4 text-center font-mono">{selectedSediment.leukocytesA1}</td>
                      <td className="py-2.5 px-4 text-center font-mono">{selectedSediment.leukocytesA2}</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-neutral-700">
                        CV: {selectedSediment.leukocytesCv}%
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <StatusBadge status={selectedSediment.statusLeukocytes} />
                      </td>
                    </tr>
                    <tr className="hover:bg-neutral-50/50">
                      <td className="py-2.5 px-4 font-semibold text-neutral-900">Hemácias</td>
                      <td className="py-2.5 px-4 text-center font-mono">{selectedSediment.erythrocytesA1}</td>
                      <td className="py-2.5 px-4 text-center font-mono">{selectedSediment.erythrocytesA2}</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-neutral-700">
                        CV: {selectedSediment.erythrocytesCv}%
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <StatusBadge status={selectedSediment.statusErythrocytes} />
                      </td>
                    </tr>
                    <tr className="hover:bg-neutral-50/50">
                      <td className="py-2.5 px-4 font-semibold text-neutral-900">Bactérias</td>
                      <td className="py-2.5 px-4 text-center text-xs">{selectedSediment.bacteriaA1}</td>
                      <td className="py-2.5 px-4 text-center text-xs">{selectedSediment.bacteriaA2}</td>
                      <td className="py-2.5 px-4 text-center text-xs font-medium text-neutral-600">
                        {selectedSediment.bacteriaA1 === selectedSediment.bacteriaA2 ? 'Idêntico' : 'Divergente'}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <StatusBadge status={selectedSediment.statusBacteria} />
                      </td>
                    </tr>
                    <tr className="hover:bg-neutral-50/50">
                      <td className="py-2.5 px-4 font-semibold text-neutral-900">Células Epiteliais</td>
                      <td className="py-2.5 px-4 text-center text-xs">{selectedSediment.epithelialCellsA1}</td>
                      <td className="py-2.5 px-4 text-center text-xs">{selectedSediment.epithelialCellsA2}</td>
                      <td className="py-2.5 px-4 text-center text-xs font-medium text-neutral-600">
                        {selectedSediment.epithelialCellsA1 === selectedSediment.epithelialCellsA2 ? 'Idêntico' : 'Divergente'}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <StatusBadge status={selectedSediment.statusEpithelialCells} />
                      </td>
                    </tr>
                    <tr className="hover:bg-neutral-50/50">
                      <td className="py-2.5 px-4 font-semibold text-neutral-900">Filamento de Muco</td>
                      <td className="py-2.5 px-4 text-center text-xs">{selectedSediment.mucusThreadsA1}</td>
                      <td className="py-2.5 px-4 text-center text-xs">{selectedSediment.mucusThreadsA2}</td>
                      <td className="py-2.5 px-4 text-center text-xs font-medium text-neutral-600">
                        {selectedSediment.mucusThreadsA1 === selectedSediment.mucusThreadsA2 ? 'Idêntico' : 'Divergente'}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <StatusBadge status={selectedSediment.statusMucusThreads} />
                      </td>
                    </tr>
                    <tr className="hover:bg-neutral-50/50">
                      <td className="py-2.5 px-4 font-semibold text-neutral-900">Cristais</td>
                      <td className="py-2.5 px-4 text-center text-xs">{selectedSediment.crystalsA1}</td>
                      <td className="py-2.5 px-4 text-center text-xs">{selectedSediment.crystalsA2}</td>
                      <td className="py-2.5 px-4 text-center text-xs font-medium text-neutral-600">
                        {selectedSediment.crystalsA1 === selectedSediment.crystalsA2 ? 'Idêntico' : 'Divergente'}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <StatusBadge status={selectedSediment.statusCrystals} />
                      </td>
                    </tr>
                    <tr className="hover:bg-neutral-50/50">
                      <td className="py-2.5 px-4 font-semibold text-neutral-900">Outros</td>
                      <td className="py-2.5 px-4 text-center text-xs">{selectedSediment.othersA1}</td>
                      <td className="py-2.5 px-4 text-center text-xs">{selectedSediment.othersA2}</td>
                      <td className="py-2.5 px-4 text-center text-xs font-medium text-neutral-600">
                        {selectedSediment.othersA1 === selectedSediment.othersA2 ? 'Idêntico' : 'Divergente'}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <StatusBadge status={selectedSediment.statusOthers} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ação Corretiva se houver */}
            {selectedSediment.correctiveAction && (
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 space-y-1">
                <span className="text-xs font-bold text-red-800 uppercase tracking-wider block">
                  Ação Corretiva Registrada
                </span>
                <p className="text-sm text-red-900">{selectedSediment.correctiveAction}</p>
              </div>
            )}

            {/* Observações / Notas */}
            {selectedSediment.notes && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3.5 space-y-1">
                <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider block">
                  Observações Técnicas
                </span>
                <p className="text-sm text-neutral-800 whitespace-pre-wrap">{selectedSediment.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

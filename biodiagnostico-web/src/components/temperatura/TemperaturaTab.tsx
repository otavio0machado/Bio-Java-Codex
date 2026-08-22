import {
  CalendarDays,
  FileSpreadsheet,
  FileText,
  Settings,
  Thermometer,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  useTemperatureLocations,
  useTemperatureRecords,
  useTemperatureSummary,
} from '../../hooks/useTemperature'
import { canWriteTemperature } from '../../lib/permissions'
import { temperatureService } from '../../services/temperatureService'
import type { TemperatureLocation, TemperatureRecord } from '../../types/temperature'
import { Button, Card, Select, useToast } from '../ui'
import { TemperatureCaptureCard } from './TemperatureCaptureCard'
import { TemperatureChart } from './TemperatureChart'
import { TemperatureLocationModal } from './TemperatureLocationModal'
import { TemperatureLocationsTable } from './TemperatureLocationsTable'
import { TemperatureMonthlyTable } from './TemperatureMonthlyTable'
import { TemperatureRecordModal } from './TemperatureRecordModal'
import { TemperatureSummaryCards } from './TemperatureSummaryCards'

type ActiveTab = 'captura' | 'mapa' | 'equipamentos'

export function TemperaturaTab() {
  const { user } = useAuth()
  const { toast } = useToast()
  const canWrite = canWriteTemperature(user)
  const [activeTab, setActiveTab] = useState<ActiveTab>('captura')

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')

  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false)
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false)

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false)
  const [recordToEdit, setRecordToEdit] = useState<TemperatureRecord | null>(null)

  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false)
  const [locationToEdit, setLocationToEdit] = useState<TemperatureLocation | null>(null)

  const { data: summary, isLoading: loadingSummary } = useTemperatureSummary()
  const { data: locations } = useTemperatureLocations()
  const { data: records, isLoading: loadingRecords } = useTemperatureRecords({
    locationId: selectedLocationId || undefined,
    month: selectedMonth,
    year: selectedYear,
    status: selectedStatus || undefined,
  })

  // Localização para o gráfico
  const chartLocation = locations?.find((l) =>
    selectedLocationId ? l.id === selectedLocationId : l.id === (locations[0]?.id || '')
  )

  const chartRecords = (records || []).filter((r) =>
    chartLocation ? r.locationId === chartLocation.id : true
  )

  const handleEditRecord = (record: TemperatureRecord) => {
    setRecordToEdit(record)
    setIsRecordModalOpen(true)
  }

  const handleOpenNewLocation = () => {
    setLocationToEdit(null)
    setIsLocationModalOpen(true)
  }

  const handleEditLocation = (location: TemperatureLocation) => {
    setLocationToEdit(location)
    setIsLocationModalOpen(true)
  }

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true)
      const blob = await temperatureService.exportExcel(
        selectedLocationId || undefined,
        selectedMonth,
        selectedYear
      )
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Controle_Temperatura_${String(selectedMonth).padStart(2, '0')}_${selectedYear}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Planilha exportada com sucesso!')
    } catch {
      toast.error('Erro ao exportar planilha.')
    } finally {
      setIsExportingExcel(false)
    }
  }

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true)
      const blob = await temperatureService.exportPdf(
        selectedLocationId || undefined,
        selectedMonth,
        selectedYear
      )
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Relatorio_Temperatura_${String(selectedMonth).padStart(2, '0')}_${selectedYear}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Folha mensal PDF gerada com sucesso!')
    } catch {
      toast.error('Erro ao gerar relatório PDF.')
    } finally {
      setIsExportingPdf(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header Principal */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm shadow-emerald-700/20">
              <Thermometer className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                Controle de Temperatura & Termohigrometria
              </h1>
              <p className="text-sm text-neutral-500">
                Monitoramento diário de cadeia de frio, estufas, banho-maria e salas técnicas (RDC 786/2023).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Resumo / KPIs */}
      <TemperatureSummaryCards summary={summary} isLoading={loadingSummary} />

      {/* Navegação por Abas */}
      <div className="border-b border-neutral-200">
        <nav className="flex space-x-8" aria-label="Abas de Temperatura">
          <button
            type="button"
            onClick={() => setActiveTab('captura')}
            className={`flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-semibold transition-colors ${
              activeTab === 'captura'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
            }`}
          >
            <Thermometer className="h-4 w-4" />
            Registro Diário
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mapa')}
            className={`flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-semibold transition-colors ${
              activeTab === 'mapa'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            Histórico & Gráficos
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('equipamentos')}
            className={`flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-semibold transition-colors ${
              activeTab === 'equipamentos'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
            }`}
          >
            <Settings className="h-4 w-4" />
            Equipamentos & Calibração
          </button>
        </nav>
      </div>

      {/* Aba 1: Registro Diário */}
      {activeTab === 'captura' && (
        <div className="space-y-8">
          <TemperatureCaptureCard />
        </div>
      )}

      {/* Aba 2: Histórico & Gráficos */}
      {activeTab === 'mapa' && (
        <div className="space-y-6">
          {/* Painel Unificado de Filtros e Exportação */}
          <Card className="border-neutral-200/80 bg-white p-4 sm:p-5 shadow-sm sm:rounded-3xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 lg:flex lg:items-center">
                <div className="w-full sm:w-64">
                  <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                    Equipamento / Ponto:
                  </label>
                  <Select
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                  >
                    <option value="">Todos os Equipamentos</option>
                    {locations?.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.code})
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="w-full sm:w-36">
                  <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                    Mês de Referência:
                  </label>
                  <Select
                    value={String(selectedMonth)}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  >
                    <option value="1">Janeiro</option>
                    <option value="2">Fevereiro</option>
                    <option value="3">Março</option>
                    <option value="4">Abril</option>
                    <option value="5">Maio</option>
                    <option value="6">Junho</option>
                    <option value="7">Julho</option>
                    <option value="8">Agosto</option>
                    <option value="9">Setembro</option>
                    <option value="10">Outubro</option>
                    <option value="11">Novembro</option>
                    <option value="12">Dezembro</option>
                  </Select>
                </div>

                <div className="w-full sm:w-28">
                  <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                    Ano:
                  </label>
                  <Select
                    value={String(selectedYear)}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                  >
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </Select>
                </div>

                <div className="w-full sm:w-40">
                  <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                    Filtro de Status:
                  </label>
                  <Select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  >
                    <option value="">Todos os Status</option>
                    <option value="CONFORME">Apenas Conformes</option>
                    <option value="NAO_CONFORME">Não Conformes</option>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExportExcel}
                  loading={isExportingExcel}
                >
                  <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-600" />
                  Exportar Excel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExportPdf}
                  loading={isExportingPdf}
                >
                  <FileText className="mr-1.5 h-4 w-4 text-rose-600" />
                  Folha Mensal PDF
                </Button>
              </div>
            </div>
          </Card>

          {/* Gráfico Térmico */}
          <TemperatureChart
            location={chartLocation}
            records={chartRecords}
            month={selectedMonth}
            year={selectedYear}
          />

          {/* Tabela de Medições do Período */}
          <TemperatureMonthlyTable
            records={records || []}
            isLoading={loadingRecords}
            canWrite={canWrite}
            onEditRecord={handleEditRecord}
          />
        </div>
      )}

      {/* Aba 3: Equipamentos & Calibração */}
      {activeTab === 'equipamentos' && (
        <TemperatureLocationsTable
          onNewLocation={handleOpenNewLocation}
          onEditLocation={handleEditLocation}
        />
      )}

      {/* Modais */}
      {isRecordModalOpen && (
        <TemperatureRecordModal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          recordToEdit={recordToEdit}
        />
      )}

      {isLocationModalOpen && (
        <TemperatureLocationModal
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
          locationToEdit={locationToEdit}
        />
      )}
    </div>
  )
}

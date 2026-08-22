import {
  CalendarDays,
  Plus,
  Settings,
  Sparkles,
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
import type { TemperatureLocation, TemperatureRecord } from '../../types/temperature'
import { Button, Select } from '../ui'
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
  const canWrite = canWriteTemperature(user)
  const [activeTab, setActiveTab] = useState<ActiveTab>('captura')

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())
  const [selectedChartLocationId, setSelectedChartLocationId] = useState<string>('')

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false)
  const [recordToEdit, setRecordToEdit] = useState<TemperatureRecord | null>(null)

  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false)
  const [locationToEdit, setLocationToEdit] = useState<TemperatureLocation | null>(null)

  const { data: summary, isLoading: loadingSummary } = useTemperatureSummary()
  const { data: locations } = useTemperatureLocations()
  const { data: recordsForChart } = useTemperatureRecords({
    locationId: selectedChartLocationId || (locations && locations.length > 0 ? locations[0].id : undefined),
    month: selectedMonth,
    year: selectedYear,
  })

  const currentChartLocation = locations?.find(
    (l) => l.id === (selectedChartLocationId || (locations.length > 0 ? locations[0].id : ''))
  )

  const handleOpenNewRecord = () => {
    setRecordToEdit(null)
    setIsRecordModalOpen(true)
  }

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

        {canWrite && (
          <div className="flex items-center gap-2">
            <Button onClick={handleOpenNewRecord}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Lançamento
            </Button>
          </div>
        )}
      </div>

      {/* Cards de Resumo / KPIs */}
      <TemperatureSummaryCards summary={summary} isLoading={loadingSummary} />

      {/* Navegação por Abas */}
      <div className="border-b border-neutral-200">
        <nav className="flex space-x-8" aria-label="Abas de Temperatura">
          <button
            type="button"
            onClick={() => setActiveTab('captura')}
            className={`flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === 'captura'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Lançamento Rápido & Foto (IA)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mapa')}
            className={`flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === 'mapa'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            Mapa Mensal & Gráficos
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('equipamentos')}
            className={`flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
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

      {/* Conteúdo da Aba Selecionada */}
      {activeTab === 'captura' && (
        <div className="space-y-8">
          <TemperatureCaptureCard />
        </div>
      )}

      {activeTab === 'mapa' && (
        <div className="space-y-8">
          {/* Seletor de Ponto para Gráfico */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-80">
              <label className="block text-xs font-semibold text-neutral-600 mb-1">
                Visualizar Gráfico do Equipamento:
              </label>
              <Select
                value={selectedChartLocationId || (locations && locations.length > 0 ? locations[0].id : '')}
                onChange={(e) => setSelectedChartLocationId(e.target.value)}
              >
                {locations?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-36">
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Mês:</label>
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

              <div className="w-28">
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Ano:</label>
                <Select
                  value={String(selectedYear)}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </Select>
              </div>
            </div>
          </div>

          <TemperatureChart
            location={currentChartLocation}
            records={recordsForChart || []}
            month={selectedMonth}
            year={selectedYear}
          />

          <TemperatureMonthlyTable
            onNewRecord={handleOpenNewRecord}
            onEditRecord={handleEditRecord}
          />
        </div>
      )}

      {activeTab === 'equipamentos' && (
        <TemperatureLocationsTable
          onNewLocation={handleOpenNewLocation}
          onEditLocation={handleEditLocation}
        />
      )}

      {/* Modais Globais */}
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

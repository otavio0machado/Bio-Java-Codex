import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TemperaturaTab } from './TemperaturaTab'
import { ToastProvider } from '../ui'
import type { TemperatureLocation, TemperatureRecord, TemperatureSummary } from '../../types/temperature'

const mockSummary: TemperatureSummary = {
  totalLocations: 7,
  activeLocations: 7,
  recordedToday: 5,
  pendingToday: 2,
  nonCompliantToday: 0,
  nonCompliantMonth: 1,
  expiringCalibrationsCount: 1,
}

const mockLocations: TemperatureLocation[] = [
  {
    id: 'loc-1',
    name: 'Geladeira 1 - Reagentes Bioquímica',
    code: 'GEL-01',
    category: 'GELADEIRA',
    area: 'BIOQUIMICA',
    minTempTarget: 2.0,
    maxTempTarget: 8.0,
    minHumidityTarget: null,
    maxHumidityTarget: null,
    thermometerCode: 'TERM-01 (Incoterm)',
    calibrationCertNumber: 'CAL-2026/089',
    calibrationDueDate: '2027-02-15',
    frequency: 'DIARIO_1X',
    active: true,
    notes: 'Geladeira principal',
    createdAt: '2026-08-22T10:00:00Z',
    updatedAt: '2026-08-22T10:00:00Z',
  },
  {
    id: 'loc-2',
    name: 'Freezer -20°C Amostras',
    code: 'FRZ-01',
    category: 'FREEZER',
    area: 'GERAL',
    minTempTarget: -25.0,
    maxTempTarget: -15.0,
    minHumidityTarget: null,
    maxHumidityTarget: null,
    thermometerCode: 'TERM-02',
    calibrationCertNumber: 'CAL-2026/090',
    calibrationDueDate: '2026-09-01',
    frequency: 'DIARIO_1X',
    active: true,
    notes: 'Freezer de soros',
    createdAt: '2026-08-22T10:00:00Z',
    updatedAt: '2026-08-22T10:00:00Z',
  },
]

const mockRecords: TemperatureRecord[] = [
  {
    id: 'rec-1',
    locationId: 'loc-1',
    locationName: 'Geladeira 1 - Reagentes Bioquímica',
    locationCode: 'GEL-01',
    category: 'GELADEIRA',
    area: 'BIOQUIMICA',
    minTempTarget: 2.0,
    maxTempTarget: 8.0,
    date: '2026-08-22',
    time: '08:15:00',
    period: 'UNICO',
    tempMax: 5.2,
    tempMin: 3.1,
    tempCurrent: 4.0,
    humidity: null,
    status: 'CONFORME',
    responsible: 'Dr. Farmacêutico',
    actionTaken: null,
    notes: 'Tudo ok',
    ocrApplied: true,
    photoUrl: null,
    photoFilename: 'foto_geladeira.jpg',
    createdAt: '2026-08-22T08:15:00Z',
  },
]

const mockUseTemperatureSummary = vi.fn()
const mockUseTemperatureLocations = vi.fn()
const mockUseTemperatureRecords = vi.fn()
const mockUseCreateTemperatureLocation = vi.fn()
const mockUseUpdateTemperatureLocation = vi.fn()
const mockUseDeleteTemperatureLocation = vi.fn()
const mockUseCreateTemperatureRecord = vi.fn()
const mockUseUpdateTemperatureRecord = vi.fn()
const mockUseDeleteTemperatureRecord = vi.fn()
const mockUseProcessTemperaturePhoto = vi.fn()

vi.mock('../../hooks/useTemperature', () => ({
  useTemperatureSummary: () => mockUseTemperatureSummary(),
  useTemperatureLocations: () => mockUseTemperatureLocations(),
  useTemperatureRecords: () => mockUseTemperatureRecords(),
  useCreateTemperatureLocation: () => mockUseCreateTemperatureLocation(),
  useUpdateTemperatureLocation: () => mockUseUpdateTemperatureLocation(),
  useDeleteTemperatureLocation: () => mockUseDeleteTemperatureLocation(),
  useCreateTemperatureRecord: () => mockUseCreateTemperatureRecord(),
  useUpdateTemperatureRecord: () => mockUseUpdateTemperatureRecord(),
  useDeleteTemperatureRecord: () => mockUseDeleteTemperatureRecord(),
  useProcessTemperaturePhoto: () => mockUseProcessTemperaturePhoto(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-1',
      name: 'Dr. Farmacêutico',
      username: 'farmaceutico',
      role: 'ADMIN',
      permissions: ['TEMPERATURE_WRITE', 'QC_WRITE'],
    },
  }),
}))

describe('TemperaturaTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTemperatureSummary.mockReturnValue({ data: mockSummary, isLoading: false })
    mockUseTemperatureLocations.mockReturnValue({ data: mockLocations, isLoading: false })
    mockUseTemperatureRecords.mockReturnValue({ data: mockRecords, isLoading: false })
    mockUseCreateTemperatureLocation.mockReturnValue({ mutate: vi.fn(), isPending: false })
    mockUseUpdateTemperatureLocation.mockReturnValue({ mutate: vi.fn(), isPending: false })
    mockUseDeleteTemperatureLocation.mockReturnValue({ mutate: vi.fn(), isPending: false })
    mockUseCreateTemperatureRecord.mockReturnValue({ mutate: vi.fn(), isPending: false })
    mockUseUpdateTemperatureRecord.mockReturnValue({ mutate: vi.fn(), isPending: false })
    mockUseDeleteTemperatureRecord.mockReturnValue({ mutate: vi.fn(), isPending: false })
    mockUseProcessTemperaturePhoto.mockReturnValue({ mutate: vi.fn(), isPending: false })
  })

  const renderComponent = () => {
    return render(
      <ToastProvider>
        <TemperaturaTab />
      </ToastProvider>
    )
  }

  it('renderiza título, KPIs e card de captura rápida', () => {
    renderComponent()

    expect(
      screen.getByText('Controle de Temperatura & Termohigrometria')
    ).toBeInTheDocument()
    expect(screen.getByText('Pontos Ativos')).toBeInTheDocument()
    expect(screen.getByText('7 / 7')).toBeInTheDocument()
    expect(screen.getByText('Monitoramento Hoje')).toBeInTheDocument()
    expect(screen.getByText('5 de 7')).toBeInTheDocument()
    expect(
      screen.getByText('Lançamento Rápido & Leitura de Foto (IA)')
    ).toBeInTheDocument()
  })

  it('permite alternar para a aba Mapa Mensal & Gráficos e exibe registros', () => {
    renderComponent()

    const mapaTab = screen.getByRole('button', { name: /mapa mensal & gráficos/i })
    fireEvent.click(mapaTab)

    expect(screen.getByText('Curva de Controle Térmico — Geladeira 1 - Reagentes Bioquímica')).toBeInTheDocument()
    expect(screen.getByText('Dr. Farmacêutico')).toBeInTheDocument()
    expect(screen.getByText('CONFORME')).toBeInTheDocument()
  })

  it('permite alternar para a aba Equipamentos & Calibração', () => {
    renderComponent()

    const equipTab = screen.getByRole('button', { name: /equipamentos & calibração/i })
    fireEvent.click(equipTab)

    expect(screen.getByText('Pontos de Monitoramento & Cadeia de Frio')).toBeInTheDocument()
    expect(screen.getByText('Geladeira 1 - Reagentes Bioquímica')).toBeInTheDocument()
    expect(screen.getByText('Freezer -20°C Amostras')).toBeInTheDocument()
    expect(screen.getByText('Novo Equipamento')).toBeInTheDocument()
  })
})

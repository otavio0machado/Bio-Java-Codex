import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ManutencaoTab } from './ManutencaoTab'
import type { MaintenanceRecord } from '../../types'
import { ToastProvider } from '../ui'

const mockUseMaintenanceRecords = vi.fn()
const mockUseCreateMaintenanceRecord = vi.fn()
const mockUseUpdateMaintenanceRecord = vi.fn()
const mockUseDeleteMaintenanceRecord = vi.fn()
const mockUseSuggestObservation = vi.fn()

vi.mock('../../hooks/useMaintenance', () => ({
  useMaintenanceRecords: () => mockUseMaintenanceRecords(),
  useCreateMaintenanceRecord: () => mockUseCreateMaintenanceRecord(),
  useUpdateMaintenanceRecord: () => mockUseUpdateMaintenanceRecord(),
  useDeleteMaintenanceRecord: () => mockUseDeleteMaintenanceRecord(),
}))

vi.mock('../../hooks/useAiAssist', () => ({
  useSuggestObservation: () => mockUseSuggestObservation(),
}))

describe('ManutencaoTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCreateMaintenanceRecord.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseUpdateMaintenanceRecord.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseDeleteMaintenanceRecord.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseSuggestObservation.mockReturnValue({ mutate: vi.fn(), isPending: false, data: null })
  })

  const renderComponent = () => {
    return render(
      <ToastProvider>
        <ManutencaoTab />
      </ToastProvider>
    )
  }

  it('calcula KPIs e badges considerando apenas o ciclo ativo mais recente por equipamento', () => {
    // Cenário real do usuário: COBAS MIRA tem múltiplos registros passados com nextDate vencida,
    // e o registro mais recente (14/08/2026) está em dia sem próxima data.
    const mockRecords: MaintenanceRecord[] = [
      {
        id: '1',
        equipment: 'COBAS MIRA',
        type: 'Preventiva',
        date: '2026-04-10',
        nextDate: '2026-04-24', // Vencida no passado
        technician: 'Carlos',
        notes: 'Manutenção antiga 1',
        createdAt: '2026-04-10T10:00:00Z',
      },
      {
        id: '2',
        equipment: 'COBAS MIRA',
        type: 'Preventiva',
        date: '2026-05-15',
        nextDate: '2026-05-29', // Vencida no passado
        technician: 'Carlos',
        notes: 'Manutenção antiga 2',
        createdAt: '2026-05-15T10:00:00Z',
      },
      {
        id: '3',
        equipment: 'COBAS MIRA',
        type: 'Preventiva',
        date: '2026-08-14',
        nextDate: undefined, // Última manutenção realizada
        technician: 'Carlos',
        notes: 'Manutenção recente',
        createdAt: '2026-08-14T10:00:00Z',
      },
    ]

    mockUseMaintenanceRecords.mockReturnValue({ data: mockRecords })

    renderComponent()

    // KPI total de registros deve ser 3
    expect(screen.getByText('Total de registros')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    // KPI de atrasadas deve ser 0 (pois o equipamento está em dia no seu ciclo ativo)
    const overdueStat = screen.getByText('Atrasadas').closest('button')
    expect(overdueStat).toHaveTextContent('0')

    // Registros passados (id 1 e 2) devem ter badge "Realizada"
    const realizadas = screen.getAllByText('Realizada')
    expect(realizadas).toHaveLength(2)

    // Registro ativo (id 3) deve ter badge "Em dia"
    const emDia = screen.getAllByText('Em dia')
    expect(emDia.length).toBeGreaterThanOrEqual(1)

    // Não deve haver texto de atraso para os registros passados
    expect(screen.queryByText(/atraso/i)).not.toBeInTheDocument()
  })

  it('identifica equipamento como Atrasado quando seu registro mais recente está com nextDate vencida', () => {
    const mockRecords: MaintenanceRecord[] = [
      {
        id: '1',
        equipment: 'MINDRAY BC-3000',
        type: 'Preventiva',
        date: '2026-01-10',
        nextDate: '2026-02-10', // Vencida
        technician: 'João',
        notes: 'Última manutenção realizada há meses sem nova intervenção',
        createdAt: '2026-01-10T10:00:00Z',
      },
    ]

    mockUseMaintenanceRecords.mockReturnValue({ data: mockRecords })

    renderComponent()

    // KPI de atrasadas deve ser 1
    const overdueStat = screen.getByText('Atrasadas').closest('button')
    expect(overdueStat).toHaveTextContent('1')

    // Badge Atrasada no card + botão de filtro
    const atrasadas = screen.getAllByText('Atrasada')
    expect(atrasadas.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/atraso/i)).toBeInTheDocument()
  })

  it('permite filtrar por Realizadas e exibe histórico completo no modal', async () => {
    const mockRecords: MaintenanceRecord[] = [
      {
        id: '1',
        equipment: 'COBAS MIRA',
        type: 'Preventiva',
        date: '2026-04-10',
        nextDate: '2026-04-24',
        technician: 'Carlos',
        notes: 'Registro antigo',
        createdAt: '2026-04-10T10:00:00Z',
      },
      {
        id: '2',
        equipment: 'COBAS MIRA',
        type: 'Preventiva',
        date: '2026-08-14',
        nextDate: undefined,
        technician: 'Carlos',
        notes: 'Registro mais recente',
        createdAt: '2026-08-14T10:00:00Z',
      },
    ]

    mockUseMaintenanceRecords.mockReturnValue({ data: mockRecords })

    renderComponent()

    // Clica no filtro "Realizadas"
    const filterRealizadas = screen.getByRole('button', { name: 'Realizadas' })
    fireEvent.click(filterRealizadas)

    // Deve exibir apenas o registro passado
    expect(screen.getByText('Registro antigo')).toBeInTheDocument()
    expect(screen.queryByText('Registro mais recente')).not.toBeInTheDocument()

    // Clica no link do equipamento para abrir o histórico
    const equipLink = screen.getByRole('button', { name: 'COBAS MIRA' })
    fireEvent.click(equipLink)

    // Modal de histórico deve abrir com os dados
    expect(screen.getByText('Histórico — COBAS MIRA')).toBeInTheDocument()
    expect(screen.getByText('Manutenções em dia')).toBeInTheDocument()
  })
})

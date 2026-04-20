import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../../contexts/auth-context'
import type { ReagentLot, ReagentTagSummary } from '../../types'
import { ToastProvider } from '../ui'
import { ReagentesTab } from './ReagentesTab'

const mockUseReagentLots = vi.fn()
const mockUseCreateReagentLot = vi.fn()
const mockUseUpdateReagentLot = vi.fn()
const mockUseCreateStockMovement = vi.fn()
const mockUseReagentMovements = vi.fn()

const mockGetTagSummaries = vi.fn()
const mockExportCsv = vi.fn()
const mockGetReagentsPdf = vi.fn()

vi.mock('../../hooks/useReagents', () => ({
  useReagentLots: (...args: unknown[]) => mockUseReagentLots(...args),
  useCreateReagentLot: () => mockUseCreateReagentLot(),
  useUpdateReagentLot: () => mockUseUpdateReagentLot(),
  useCreateStockMovement: (...args: unknown[]) => mockUseCreateStockMovement(...args),
  useReagentMovements: (...args: unknown[]) => mockUseReagentMovements(...args),
}))

vi.mock('../../services/reagentService', () => ({
  reagentService: {
    getTagSummaries: (...args: unknown[]) => mockGetTagSummaries(...args),
    exportCsv: (...args: unknown[]) => mockExportCsv(...args),
  },
}))

vi.mock('../../services/reportService', () => ({
  reportService: {
    getReagentsPdf: (...args: unknown[]) => mockGetReagentsPdf(...args),
  },
}))

vi.mock('./VoiceRecorderModal', () => ({
  VoiceRecorderModal: ({ buttonLabel = 'Preencher por voz' }: { buttonLabel?: string }) => (
    <button type="button">{buttonLabel}</button>
  ),
}))

const createLotMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
}

const updateLotMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
}

const createMovementMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
}

const tagSummaries: ReagentTagSummary[] = [
  { name: 'ALT', total: 2, ativos: 1, emUso: 1, inativos: 0, vencidos: 0 },
]

const authValue: AuthContextValue = {
  user: {
    id: 'user-1',
    username: 'ana',
    email: 'ana@example.com',
    name: 'Ana',
    role: 'FUNCIONARIO',
    isActive: true,
    permissions: [],
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  restoreSession: vi.fn(),
}

function buildLot(overrides: Partial<ReagentLot> = {}): ReagentLot {
  return {
    id: crypto.randomUUID(),
    name: 'ALT',
    lotNumber: 'L123',
    manufacturer: 'BioLab',
    category: 'Bioquímica',
    expiryDate: '2026-06-30',
    quantityValue: 100,
    stockUnit: 'frascos',
    currentStock: 80,
    estimatedConsumption: 4,
    storageTemp: '2-8°C',
    startDate: '2026-04-01',
    endDate: '',
    status: 'ativo',
    alertThresholdDays: 7,
    createdAt: '2026-04-16T12:00:00Z',
    updatedAt: '2026-04-16T12:00:00Z',
    daysLeft: 20,
    stockPct: 80,
    daysToRupture: 20,
    nearExpiry: false,
    location: 'Geladeira 1',
    supplier: 'Fornecedor X',
    receivedDate: '2026-03-01',
    openedDate: '2026-04-01',
    usedInQcRecently: true,
    ...overrides,
  }
}

function renderTab() {
  return render(
    <AuthContext.Provider value={authValue}>
      <ToastProvider>
        <ReagentesTab />
      </ToastProvider>
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  createLotMutation.mutateAsync.mockReset()
  updateLotMutation.mutateAsync.mockReset()
  createMovementMutation.mutateAsync.mockReset()

  mockUseReagentLots.mockReset()
  mockUseCreateReagentLot.mockReset()
  mockUseUpdateReagentLot.mockReset()
  mockUseCreateStockMovement.mockReset()
  mockUseReagentMovements.mockReset()
  mockGetTagSummaries.mockReset()
  mockExportCsv.mockReset()
  mockGetReagentsPdf.mockReset()

  mockUseCreateReagentLot.mockReturnValue(createLotMutation)
  mockUseUpdateReagentLot.mockReturnValue(updateLotMutation)
  mockUseCreateStockMovement.mockReturnValue(createMovementMutation)
  mockUseReagentMovements.mockReturnValue({ data: [] })
  mockGetTagSummaries.mockResolvedValue(tagSummaries)
  mockExportCsv.mockResolvedValue(new Blob(['csv']))
  mockGetReagentsPdf.mockResolvedValue(new Blob(['pdf']))
})

describe('ReagentesTab', () => {
  it('renderiza a lista e aplica busca por reagente ou lote', async () => {
    mockUseReagentLots.mockReturnValue({
      data: [
        buildLot({ name: 'ALT', lotNumber: 'ALT-001' }),
        buildLot({ name: 'AST', lotNumber: 'AST-002', manufacturer: 'OutroFab' }),
      ],
    })

    renderTab()

    expect(screen.getByText('Gestão de Reagentes')).toBeInTheDocument()
    expect(screen.getByText('ALT')).toBeInTheDocument()
    expect(screen.getByText('AST')).toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText('Buscar reagente ou lote...'), 'AST-002')

    expect(screen.queryByText('ALT')).not.toBeInTheDocument()
    expect(screen.getByText('AST')).toBeInTheDocument()
  })

  it('valida fabricante antes de cadastrar lote novo', async () => {
    mockUseReagentLots.mockReturnValue({ data: [buildLot()] })

    renderTab()

    await userEvent.click(screen.getByRole('button', { name: 'Novo Lote' }))
    await userEvent.type(screen.getByLabelText('Nome / Etiqueta'), 'TSH')
    await userEvent.type(screen.getByLabelText('Nº do Lote'), 'TSH-100')
    await userEvent.clear(screen.getByLabelText('Fabricante *'))
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))

    expect(await screen.findByText('Informe o fabricante do lote.')).toBeInTheDocument()
    expect(createLotMutation.mutateAsync).not.toHaveBeenCalled()
  })

  it('exige motivo em saída que zera o estoque', async () => {
    mockUseReagentLots.mockReturnValue({
      data: [buildLot({ currentStock: 10, quantityValue: 10, stockPct: 100 })],
    })

    renderTab()

    await userEvent.click(screen.getByRole('button', { name: 'Movimentar' }))
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'SAIDA')
    await userEvent.clear(screen.getByLabelText('Quantidade'))
    await userEvent.type(screen.getByLabelText('Quantidade'), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(
      await screen.findByText(
        'Selecione um motivo: AJUSTE e saídas que zeram o estoque exigem justificativa.',
      ),
    ).toBeInTheDocument()
    expect(createMovementMutation.mutateAsync).not.toHaveBeenCalled()
  })

  it('carrega a visão de etiquetas ao alternar o modo', async () => {
    mockUseReagentLots.mockReturnValue({
      data: [buildLot({ name: 'ALT' }), buildLot({ name: 'ALT', lotNumber: 'ALT-002', status: 'em_uso' })],
    })

    renderTab()

    await userEvent.click(screen.getByRole('button', { name: 'Ver etiquetas' }))

    await waitFor(() => {
      expect(mockGetTagSummaries).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByText('2 lotes')).toBeInTheDocument()
  })
})

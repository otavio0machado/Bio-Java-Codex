import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../../contexts/auth-context'
import type {
  ReagentLabelSummary,
  ReagentLot,
  ReagentLotRequest,
  ResponsibleSummary,
} from '../../types'
import { ToastProvider } from '../ui'
import { ReagentesTab } from './ReagentesTab'

const mockUseReagentLots = vi.fn()
const mockUseReagentLabels = vi.fn()
const mockUseResponsibles = vi.fn()
const mockUseCreateReagentLot = vi.fn()
const mockUseUpdateReagentLot = vi.fn()
const mockUseDeleteReagentLot = vi.fn()
const mockUseArchiveReagentLot = vi.fn()
const mockUseUnarchiveReagentLot = vi.fn()
const mockUseCreateStockMovement = vi.fn()
const mockUseReagentMovements = vi.fn()

const mockGetLabelSummaries = vi.fn()
const mockExportCsv = vi.fn()
const mockGetReagentsPdf = vi.fn()
const mockCreateMovementService = vi.fn()

vi.mock('../../hooks/useReagents', () => ({
  useReagentLots: (...args: unknown[]) => mockUseReagentLots(...args),
  useReagentLabels: (...args: unknown[]) => mockUseReagentLabels(...args),
  useResponsibles: (...args: unknown[]) => mockUseResponsibles(...args),
  useCreateReagentLot: () => mockUseCreateReagentLot(),
  useUpdateReagentLot: () => mockUseUpdateReagentLot(),
  useDeleteReagentLot: () => mockUseDeleteReagentLot(),
  useArchiveReagentLot: () => mockUseArchiveReagentLot(),
  useUnarchiveReagentLot: () => mockUseUnarchiveReagentLot(),
  useCreateStockMovement: (...args: unknown[]) => mockUseCreateStockMovement(...args),
  useReagentMovements: (...args: unknown[]) => mockUseReagentMovements(...args),
}))

vi.mock('../../services/reagentService', () => ({
  reagentService: {
    getLabelSummaries: (...args: unknown[]) => mockGetLabelSummaries(...args),
    exportCsv: (...args: unknown[]) => mockExportCsv(...args),
    createMovement: (...args: unknown[]) => mockCreateMovementService(...args),
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

const createLotMutation = { mutateAsync: vi.fn(), isPending: false }
const updateLotMutation = { mutateAsync: vi.fn(), isPending: false }
const deleteLotMutation = { mutateAsync: vi.fn(), isPending: false }
const archiveLotMutation = { mutateAsync: vi.fn(), isPending: false }
const unarchiveLotMutation = { mutateAsync: vi.fn(), isPending: false }
const createMovementMutation = { mutateAsync: vi.fn(), isPending: false }

const labelSummaries: ReagentLabelSummary[] = [
  { label: 'ALT', total: 2, emEstoque: 1, emUso: 1, inativos: 0, vencidos: 0 },
]

const responsibles: ResponsibleSummary[] = [
  { id: 'u-1', name: 'Ana', username: 'ana', role: 'FUNCIONARIO' },
  { id: 'u-2', name: 'Bruno', username: 'bruno', role: 'ADMIN' },
]

const authValueAdmin: AuthContextValue = {
  user: {
    id: 'user-1',
    username: 'bruno',
    email: 'bruno@example.com',
    name: 'Bruno',
    role: 'ADMIN',
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

const authValueFunc: AuthContextValue = {
  ...authValueAdmin,
  user: { ...(authValueAdmin.user as NonNullable<AuthContextValue['user']>), id: 'u-1', username: 'ana', name: 'Ana', role: 'FUNCIONARIO' },
}

function buildLot(overrides: Partial<ReagentLot> = {}): ReagentLot {
  return {
    id: crypto.randomUUID(),
    label: 'ALT',
    lotNumber: 'L123',
    manufacturer: 'BioLab',
    category: 'Bioquímica',
    expiryDate: '2026-06-30',
    unitsInStock: 2,
    unitsInUse: 0,
    totalUnits: 2,
    storageTemp: '2-8°C',
    status: 'em_estoque',
    createdAt: '2026-04-16T12:00:00Z',
    updatedAt: '2026-04-16T12:00:00Z',
    daysLeft: 20,
    nearExpiry: false,
    location: 'Geladeira 1',
    supplier: 'Fornecedor X',
    receivedDate: '2026-03-01',
    openedDate: null,
    archivedAt: null,
    archivedBy: null,
    needsStockReview: false,
    usedInQcRecently: true,
    traceabilityComplete: true,
    traceabilityIssues: [],
    canReceiveEntry: true,
    allowedMovementTypes: ['ENTRADA', 'ABERTURA', 'FECHAMENTO', 'CONSUMO', 'AJUSTE'],
    movementWarning: null,
    ...overrides,
  }
}

function renderTab(authValue: AuthContextValue = authValueAdmin) {
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
  deleteLotMutation.mutateAsync.mockReset()
  archiveLotMutation.mutateAsync.mockReset()
  unarchiveLotMutation.mutateAsync.mockReset()
  createMovementMutation.mutateAsync.mockReset()
  mockCreateMovementService.mockReset()

  mockUseReagentLots.mockReset()
  mockUseReagentLabels.mockReset()
  mockUseResponsibles.mockReset()
  mockUseCreateReagentLot.mockReset()
  mockUseUpdateReagentLot.mockReset()
  mockUseDeleteReagentLot.mockReset()
  mockUseArchiveReagentLot.mockReset()
  mockUseUnarchiveReagentLot.mockReset()
  mockUseCreateStockMovement.mockReset()
  mockUseReagentMovements.mockReset()
  mockGetLabelSummaries.mockReset()
  mockExportCsv.mockReset()
  mockGetReagentsPdf.mockReset()

  mockUseCreateReagentLot.mockReturnValue(createLotMutation)
  mockUseUpdateReagentLot.mockReturnValue(updateLotMutation)
  mockUseDeleteReagentLot.mockReturnValue(deleteLotMutation)
  mockUseArchiveReagentLot.mockReturnValue(archiveLotMutation)
  mockUseUnarchiveReagentLot.mockReturnValue(unarchiveLotMutation)
  mockUseCreateStockMovement.mockReturnValue(createMovementMutation)
  mockUseReagentMovements.mockReturnValue({ data: [] })
  mockUseReagentLabels.mockReturnValue({ data: labelSummaries })
  mockUseResponsibles.mockReturnValue({ data: responsibles })
  mockGetLabelSummaries.mockResolvedValue(labelSummaries)
  mockExportCsv.mockResolvedValue(new Blob(['csv']))
  mockGetReagentsPdf.mockResolvedValue(new Blob(['pdf']))
  mockCreateMovementService.mockResolvedValue({})
})

describe('ReagentesTab v3', () => {
  it('inicia em viewMode "tags" com label aggregations', async () => {
    mockUseReagentLots.mockReturnValue({
      data: [
        buildLot({ label: 'ALT', lotNumber: 'ALT-001' }),
        buildLot({ label: 'ALT', lotNumber: 'ALT-002', status: 'em_uso', unitsInStock: 0, unitsInUse: 1 }),
      ],
    })
    renderTab()
    expect(screen.getByText('Gestão de Reagentes')).toBeInTheDocument()
    expect(await screen.findByText('ALT')).toBeInTheDocument()
  })

  it('valida etiqueta antes de cadastrar lote novo', async () => {
    mockUseReagentLots.mockReturnValue({ data: [buildLot()] })
    renderTab()
    await userEvent.click(screen.getByRole('button', { name: 'Novo Lote' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))
    expect(await screen.findByText('Informe a etiqueta do lote.')).toBeInTheDocument()
    expect(createLotMutation.mutateAsync).not.toHaveBeenCalled()
  })

  it('cria lote com unitsInStock e unitsInUse separados', async () => {
    mockUseReagentLots.mockReturnValue({ data: [buildLot()] })
    createLotMutation.mutateAsync.mockResolvedValue(buildLot({ label: 'NovaEt' }))
    renderTab()

    await userEvent.click(screen.getByRole('button', { name: 'Novo Lote' }))
    const labelCombobox = screen.getByLabelText('Etiqueta *')
    await userEvent.click(labelCombobox)
    await userEvent.type(labelCombobox, 'NovaEt')
    await userEvent.click(screen.getByText(/\+ Criar nova etiqueta/i))

    await userEvent.type(screen.getByLabelText('Nº do Lote *'), 'NEW-100')
    const fab = screen.getByLabelText('Fabricante *')
    await userEvent.click(fab)
    await userEvent.type(fab, 'NovoFab')
    await userEvent.click(screen.getByText(/\+ Criar novo fabricante/i))
    await userEvent.selectOptions(screen.getByLabelText('Categoria *'), 'Bioquímica')
    await userEvent.clear(screen.getByLabelText('Em estoque *'))
    await userEvent.type(screen.getByLabelText('Em estoque *'), '3')
    await userEvent.clear(screen.getByLabelText('Em uso *'))
    await userEvent.type(screen.getByLabelText('Em uso *'), '1')
    await userEvent.type(screen.getByLabelText('Validade *'), '2027-01-01')
    const loc = screen.getByLabelText('Localização *')
    await userEvent.click(loc)
    await userEvent.type(loc, 'NovaLoc')
    await userEvent.click(screen.getByText(/\+ Criar nova localização/i))
    await userEvent.selectOptions(screen.getByLabelText('Temperatura *'), '2-8°C')

    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))

    await waitFor(() => {
      expect(createLotMutation.mutateAsync).toHaveBeenCalledTimes(1)
    })
    const sentRequest = createLotMutation.mutateAsync.mock.calls[0][0] as ReagentLotRequest
    expect(sentRequest.label).toBe('NovaEt')
    expect(sentRequest.unitsInStock).toBe(3)
    expect(sentRequest.unitsInUse).toBe(1)
  })

  it('exibe banner amarelo quando expiryDate < hoje', async () => {
    mockUseReagentLots.mockReturnValue({ data: [buildLot()] })
    renderTab()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Novo Lote' }))
    const expiryInput = screen.getByLabelText('Validade *') as HTMLInputElement
    fireEvent.change(expiryInput, { target: { value: '2020-01-01' } })
    await waitFor(() => {
      const strongs = Array.from(document.querySelectorAll('strong'))
      const found = strongs.some((node) => node.textContent === 'Vencido')
      expect(found).toBe(true)
    })
  })

  it('bloqueia ENTRADA em lote vencido', async () => {
    mockUseReagentLots.mockReturnValue({
      data: [
        buildLot({
          status: 'vencido',
          unitsInStock: 0,
          unitsInUse: 1,
          totalUnits: 1,
          canReceiveEntry: false,
          movementWarning: 'Lote vencido não aceita ENTRADA.',
        }),
      ],
    })
    renderTab()
    await userEvent.click(screen.getByRole('button', { name: 'Ver lista' }))
    const addButtons = screen.getAllByRole('button', { name: /Adicionar/i })
    expect(addButtons[0]).toBeDisabled()
  })

  it('arquivar abre modal explicito (nao window.confirm)', async () => {
    const lot = buildLot({ id: 'lot-1', lotNumber: 'ARCH-001' })
    mockUseReagentLots.mockReturnValue({ data: [lot] })
    renderTab()
    await userEvent.click(screen.getByRole('button', { name: 'Ver lista' }))
    await userEvent.click(screen.getByRole('button', { name: /Arquivar/i }))
    expect(await screen.findByText('Data de arquivamento *')).toBeInTheDocument()
    expect(screen.getByLabelText('Responsável *')).toBeInTheDocument()
  })

  it('botao Apagar so aparece para ADMIN', async () => {
    const lot = buildLot({ id: 'lot-2', lotNumber: 'DEL-001' })
    mockUseReagentLots.mockReturnValue({ data: [lot] })
    renderTab(authValueFunc)
    await userEvent.click(screen.getByRole('button', { name: 'Ver lista' }))
    expect(screen.queryByRole('button', { name: 'Apagar' })).not.toBeInTheDocument()
  })

  it('Apagar (admin) abre modal com confirmacao por digitacao', async () => {
    const lot = buildLot({ id: 'lot-3', lotNumber: 'DEL-002' })
    mockUseReagentLots.mockReturnValue({ data: [lot] })
    renderTab()
    await userEvent.click(screen.getByRole('button', { name: 'Ver lista' }))
    await userEvent.click(screen.getByRole('button', { name: 'Apagar' }))
    expect(
      await screen.findByText(/Para confirmar, digite o número do lote/i),
    ).toBeInTheDocument()
    const confirmButton = screen.getByRole('button', { name: /Apagar definitivamente/i })
    expect(confirmButton).toBeDisabled()
  })

  it('lote inativo mostra Reativar e oculta botoes operacionais', async () => {
    const lot = buildLot({
      id: 'lot-4',
      lotNumber: 'INA-001',
      status: 'inativo',
      unitsInStock: 0,
      unitsInUse: 0,
      totalUnits: 0,
      archivedAt: '2026-04-20',
      archivedBy: 'ana',
      canReceiveEntry: false,
    })
    mockUseReagentLots.mockReturnValue({ data: [lot] })
    renderTab()
    await userEvent.click(screen.getByRole('button', { name: 'Ver lista' }))
    expect(screen.getByRole('button', { name: /Reativar lote/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Adicionar$/i })).not.toBeInTheDocument()
  })

  it('botao Abrir unidade habilita quando unitsInStock>=1', async () => {
    const lot = buildLot({ unitsInStock: 2, unitsInUse: 0 })
    mockUseReagentLots.mockReturnValue({ data: [lot] })
    renderTab()
    await userEvent.click(screen.getByRole('button', { name: 'Ver lista' }))
    const openBtn = screen.getByRole('button', { name: /Abrir unidade/i })
    expect(openBtn).not.toBeDisabled()
  })

  it('botao Voltar ao estoque desabilita quando unitsInUse=0', async () => {
    const lot = buildLot({ unitsInStock: 2, unitsInUse: 0 })
    mockUseReagentLots.mockReturnValue({ data: [lot] })
    renderTab()
    await userEvent.click(screen.getByRole('button', { name: 'Ver lista' }))
    const closeBtn = screen.getByRole('button', { name: /Voltar ao estoque/i })
    expect(closeBtn).toBeDisabled()
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../../contexts/auth-context'
import type { ReagentLabelSummary, ReagentLot, ReagentLotRequest } from '../../types'
import { ToastProvider } from '../ui'
import { ReagentesTab } from './ReagentesTab'

const mockUseReagentLots = vi.fn()
const mockUseReagentLabels = vi.fn()
const mockUseCreateReagentLot = vi.fn()
const mockUseUpdateReagentLot = vi.fn()
const mockUseDeleteReagentLot = vi.fn()
const mockUseCreateStockMovement = vi.fn()
const mockUseReagentMovements = vi.fn()

const mockGetLabelSummaries = vi.fn()
const mockExportCsv = vi.fn()
const mockGetReagentsPdf = vi.fn()

vi.mock('../../hooks/useReagents', () => ({
  useReagentLots: (...args: unknown[]) => mockUseReagentLots(...args),
  useReagentLabels: (...args: unknown[]) => mockUseReagentLabels(...args),
  useCreateReagentLot: () => mockUseCreateReagentLot(),
  useUpdateReagentLot: () => mockUseUpdateReagentLot(),
  useDeleteReagentLot: () => mockUseDeleteReagentLot(),
  useCreateStockMovement: (...args: unknown[]) => mockUseCreateStockMovement(...args),
  useReagentMovements: (...args: unknown[]) => mockUseReagentMovements(...args),
}))

vi.mock('../../services/reagentService', () => ({
  reagentService: {
    getLabelSummaries: (...args: unknown[]) => mockGetLabelSummaries(...args),
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

const deleteLotMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
}

const createMovementMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
}

const labelSummaries: ReagentLabelSummary[] = [
  { label: 'ALT', total: 2, emEstoque: 1, emUso: 1, foraDeEstoque: 0, vencidos: 0 },
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
    label: 'ALT',
    lotNumber: 'L123',
    manufacturer: 'BioLab',
    category: 'Bioquímica',
    expiryDate: '2026-06-30',
    currentStock: 80,
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
    usedInQcRecently: true,
    traceabilityComplete: true,
    traceabilityIssues: [],
    canReceiveEntry: true,
    allowedMovementTypes: ['ENTRADA', 'SAIDA', 'AJUSTE'],
    movementWarning: null,
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
  deleteLotMutation.mutateAsync.mockReset()
  createMovementMutation.mutateAsync.mockReset()

  mockUseReagentLots.mockReset()
  mockUseReagentLabels.mockReset()
  mockUseCreateReagentLot.mockReset()
  mockUseUpdateReagentLot.mockReset()
  mockUseDeleteReagentLot.mockReset()
  mockUseCreateStockMovement.mockReset()
  mockUseReagentMovements.mockReset()
  mockGetLabelSummaries.mockReset()
  mockExportCsv.mockReset()
  mockGetReagentsPdf.mockReset()

  mockUseCreateReagentLot.mockReturnValue(createLotMutation)
  mockUseUpdateReagentLot.mockReturnValue(updateLotMutation)
  mockUseDeleteReagentLot.mockReturnValue(deleteLotMutation)
  mockUseCreateStockMovement.mockReturnValue(createMovementMutation)
  mockUseReagentMovements.mockReturnValue({ data: [] })
  mockUseReagentLabels.mockReturnValue({ data: labelSummaries })
  mockGetLabelSummaries.mockResolvedValue(labelSummaries)
  mockExportCsv.mockResolvedValue(new Blob(['csv']))
  mockGetReagentsPdf.mockResolvedValue(new Blob(['pdf']))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('ReagentesTab', () => {
  it('inicia em viewMode "tags" e exibe etiquetas com contagens novas', async () => {
    mockUseReagentLots.mockReturnValue({
      data: [
        buildLot({ label: 'ALT', lotNumber: 'ALT-001' }),
        buildLot({ label: 'ALT', lotNumber: 'ALT-002', status: 'em_uso' }),
      ],
    })

    renderTab()

    expect(screen.getByText('Gestão de Reagentes')).toBeInTheDocument()
    // Card da etiqueta deve aparecer no modo padrao 'tags'
    expect(await screen.findByText('ALT')).toBeInTheDocument()
    expect(screen.getByText('2 lotes')).toBeInTheDocument()
  })

  it('alterna para lista e aplica busca por etiqueta ou lote', async () => {
    mockUseReagentLots.mockReturnValue({
      data: [
        buildLot({ label: 'ALT', lotNumber: 'ALT-001' }),
        buildLot({ label: 'AST', lotNumber: 'AST-002', manufacturer: 'OutroFab' }),
      ],
    })

    renderTab()

    await userEvent.click(screen.getByRole('button', { name: 'Ver lista' }))

    expect(await screen.findByText('ALT')).toBeInTheDocument()
    expect(screen.getByText('AST')).toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText('Buscar reagente ou lote...'), 'AST-002')

    expect(screen.queryByText('ALT')).not.toBeInTheDocument()
    expect(screen.getByText('AST')).toBeInTheDocument()
  })

  it('valida etiqueta antes de cadastrar lote novo (bloqueante audit 4.2.1)', async () => {
    mockUseReagentLots.mockReturnValue({ data: [buildLot()] })

    renderTab()

    await userEvent.click(screen.getByRole('button', { name: 'Novo Lote' }))
    // Etiqueta vazia deve bloquear
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))

    expect(await screen.findByText('Informe a etiqueta do lote.')).toBeInTheDocument()
    expect(createLotMutation.mutateAsync).not.toHaveBeenCalled()
  })

  it('cria lote a partir do botao "+ Criar nova etiqueta" do combobox', async () => {
    mockUseReagentLots.mockReturnValue({ data: [buildLot()] })
    createLotMutation.mutateAsync.mockResolvedValue(buildLot({ label: 'NovaEt' }))

    renderTab()

    await userEvent.click(screen.getByRole('button', { name: 'Novo Lote' }))

    // 1) Etiqueta — digitar nova e clicar no item "+ Criar nova etiqueta".
    // O combobox dentro do modal e identificavel por aria-controls que termina
    // em "-listbox" e por estar associado ao label "Etiqueta *". Usamos
    // findByLabelText para nao colidir com o combobox de filtros (manufacturer).
    const labelCombobox = screen.getByLabelText('Etiqueta *')
    await userEvent.click(labelCombobox)
    await userEvent.type(labelCombobox, 'NovaEt')
    await userEvent.click(screen.getByText(/\+ Criar nova etiqueta/i))

    // 2) Demais campos obrigatorios
    await userEvent.type(screen.getByLabelText('Nº do Lote *'), 'NEW-100')
    await userEvent.type(screen.getByLabelText('Fabricante *'), 'BioLab')
    await userEvent.selectOptions(screen.getByLabelText('Categoria *'), 'Bioquímica')
    await userEvent.clear(screen.getByLabelText('Quantidade atual *'))
    await userEvent.type(screen.getByLabelText('Quantidade atual *'), '20')
    // Status default = em_estoque
    await userEvent.type(screen.getByLabelText('Validade *'), '2027-01-01')
    await userEvent.type(screen.getByLabelText('Localização *'), 'Geladeira 3')
    await userEvent.selectOptions(screen.getByLabelText('Temperatura *'), '2-8°C')

    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))

    await waitFor(() => {
      expect(createLotMutation.mutateAsync).toHaveBeenCalledTimes(1)
    })
    const sentRequest = createLotMutation.mutateAsync.mock.calls[0][0] as ReagentLotRequest
    expect(sentRequest.label).toBe('NovaEt')
    expect(sentRequest.lotNumber).toBe('NEW-100')
    expect(sentRequest.location).toBe('Geladeira 3')
    expect(sentRequest.storageTemp).toBe('2-8°C')
  })

  it('aplica trim defensivo no label antes do submit (bloqueante audit 4.2.1)', async () => {
    mockUseReagentLots.mockReturnValue({ data: [buildLot()] })
    createLotMutation.mutateAsync.mockResolvedValue(buildLot())

    renderTab()

    await userEvent.click(screen.getByRole('button', { name: 'Novo Lote' }))

    const labelCombobox = screen.getByLabelText('Etiqueta *')
    await userEvent.click(labelCombobox)
    // Combobox ja faz trim em onChange, mas tambem testamos a 1a linha de defesa no service.
    await userEvent.type(labelCombobox, '  Glicose ')
    await userEvent.click(screen.getByText(/\+ Criar nova etiqueta/i))

    await userEvent.type(screen.getByLabelText('Nº do Lote *'), 'L-100')
    await userEvent.type(screen.getByLabelText('Fabricante *'), '  Wama  ')
    await userEvent.selectOptions(screen.getByLabelText('Categoria *'), 'Bioquímica')
    await userEvent.type(screen.getByLabelText('Validade *'), '2027-01-01')
    await userEvent.type(screen.getByLabelText('Localização *'), '  Geladeira 1  ')
    await userEvent.selectOptions(screen.getByLabelText('Temperatura *'), '2-8°C')

    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))

    await waitFor(() => {
      expect(createLotMutation.mutateAsync).toHaveBeenCalledTimes(1)
    })
    const sentRequest = createLotMutation.mutateAsync.mock.calls[0][0] as ReagentLotRequest
    expect(sentRequest.label).toBe('Glicose')
    expect(sentRequest.manufacturer).toBe('Wama')
    expect(sentRequest.location).toBe('Geladeira 1')
  })

  it('exibe banner amarelo quando expiryDate < hoje (status sera vencido pelo servidor)', async () => {
    mockUseReagentLots.mockReturnValue({ data: [buildLot()] })

    renderTab()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Novo Lote' }))
    const expiryInput = screen.getByLabelText('Validade *') as HTMLInputElement
    fireEvent.change(expiryInput, { target: { value: '2020-01-01' } })

    // Ao setar uma data passada, expiryWillForceVencido vira true e o banner
    // amarelo aparece. O <strong>Vencido</strong> e o pivot estavel dentro
    // do banner para localizar o aviso operacional.
    await waitFor(() => {
      const strongs = Array.from(document.querySelectorAll('strong'))
      const found = strongs.some((node) => node.textContent === 'Vencido')
      expect(found).toBe(true)
    })
  })

  it('exige motivo em saida que zera o estoque', async () => {
    mockUseReagentLots.mockReturnValue({
      data: [buildLot({ currentStock: 10 })],
    })

    renderTab()

    // Modo lista — abre o card e clica em Remover
    await userEvent.click(screen.getByRole('button', { name: 'Ver lista' }))
    await userEvent.click(screen.getAllByRole('button', { name: /Remover/i })[0])

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

  it('bloqueia ENTRADA em lote vencido e mostra aviso', async () => {
    mockUseReagentLots.mockReturnValue({
      data: [
        buildLot({
          status: 'vencido',
          currentStock: 5,
          canReceiveEntry: false,
          allowedMovementTypes: ['SAIDA', 'AJUSTE'],
          movementWarning: 'Lote vencido não aceita nova entrada. Crie um novo lote.',
        }),
      ],
    })

    renderTab()

    await userEvent.click(screen.getByRole('button', { name: 'Ver lista' }))
    // Botao "Adicionar" precisa estar desabilitado em lote vencido
    const addButton = screen.getByRole('button', { name: /Adicionar/i })
    expect(addButton).toBeDisabled()
  })

  it('arquiva lote nao terminal (status != fora_de_estoque) com mensagem nova', async () => {
    const lot = buildLot({ id: 'lot-archive', lotNumber: 'ARCH-001' })
    mockUseReagentLots.mockReturnValue({ data: [lot] })

    renderTab()

    await userEvent.click(screen.getByRole('button', { name: 'Ver lista' }))
    await userEvent.click(screen.getByRole('button', { name: /Arquivar/i }))

    expect(window.confirm).toHaveBeenCalledWith(
      'Arquivar o lote ARCH-001? Lotes com histórico serão preservados como Fora de estoque.',
    )
    expect(deleteLotMutation.mutateAsync).toHaveBeenCalledWith('lot-archive')
  })
})

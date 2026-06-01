import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImmunologyControlSet, ImmunologyRun, ReagentLot } from '../../types'
import { ToastProvider } from '../ui'
import { ImunologiaArea } from './ImunologiaArea'

const mockUseImmunologyControlSets = vi.fn()
const mockUseImmunologyRuns = vi.fn()
const mockUseCreateImmunologyControlSet = vi.fn()
const mockUseUpdateImmunologyControlSet = vi.fn()
const mockUseCreateImmunologyRun = vi.fn()
const mockUseDeactivateImmunologyControlSet = vi.fn()
const mockUseDeleteImmunologyRun = vi.fn()
const mockUseReagentLots = vi.fn()
const mockGetQcPdf = vi.fn()

vi.mock('../../hooks/useImmunology', () => ({
  useImmunologyControlSets: (...args: unknown[]) => mockUseImmunologyControlSets(...args),
  useImmunologyRuns: (...args: unknown[]) => mockUseImmunologyRuns(...args),
  useCreateImmunologyControlSet: () => mockUseCreateImmunologyControlSet(),
  useUpdateImmunologyControlSet: () => mockUseUpdateImmunologyControlSet(),
  useCreateImmunologyRun: () => mockUseCreateImmunologyRun(),
  useDeactivateImmunologyControlSet: () => mockUseDeactivateImmunologyControlSet(),
  useDeleteImmunologyRun: () => mockUseDeleteImmunologyRun(),
}))

vi.mock('../../hooks/useReagents', () => ({
  useReagentLots: (...args: unknown[]) => mockUseReagentLots(...args),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      username: 'ana',
      name: 'Ana',
      role: 'ADMIN',
      isActive: true,
      permissions: [],
    },
  }),
}))

vi.mock('../../services/reportService', () => ({
  reportService: {
    getQcPdf: (...args: unknown[]) => mockGetQcPdf(...args),
  },
}))

const createControlSetMutation = { mutateAsync: vi.fn(), isPending: false }
const updateControlSetMutation = { mutateAsync: vi.fn(), isPending: false }
const createRunMutation = { mutateAsync: vi.fn(), isPending: false }
const deactivateControlSetMutation = { mutateAsync: vi.fn(), isPending: false }
const deleteRunMutation = { mutateAsync: vi.fn(), isPending: false }

function renderArea() {
  return render(
    <ToastProvider>
      <ImunologiaArea />
    </ToastProvider>,
  )
}

function getSoroControleCadastroInput() {
  const field = screen.getAllByLabelText('Soro-controle *').find((element) => element.tagName === 'INPUT')
  if (!field) {
    throw new Error('Campo de cadastro de soro-controle não encontrado')
  }
  return field as HTMLInputElement
}

function getSoroControleAnalysisSelect() {
  const field = screen.getAllByLabelText('Soro-controle *').find((element) => element.tagName === 'SELECT')
  if (!field) {
    throw new Error('Select de soro-controle da análise não encontrado')
  }
  return field as HTMLSelectElement
}

beforeEach(() => {
  createControlSetMutation.mutateAsync.mockReset()
  updateControlSetMutation.mutateAsync.mockReset()
  createRunMutation.mutateAsync.mockReset()
  deactivateControlSetMutation.mutateAsync.mockReset()
  deleteRunMutation.mutateAsync.mockReset()
  mockGetQcPdf.mockReset()

  mockUseCreateImmunologyControlSet.mockReturnValue(createControlSetMutation)
  mockUseUpdateImmunologyControlSet.mockReturnValue(updateControlSetMutation)
  mockUseCreateImmunologyRun.mockReturnValue(createRunMutation)
  mockUseDeactivateImmunologyControlSet.mockReturnValue(deactivateControlSetMutation)
  mockUseDeleteImmunologyRun.mockReturnValue(deleteRunMutation)
  mockUseImmunologyControlSets.mockReturnValue({ data: [controlSet()] })
  mockUseImmunologyRuns.mockReturnValue({ data: [run()] })
  mockUseReagentLots.mockReturnValue({ data: [reagentLot()] })
  mockGetQcPdf.mockResolvedValue(new Blob(['pdf']))
  createControlSetMutation.mutateAsync.mockResolvedValue(controlSet())
  updateControlSetMutation.mutateAsync.mockResolvedValue(controlSet())
  createRunMutation.mutateAsync.mockResolvedValue(run())
  deactivateControlSetMutation.mutateAsync.mockResolvedValue(undefined)
  deleteRunMutation.mutateAsync.mockResolvedValue(undefined)
})

describe('ImunologiaArea', () => {
  it('renderiza a tela com fluxo de análise em duas colunas', () => {
    renderArea()

    expect(screen.getByRole('heading', { name: 'Controle de Qualidade' })).toBeInTheDocument()
    expect(screen.getByText('1. Selecionar reagente')).toBeInTheDocument()
    expect(screen.getByText('2. Dados/Resultados')).toBeInTheDocument()
    expect(screen.getByLabelText('Reagente de Imunologia *')).toBeInTheDocument()
    expect(getSoroControleAnalysisSelect()).toBeInTheDocument()
    expect(getSoroControleCadastroInput()).toBeInTheDocument()
    expect(screen.queryByText('3. Resultados')).not.toBeInTheDocument()
    expect(screen.getByText('Cadastro de soro-controles')).toBeInTheDocument()
  })

  it('não mostra o atalho de reagente no cadastro de soro-controle', () => {
    renderArea()

    expect(screen.getByLabelText('Reagente de Imunologia *')).toBeInTheDocument()
    expect(screen.queryByText(/Selecione para preencher soro-controle/i)).not.toBeInTheDocument()
  })

  it('envia cadastro de controle com a quantidade configurada pelo usuário', async () => {
    renderArea()

    const soroControleInput = getSoroControleCadastroInput()
    await userEvent.clear(soroControleInput)
    await userEvent.type(soroControleInput, 'HIV')
    await userEvent.type(screen.getByLabelText('Marca *'), 'Wama')
    await userEvent.type(screen.getByLabelText('Lote *'), '1023')
    await userEvent.type(screen.getByLabelText('Validade *'), '2027-10-01')
    await userEvent.click(screen.getByRole('button', { name: /Salvar controle/i }))

    await waitFor(() => {
      expect(createControlSetMutation.mutateAsync).toHaveBeenCalledWith({
        analito: 'HIV',
        manufacturer: 'Wama',
        lotNumber: '1023',
        validUntil: '2027-10-01',
        controls: [
          { name: 'Controle 1', expectedResult: 'REAGENTE' },
        ],
      })
    })
  })

  it('permite adicionar outro controle esperado antes de salvar', async () => {
    renderArea()

    await userEvent.click(screen.getByRole('button', { name: /Adicionar controle/i }))
    const soroControleInput = getSoroControleCadastroInput()
    await userEvent.clear(soroControleInput)
    await userEvent.type(soroControleInput, 'HIV')
    await userEvent.type(screen.getByLabelText('Marca *'), 'Wama')
    await userEvent.type(screen.getByLabelText('Lote *'), '1024')
    await userEvent.type(screen.getByLabelText('Validade *'), '2027-10-01')
    await userEvent.click(screen.getByRole('button', { name: /Salvar controle/i }))

    await waitFor(() => {
      expect(createControlSetMutation.mutateAsync).toHaveBeenCalledWith({
        analito: 'HIV',
        manufacturer: 'Wama',
        lotNumber: '1024',
        validUntil: '2027-10-01',
        controls: [
          { name: 'Controle 1', expectedResult: 'REAGENTE' },
          { name: 'Controle 2', expectedResult: 'NAO_REAGENTE' },
        ],
      })
    })
  })

  it('envia análise com resultado observado por controle', async () => {
    renderArea()

    await userEvent.selectOptions(screen.getByLabelText('Reagente de Imunologia *'), 'lot-1')
    await userEvent.selectOptions(getSoroControleAnalysisSelect(), 'set-1')
    const resultSelects = screen.getAllByLabelText('Resultado')
    expect(screen.getAllByText('Controle 1: Reagente').length).toBeGreaterThan(0)
    await userEvent.selectOptions(resultSelects[0], 'REAGENTE')
    await userEvent.selectOptions(resultSelects[1], 'NAO_REAGENTE')
    await userEvent.click(screen.getByRole('button', { name: /Salvar análise/i }))

    await waitFor(() => {
      expect(createRunMutation.mutateAsync).toHaveBeenCalledWith({
        dataMedicao: expect.any(String),
        reagentLotId: 'lot-1',
        controlSetId: 'set-1',
        analyst: undefined,
        notes: undefined,
        results: [
          { controlItemId: 'item-1', observedResult: 'REAGENTE' },
          { controlItemId: 'item-2', observedResult: 'NAO_REAGENTE' },
        ],
      })
    })
  })

  it('filtra soro-controles pelo reagente selecionado', async () => {
    mockUseImmunologyControlSets.mockReturnValue({ data: [controlSet(), controlSet({ id: 'set-2', analito: 'HBsAg', lotNumber: 'HB-01' })] })
    renderArea()

    await userEvent.selectOptions(screen.getByLabelText('Reagente de Imunologia *'), 'lot-1')

    const select = getSoroControleAnalysisSelect()
    expect(within(select).getByRole('option', { name: /HIV/i })).toBeInTheDocument()
    expect(within(select).queryByRole('option', { name: /HBsAg/i })).not.toBeInTheDocument()
  })

  it('exclui análise do histórico após confirmação', async () => {
    renderArea()

    await userEvent.click(screen.getByRole('button', { name: /Excluir/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Excluir análise do histórico')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }))

    await waitFor(() => {
      expect(deleteRunMutation.mutateAsync).toHaveBeenCalledWith('run-1')
    })
  })
})

function reagentLot(): ReagentLot {
  return {
    id: 'lot-1',
    label: 'HIV',
    lotNumber: '1023',
    manufacturer: 'Wama',
    category: 'Imunologia',
    expiryDate: '2027-10-01',
    unitsInStock: 1,
    unitsInUse: 0,
    totalUnits: 1,
    storageTemp: '2-8C',
    status: 'em_estoque',
    createdAt: '2026-05-29T12:00:00Z',
    updatedAt: '2026-05-29T12:00:00Z',
    daysLeft: 500,
    nearExpiry: false,
  }
}

function controlSet(overrides: Partial<ImmunologyControlSet> = {}): ImmunologyControlSet {
  return {
    id: 'set-1',
    analito: 'HIV',
    manufacturer: 'Wama',
    lotNumber: '1022',
    validUntil: '2027-10-01',
    isActive: true,
    expired: false,
    createdAt: '2026-05-29T12:00:00Z',
    updatedAt: '2026-05-29T12:00:00Z',
    controls: [
      { id: 'item-1', name: 'Controle 1', expectedResult: 'REAGENTE', displayOrder: 1 },
      { id: 'item-2', name: 'Controle 2', expectedResult: 'NAO_REAGENTE', displayOrder: 2 },
    ],
    ...overrides,
  }
}

function run(): ImmunologyRun {
  return {
    id: 'run-1',
    controlSetId: 'set-1',
    reagentLotId: 'lot-1',
    reagentLabel: 'HIV',
    reagentManufacturer: 'Wama',
    reagentLotNumber: '1023',
    reagentValidUntil: '2027-10-01',
    reagentStatus: 'em_estoque',
    reagentUnitsInStock: 1,
    reagentUnitsInUse: 0,
    reagentStorageTemp: '2-8C',
    reagentLocation: 'Geladeira CQ',
    dataMedicao: '2026-05-29',
    analito: 'HIV',
    manufacturer: 'Wama',
    lotNumber: '1022',
    validUntil: '2027-10-01',
    status: 'APROVADO',
    analyst: 'Ana',
    notes: 'Rotina nominal',
    createdAt: '2026-05-29T12:00:00Z',
    results: [
      {
        id: 'result-1',
        controlItemId: 'item-1',
        controlName: 'Controle 1',
        expectedResult: 'REAGENTE',
        observedResult: 'REAGENTE',
        status: 'APROVADO',
        displayOrder: 1,
      },
      {
        id: 'result-2',
        controlItemId: 'item-2',
        controlName: 'Controle 2',
        expectedResult: 'NAO_REAGENTE',
        observedResult: 'NAO_REAGENTE',
        status: 'APROVADO',
        displayOrder: 2,
      },
    ],
  }
}

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImmunologyControlSet, ImmunologyRun } from '../../types'
import { ToastProvider } from '../ui'
import { ImunologiaArea } from './ImunologiaArea'

const mockUseImmunologyControlSets = vi.fn()
const mockUseImmunologyRuns = vi.fn()
const mockUseCreateImmunologyControlSet = vi.fn()
const mockUseUpdateImmunologyControlSet = vi.fn()
const mockUseCreateImmunologyRun = vi.fn()
const mockUseDeactivateImmunologyControlSet = vi.fn()
const mockGetQcPdf = vi.fn()

vi.mock('../../hooks/useImmunology', () => ({
  useImmunologyControlSets: (...args: unknown[]) => mockUseImmunologyControlSets(...args),
  useImmunologyRuns: (...args: unknown[]) => mockUseImmunologyRuns(...args),
  useCreateImmunologyControlSet: () => mockUseCreateImmunologyControlSet(),
  useUpdateImmunologyControlSet: () => mockUseUpdateImmunologyControlSet(),
  useCreateImmunologyRun: () => mockUseCreateImmunologyRun(),
  useDeactivateImmunologyControlSet: () => mockUseDeactivateImmunologyControlSet(),
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

function renderArea() {
  return render(
    <ToastProvider>
      <ImunologiaArea />
    </ToastProvider>,
  )
}

beforeEach(() => {
  createControlSetMutation.mutateAsync.mockReset()
  updateControlSetMutation.mutateAsync.mockReset()
  createRunMutation.mutateAsync.mockReset()
  deactivateControlSetMutation.mutateAsync.mockReset()
  mockGetQcPdf.mockReset()

  mockUseCreateImmunologyControlSet.mockReturnValue(createControlSetMutation)
  mockUseUpdateImmunologyControlSet.mockReturnValue(updateControlSetMutation)
  mockUseCreateImmunologyRun.mockReturnValue(createRunMutation)
  mockUseDeactivateImmunologyControlSet.mockReturnValue(deactivateControlSetMutation)
  mockUseImmunologyControlSets.mockReturnValue({ data: [controlSet()] })
  mockUseImmunologyRuns.mockReturnValue({ data: [run()] })
  mockGetQcPdf.mockResolvedValue(new Blob(['pdf']))
  createControlSetMutation.mutateAsync.mockResolvedValue(controlSet())
  updateControlSetMutation.mutateAsync.mockResolvedValue(controlSet())
  createRunMutation.mutateAsync.mockResolvedValue(run())
  deactivateControlSetMutation.mutateAsync.mockResolvedValue(undefined)
})

describe('ImunologiaArea', () => {
  it('renderiza a tela no formato do papel', () => {
    renderArea()

    expect(screen.getByRole('heading', { name: 'Imunologia' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Controle \+/i })).toBeInTheDocument()
    expect(screen.getByText('Análise controle 1')).toBeInTheDocument()
    expect(screen.getByText('Análise controle 2')).toBeInTheDocument()
    expect(screen.getByText('Cadastro de controles')).toBeInTheDocument()
  })

  it('envia cadastro de controle com os dois resultados esperados padrão', async () => {
    renderArea()

    await userEvent.clear(screen.getAllByLabelText('Analito *')[1])
    await userEvent.type(screen.getAllByLabelText('Analito *')[1], 'HIV')
    await userEvent.type(screen.getAllByLabelText('Marca *')[1], 'Wama')
    await userEvent.type(screen.getAllByLabelText('Lote *')[1], '1023')
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
          { name: 'Controle 2', expectedResult: 'NAO_REAGENTE' },
        ],
      })
    })
  })

  it('envia análise com resultado observado por controle', async () => {
    renderArea()

    await userEvent.click(screen.getByRole('button', { name: /Controle \+/i }))
    await userEvent.click(screen.getByRole('button', { name: /HIV/i }))
    const resultSelects = screen.getAllByLabelText('Resultado')
    await userEvent.selectOptions(resultSelects[0], 'REAGENTE')
    await userEvent.selectOptions(resultSelects[1], 'NAO_REAGENTE')
    await userEvent.click(screen.getByRole('button', { name: /Salvar análise/i }))

    await waitFor(() => {
      expect(createRunMutation.mutateAsync).toHaveBeenCalledWith({
        dataMedicao: expect.any(String),
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
})

function controlSet(): ImmunologyControlSet {
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
  }
}

function run(): ImmunologyRun {
  return {
    id: 'run-1',
    controlSetId: 'set-1',
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

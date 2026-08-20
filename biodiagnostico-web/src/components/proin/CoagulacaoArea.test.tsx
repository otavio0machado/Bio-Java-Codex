import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QcExam, QcRecord, QcReferenceValue } from '../../types'
import { ToastProvider } from '../ui'
import { CoagulacaoArea } from './CoagulacaoArea'

const mockUseQcExams = vi.fn()
const mockUseQcReferences = vi.fn()
const mockUseQcRecords = vi.fn()
const mockCreateBatchMutateAsync = vi.fn()

vi.mock('../../hooks/useQcRecords', () => ({
  useQcExams: (...args: unknown[]) => mockUseQcExams(...args),
  useQcReferences: (...args: unknown[]) => mockUseQcReferences(...args),
  useQcRecords: (...args: unknown[]) => mockUseQcRecords(...args),
  useCreateQcBatch: () => ({
    mutateAsync: mockCreateBatchMutateAsync,
    isPending: false,
  }),
  useCreateQcReference: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeleteQcReference: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      username: 'otavio',
      name: 'Otávio Machado',
      role: 'ADMIN',
      isActive: true,
      permissions: ['QC_WRITE'],
    },
  }),
}))

const mockExams: QcExam[] = [
  { id: 'exam-1', name: 'TP - Atividade (%)', area: 'coagulacao', unit: '%', isActive: true },
  { id: 'exam-2', name: 'TP - INR', area: 'coagulacao', unit: 'INR', isActive: true },
  { id: 'exam-3', name: 'TTPa - Tempo (s)', area: 'coagulacao', unit: 's', isActive: true },
]

const mockReferences: QcReferenceValue[] = [
  {
    id: 'ref-1',
    exam: mockExams[0],
    name: 'TP Ativ PNCQ',
    level: 'Normal',
    lotNumber: 'COAG 03142026',
    targetValue: 86,
    targetSd: 8,
    cvMaxThreshold: 15,
    isActive: true,
  },
  {
    id: 'ref-2',
    exam: mockExams[1],
    name: 'TP INR PNCQ',
    level: 'Normal',
    lotNumber: 'COAG 03142026',
    targetValue: 1.07,
    targetSd: 0.08,
    cvMaxThreshold: 15,
    isActive: true,
  },
  {
    id: 'ref-3',
    exam: mockExams[2],
    name: 'TTPa PNCQ',
    level: 'Normal',
    lotNumber: 'COAG 03142026',
    targetValue: 36,
    targetSd: 3,
    cvMaxThreshold: 15,
    isActive: true,
  },
]

const mockRecords: QcRecord[] = [
  {
    id: 'rec-1',
    referenceId: 'ref-1',
    examName: 'TP - Atividade (%)',
    area: 'coagulacao',
    date: '2026-08-20',
    level: 'Normal',
    lotNumber: 'COAG 03142026',
    value: 84,
    targetValue: 86,
    targetSd: 8,
    cv: 2.1,
    cvLimit: 15,
    zScore: -0.25,
    status: 'APROVADO',
    analyst: 'Otávio Machado',
    equipment: 'Coagulômetro CL4',
    violations: [],
    needsCalibration: false,
    createdAt: '2026-08-20T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z',
  },
  {
    id: 'rec-2',
    referenceId: 'ref-2',
    examName: 'TP - INR',
    area: 'coagulacao',
    date: '2026-08-20',
    level: 'Normal',
    lotNumber: 'COAG 03142026',
    value: 1.05,
    targetValue: 1.07,
    targetSd: 0.08,
    cv: 1.8,
    cvLimit: 15,
    zScore: -0.25,
    status: 'APROVADO',
    analyst: 'Otávio Machado',
    equipment: 'Coagulômetro CL4',
    violations: [],
    needsCalibration: false,
    createdAt: '2026-08-20T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z',
  },
]

describe('CoagulacaoArea', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseQcExams.mockReturnValue({ data: mockExams, isLoading: false })
    mockUseQcReferences.mockReturnValue({
      data: mockReferences,
      isLoading: false,
      refetch: vi.fn(),
    })
    mockUseQcRecords.mockReturnValue({
      data: mockRecords,
      isLoading: false,
      refetch: vi.fn(),
    })
    mockCreateBatchMutateAsync.mockResolvedValue([])
  })

  it('renderiza o título da área e a barra de entrada rápida', () => {
    render(
      <ToastProvider>
        <CoagulacaoArea />
      </ToastProvider>,
    )

    expect(screen.getByText('Controle de Qualidade — Coagulação')).toBeInTheDocument()
    expect(screen.getByText('Entrada Rápida da Corrida Diária')).toBeInTheDocument()
    expect(screen.getByText('Planilha Mensal de Coagulação')).toBeInTheDocument()
    expect(screen.getByText('Gráfico Levey-Jennings')).toBeInTheDocument()
  })

  it('exibe a lista consolidada de corridas na matriz mensal', () => {
    render(
      <ToastProvider>
        <CoagulacaoArea />
      </ToastProvider>,
    )

    expect(screen.getAllByText('COAG 03142026').length).toBeGreaterThan(0)
    expect(screen.getByText('84%')).toBeInTheDocument()
    expect(screen.getByText('1.05')).toBeInTheDocument()
  })

  it('permite preencher e submeter a corrida diária de coagulação', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <CoagulacaoArea />
      </ToastProvider>,
    )

    const tpInput = screen.getByPlaceholderText('Ex: 86')
    const inrInput = screen.getByPlaceholderText('Ex: 1.07')
    const ttpaInput = screen.getByPlaceholderText('Ex: 36')

    await user.type(tpInput, '88')
    await user.type(inrInput, '1.08')
    await user.type(ttpaInput, '35')

    const submitBtn = screen.getByRole('button', { name: /Confirmar Corrida de Coagulação/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateBatchMutateAsync).toHaveBeenCalledTimes(1)
      expect(mockCreateBatchMutateAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            examName: 'TP - Atividade (%)',
            value: 88,
            lotNumber: 'COAG 03142026',
          }),
          expect.objectContaining({
            examName: 'TP - INR',
            value: 1.08,
            lotNumber: 'COAG 03142026',
          }),
          expect.objectContaining({
            examName: 'TTPa - Tempo (s)',
            value: 35,
            lotNumber: 'COAG 03142026',
          }),
        ]),
      )
    })
  })

  it('abre o modal de gestão de lotes PNCQ ao clicar no botão', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <CoagulacaoArea />
      </ToastProvider>,
    )

    const btn = screen.getByRole('button', { name: /Gerenciar Lotes PNCQ/i })
    await user.click(btn)

    expect(screen.getByText('Gestão de Lotes de Controle — Coagulação (PNCQ)')).toBeInTheDocument()
  })
})

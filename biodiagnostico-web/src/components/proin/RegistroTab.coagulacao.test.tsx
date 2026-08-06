import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QcExam, QcRecord, QcReferenceValue } from '../../types'
import { ToastProvider } from '../ui'
import { RegistroTab } from './RegistroTab'

const createRecordMutation = { mutateAsync: vi.fn(), isPending: false }
const createBatchMutation = { mutateAsync: vi.fn(), isPending: false }
const mockUseAuth = vi.fn()

const legacyExam: QcExam = {
  id: 'exam-atividade',
  name: ' atividade (%) ',
  area: 'coagulacao',
  unit: '%',
}

const activeReference: QcReferenceValue = {
  id: 'ref-atividade',
  exam: legacyExam,
  name: 'Controle Atividade',
  level: 'Normal',
  lotNumber: 'CTRL-77',
  manufacturer: 'Fabricante CQ',
  targetValue: 100,
  targetSd: 5,
  cvMaxThreshold: 10,
  validFrom: '2026-01-01',
  validUntil: '2027-12-31',
  isActive: true,
}

vi.mock('../../hooks/useQcRecords', () => ({
  useCreateQcRecord: () => createRecordMutation,
  useCreateQcBatch: () => createBatchMutation,
  useQcExams: () => ({ data: [legacyExam] }),
  useQcReferences: () => ({ data: [activeReference] }),
  useQcRecords: () => ({ data: [], isLoading: false }),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useAiAssist', () => ({
  useValidateBatch: () => ({ mutate: vi.fn(), isPending: false, isError: false, data: null }),
  useExplainQc: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, data: null }),
  useRootCause: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, data: null }),
}))

vi.mock('./PostCalibrationModal', () => ({ PostCalibrationModal: () => null }))
vi.mock('./ExamHistoryModal', () => ({ ExamHistoryModal: () => null }))
vi.mock('./BatchValidationPanel', () => ({ BatchValidationPanel: () => null }))

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: {
      id: 'admin-1', username: 'admin', name: 'Admin', role: 'ADMIN', isActive: true, permissions: [],
    },
  })
  createRecordMutation.mutateAsync.mockReset()
  createBatchMutation.mutateAsync.mockReset()
  createRecordMutation.mutateAsync.mockResolvedValue(savedRecord())
})

describe('RegistroTab — lote de referência em Coagulação', () => {
  it('mantém registro normal e oculta modo planilha para funcionário sem IMPORT', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-qc',
        username: 'tecnico',
        name: 'Técnico',
        role: 'FUNCIONARIO',
        isActive: true,
        permissions: ['QC_WRITE'],
      },
    })

    renderRegistro()

    expect(screen.getByRole('button', { name: 'Salvar Registro' })).toBeInTheDocument()
    expect(screen.getByLabelText('Limite de variação (%)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Modo Planilha' })).not.toBeInTheDocument()
  })

  it('usa o lote da referência resolvida no registro normal quando o operador não informa lote', async () => {
    const user = userEvent.setup()
    renderRegistro()

    await user.selectOptions(screen.getByLabelText('Exame'), 'Atividade (%)')
    expect(screen.getByText(/Lote: CTRL-77/)).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Medição'))
    await user.type(screen.getByLabelText('Medição'), '101')
    await user.click(screen.getByRole('button', { name: 'Salvar Registro' }))

    await waitFor(() => {
      expect(createRecordMutation.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
        examName: 'Atividade (%)',
        area: 'coagulacao',
        referenceId: 'ref-atividade',
        lotNumber: 'CTRL-77',
      }))
    })
  })

  it('envia lote por linha e informa falha parcial sem sucesso total indevido', async () => {
    createBatchMutation.mutateAsync.mockResolvedValue({
      runId: 'run-1',
      mode: 'PARTIAL',
      total: 1,
      successCount: 0,
      failureCount: 1,
      results: [{ rowIndex: 0, success: false, message: 'Lote inválido', record: null }],
    })
    const user = userEvent.setup()
    renderRegistro()

    await user.click(screen.getByRole('button', { name: 'Modo Planilha' }))
    expect(screen.getByText('Lim. var. %')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Exame da linha 1'), 'Atividade (%)')
    await user.type(screen.getByLabelText('Valor da linha 1'), '101')
    await user.click(screen.getByRole('button', { name: 'Registrar Todos (1)' }))

    await waitFor(() => {
      expect(createBatchMutation.mutateAsync).toHaveBeenCalledWith([
        expect.objectContaining({
          examName: 'Atividade (%)',
          referenceId: 'ref-atividade',
          lotNumber: 'CTRL-77',
        }),
      ])
    })
    expect(await screen.findByText(/Nenhum registro foi criado; 1 linha falhou/)).toBeInTheDocument()
    expect(screen.queryByText(/registros criados com sucesso/i)).not.toBeInTheDocument()
  })
})

function renderRegistro() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RegistroTab area="coagulacao" />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

function savedRecord(): QcRecord {
  return {
    id: 'record-1',
    referenceId: 'ref-atividade',
    examName: 'Atividade (%)',
    area: 'coagulacao',
    date: '2026-08-06',
    level: 'Normal',
    lotNumber: 'CTRL-77',
    value: 101,
    targetValue: 100,
    targetSd: 5,
    cv: 1,
    cvLimit: 10,
    zScore: 0.2,
    equipment: null,
    analyst: null,
    status: 'APROVADO',
    needsCalibration: false,
    violations: [],
    createdAt: '2026-08-06T12:00:00Z',
    updatedAt: '2026-08-06T12:00:00Z',
  }
}

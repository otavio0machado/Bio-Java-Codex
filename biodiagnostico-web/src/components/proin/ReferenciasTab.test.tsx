import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QcExam, QcReferenceValue } from '../../types'
import { ToastProvider } from '../ui'
import { ReferenciasTab } from './ReferenciasTab'

const mockUseQcReferences = vi.fn()
const mutation = { mutateAsync: vi.fn(), isPending: false }

const exams: QcExam[] = [
  { id: 'exam-atividade', name: 'Atividade (%)', area: 'coagulacao', unit: '%' },
  { id: 'exam-inr', name: 'INR', area: 'coagulacao' },
  { id: 'exam-ttpa', name: 'TTPA', area: 'coagulacao', unit: 's' },
  { id: 'exam-fibrinogenio', name: 'Fibrinogênio', area: 'coagulacao', unit: 'mg/dL' },
]

const references: QcReferenceValue[] = [
  reference(exams[0], { id: 'ref-atividade', targetValue: 100, targetSd: 5 }),
  reference(exams[1], { id: 'ref-inr', targetValue: 1, targetSd: 0.1 }),
  reference(exams[2], { id: 'ref-ttpa', targetValue: 30, targetSd: 2 }),
  reference(exams[3], { id: 'ref-fibrinogenio', targetValue: 250, targetSd: 20 }),
]

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1', username: 'ana', name: 'Ana', role: 'ADMIN', isActive: true, permissions: [],
    },
  }),
}))

vi.mock('../../hooks/useQcRecords', () => ({
  useQcExams: () => ({ data: exams }),
  useQcReferences: (...args: unknown[]) => mockUseQcReferences(...args),
  useCreateQcExam: () => mutation,
  useCreateQcReference: () => mutation,
  useUpdateQcReference: () => mutation,
  useDeleteQcReference: () => mutation,
}))

beforeEach(() => {
  mutation.mutateAsync.mockReset()
  mockUseQcReferences.mockReset()
  mockUseQcReferences.mockReturnValue({ data: references })
})

describe('ReferenciasTab — Coagulação', () => {
  it('consulta referências exclusivas da área e exibe ensaios, unidades e intervalo visual', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <ReferenciasTab area="coagulacao" />
      </ToastProvider>,
    )

    expect(mockUseQcReferences).toHaveBeenCalledWith({ area: 'coagulacao', activeOnly: false })
    expect(screen.getByRole('columnheader', { name: 'Média' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Desvio padrão' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Intervalo estatístico (média ±2 DP)' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Nível' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Lote' })).toBeInTheDocument()

    expect(screen.getAllByText('Atividade (%)')).toHaveLength(2)
    expect(screen.getAllByText('INR')).toHaveLength(2)
    expect(screen.getAllByText('TTPA')).toHaveLength(2)
    expect(screen.queryByText('Fibrinogênio')).not.toBeInTheDocument()

    expect(screen.getByText('90.00 – 110.00 %')).toBeInTheDocument()
    expect(screen.getByText('0.80 – 1.20')).toBeInTheDocument()
    expect(screen.getByText('26.00 – 34.00 s')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Nova Referência' }))
    expect(screen.getByRole('option', { name: 'Atividade (%) — %' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'INR — sem unidade' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'TTPA — s' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Fibrinogênio/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Adicionar exame/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nível')).toHaveValue('Normal')
    expect(screen.getByLabelText('Lote do controle *')).toBeRequired()
    expect(screen.getByLabelText('Fabricante')).toBeInTheDocument()
    expect(screen.getByLabelText('Limite de variação (%)')).toHaveValue(10)
    expect(screen.getByLabelText('Observações')).toBeInTheDocument()
  })

  it('bloqueia salvamento de referência de coagulação sem lote do controle', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <ReferenciasTab area="coagulacao" />
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Editar referência Atividade (%)' }))
    await user.clear(screen.getByLabelText('Lote do controle *'))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Informe o lote do controle para a referência de coagulação.')).toBeInTheDocument()
    expect(mutation.mutateAsync).not.toHaveBeenCalled()
  })
})

function reference(exam: QcExam, overrides: Partial<QcReferenceValue>): QcReferenceValue {
  return {
    id: overrides.id ?? `ref-${exam.id}`,
    exam,
    name: exam.name,
    level: 'Normal',
    lotNumber: overrides.lotNumber ?? `LOTE-${exam.id}`,
    manufacturer: overrides.manufacturer ?? 'Fabricante CQ',
    targetValue: overrides.targetValue ?? 0,
    targetSd: overrides.targetSd ?? 0,
    cvMaxThreshold: 10,
    validFrom: '2026-01-01',
    validUntil: '2027-12-31',
    isActive: true,
  }
}

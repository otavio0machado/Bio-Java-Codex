import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../ui'
import { UroanaliseArea } from '../UroanaliseArea'
import type { UroStripControlSet } from '../../../types'

const mockUseUroStripControlSets = vi.fn()
const mockUseCreateUroStripControlSet = vi.fn()
const mockUseUpdateUroStripControlSet = vi.fn()
const mockUseDeactivateUroStripControlSet = vi.fn()
const mockUseUroStripRuns = vi.fn()
const mockUseCreateUroStripRun = vi.fn()
const mockUseDeleteUroStripRun = vi.fn()
const mockUseUroSedimentRuns = vi.fn()
const mockUseCreateUroSedimentRun = vi.fn()
const mockUseDeleteUroSedimentRun = vi.fn()
const mockUseReagentLots = vi.fn()
const mockUseResponsibles = vi.fn()

vi.mock('../../../hooks/useUroanalise', () => ({
  useUroStripControlSets: (...args: unknown[]) => mockUseUroStripControlSets(...args),
  useCreateUroStripControlSet: () => mockUseCreateUroStripControlSet(),
  useUpdateUroStripControlSet: () => mockUseUpdateUroStripControlSet(),
  useDeactivateUroStripControlSet: () => mockUseDeactivateUroStripControlSet(),
  useUroStripRuns: (...args: unknown[]) => mockUseUroStripRuns(...args),
  useCreateUroStripRun: () => mockUseCreateUroStripRun(),
  useDeleteUroStripRun: () => mockUseDeleteUroStripRun(),
  useUroSedimentRuns: (...args: unknown[]) => mockUseUroSedimentRuns(...args),
  useCreateUroSedimentRun: () => mockUseCreateUroSedimentRun(),
  useDeleteUroSedimentRun: () => mockUseDeleteUroSedimentRun(),
}))

vi.mock('../../../hooks/useReagents', () => ({
  useReagentLots: (...args: unknown[]) => mockUseReagentLots(...args),
  useResponsibles: () => mockUseResponsibles(),
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      username: 'ana',
      name: 'Ana Biomédica',
      role: 'ADMIN',
      isActive: true,
      permissions: ['QC_AREAS_WRITE', 'QC_VIEW'],
    },
  }),
}))

const sampleControlSet: UroStripControlSet = {
  id: 'control-1',
  controlLotNumber: 'URiE 02382024',
  manufacturer: 'Uro-Trol',
  validUntil: '2026-04-23',
  expectedPhMin: 5.0,
  expectedPhMax: 6.0,
  expectedDensityMin: 1.005,
  expectedDensityMax: 1.025,
  expectedProteins: 'NEGATIVO',
  expectedGlucose: 'NEGATIVO',
  expectedKetones: 'NEGATIVO',
  expectedBlood: 'NEGATIVO',
  expectedUrobilinogen: 'NORMAL',
  expectedNitrite: 'NEGATIVO',
  expectedBilirubin: 'NEGATIVO',
  expectedLeukocytes: 'NEGATIVO',
  isActive: true,
  createdAt: '2026-09-03T10:00:00Z',
  updatedAt: '2026-09-03T10:00:00Z',
}

function renderArea() {
  return render(
    <ToastProvider>
      <UroanaliseArea />
    </ToastProvider>
  )
}

describe('UroanaliseArea', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseUroStripControlSets.mockReturnValue({ data: [sampleControlSet], isLoading: false })
    mockUseUroStripRuns.mockReturnValue({ data: [], isLoading: false })
    mockUseUroSedimentRuns.mockReturnValue({ data: [], isLoading: false })
    mockUseReagentLots.mockReturnValue({
      data: [
        {
          id: 'reagent-1',
          label: 'Urofita 10 Parâmetros',
          manufacturer: 'Urofita',
          lotNumber: '67551',
          validUntil: '2027-01-01',
          status: 'EM_USO',
        },
      ],
      isLoading: false,
    })
    mockUseResponsibles.mockReturnValue({
      data: [
        { id: 'user-1', name: 'Ana Biomédica', username: 'ana', role: 'ADMIN' },
        { id: 'user-2', name: 'Carlos Analista', username: 'carlos', role: 'FUNCIONARIO' },
      ],
      isLoading: false,
    })
    mockUseCreateUroStripRun.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseCreateUroSedimentRun.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseCreateUroStripControlSet.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseUpdateUroStripControlSet.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseDeleteUroStripRun.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseDeleteUroSedimentRun.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  })

  it('deve renderizar as 4 abas oficiais da Uroanálise sem botões duplicados no cabeçalho', () => {
    renderArea()

    expect(screen.getByRole('button', { name: /Tiras de Urina/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sedimento Urinário/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lotes de Controle/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Histórico & Corridas/i })).toBeInTheDocument()
  })

  it('deve exibir tabela da fita reativa e banner de status na aba inicial', () => {
    renderArea()

    expect(screen.getByText('Constituinte da Fita')).toBeInTheDocument()
    expect(screen.getByText('Densidade')).toBeInTheDocument()
    expect(screen.getByText('Proteínas')).toBeInTheDocument()
    expect(screen.getByText('Glicose')).toBeInTheDocument()
    expect(screen.getByText('CONTROLE APROVADO')).toBeInTheDocument()
  })

  it('deve alternar para a aba de Sedimento Urinário e exibir campos de dupla leitura e CV', async () => {
    const user = userEvent.setup()
    renderArea()

    const sedimentTabBtn = screen.getAllByRole('button', { name: /Sedimento Urinário/i })[0]
    await user.click(sedimentTabBtn)

    expect(screen.getByText('Sedimento Urinário (Controle Inter-Observador)')).toBeInTheDocument()
    expect(screen.getByLabelText(/Código do Paciente/i)).toBeInTheDocument()
    expect(screen.getByText('Leucócitos')).toBeInTheDocument()
    expect(screen.getByText('Hemácias')).toBeInTheDocument()
    expect(screen.getAllByText(/Tolerância: CV ≤ 20%/i)).toHaveLength(2)
  })

  it('deve alternar para a aba Lotes de Controle e permitir gerenciar os controles', async () => {
    const user = userEvent.setup()
    renderArea()

    const controlSetsTabBtn = screen.getByRole('button', { name: /Lotes de Controle/i })
    await user.click(controlSetsTabBtn)

    expect(screen.getByText('Gerenciamento de Lotes de Controle')).toBeInTheDocument()
    expect(screen.getByText('URiE 02382024')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Novo Lote de Controle/i })).toBeInTheDocument()
  })

  it('deve alternar para a aba de Histórico e exibir os 4 StatCards e alternância de visualização', async () => {
    const user = userEvent.setup()
    renderArea()

    const historyTabBtn = screen.getByRole('button', { name: /Histórico & Corridas/i })
    await user.click(historyTabBtn)

    expect(screen.getByText('Total de Corridas')).toBeInTheDocument()
    expect(screen.getByText(/Nenhum registro de fita reativa encontrado/i)).toBeInTheDocument()

    // O segundo botão é o toggle dentro de UroHistoryTab
    const sedimentSubBtn = screen.getAllByRole('button', { name: /Sedimento Urinário/i })[1]
    await user.click(sedimentSubBtn)

    expect(screen.getByText(/Nenhum ensaio inter-observador encontrado/i)).toBeInTheDocument()
  })

  it('deve exibir campo de ação corretiva e permitir aplicar sugestão rápida quando houver divergência no sedimento', async () => {
    const user = userEvent.setup()
    renderArea()

    const sedimentTabBtn = screen.getAllByRole('button', { name: /Sedimento Urinário/i })[0]
    await user.click(sedimentTabBtn)

    // O sedimento padrão possui divergência em bactérias (DISCRETA vs MODERADA)
    expect(screen.getByText('SEDIMENTO COM DIVERGÊNCIA (REPROVADO)')).toBeInTheDocument()
    expect(screen.getByText('Ação Corretiva Obrigatória (Sedimento com Divergência)')).toBeInTheDocument()

    // Clica em uma sugestão rápida
    const suggestionBtn = screen.getByRole('button', { name: /\+ Revisão conjunta das lâminas no microscópio/i })
    await user.click(suggestionBtn)

    // Verifica se o campo de texto foi preenchido com a ação selecionada
    const textarea = screen.getByPlaceholderText(/Descreva a ação tomada pelos analistas para harmonização dos resultados.../i)
    expect(textarea).toHaveValue('Revisão conjunta das lâminas no microscópio para alinhamento de campos')
  })
})



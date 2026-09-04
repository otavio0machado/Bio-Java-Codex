import { render, screen, fireEvent } from '@testing-library/react'
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

  it('deve exibir tabela da fita reativa com inputs limpos (sem valores prévios) e aguardando medição inicialmente', async () => {
    const user = userEvent.setup()
    renderArea()

    expect(screen.getByText('Constituinte da Fita')).toBeInTheDocument()
    expect(screen.getByText('Densidade')).toBeInTheDocument()
    expect(screen.getByText('Proteínas')).toBeInTheDocument()
    expect(screen.getByText('Glicose')).toBeInTheDocument()

    // Sem preenchimento prévio (campos vazios), o controle fica PENDENTE / AGUARDANDO MEDIÇÃO
    expect(screen.getByText('AGUARDANDO MEDIÇÃO')).toBeInTheDocument()
    const phInput = screen.getByLabelText('Resultado de pH') as HTMLInputElement
    const densityInput = screen.getByLabelText('Resultado de Densidade') as HTMLInputElement
    expect(phInput.value).toBe('')
    expect(densityInput.value).toBe('')

    // Ao preencher com valores válidos, passa para CONTROLE APROVADO
    await user.type(phInput, '5.5')
    await user.type(densityInput, '1.015')
    expect(screen.getByText('CONTROLE APROVADO')).toBeInTheDocument()
  })

  it('deve alternar para a aba de Sedimento Urinário e exibir campos limpos, dupla leitura e edição de CV e tolerância', async () => {
    const user = userEvent.setup()
    renderArea()

    const sedimentTabBtn = screen.getAllByRole('button', { name: /Sedimento Urinário/i })[0]
    await user.click(sedimentTabBtn)

    expect(screen.getByText('Sedimento Urinário (Controle Inter-Observador)')).toBeInTheDocument()
    const patientInput = screen.getByLabelText(/Código do Paciente/i) as HTMLInputElement
    expect(patientInput.value).toBe('')

    expect(screen.getByText('Leucócitos')).toBeInTheDocument()
    expect(screen.getByText('Hemácias')).toBeInTheDocument()

    // Tolerância padrão de 20% exibida e editável na célula
    const tolLeuko = screen.getByLabelText('Tolerância Leucócitos') as HTMLInputElement
    expect(tolLeuko.value).toBe('20')
    fireEvent.change(tolLeuko, { target: { value: '15' } })
    expect(tolLeuko.value).toBe('15')
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

    // Preenche contagens
    const l1 = screen.getByLabelText('Leucócitos Analista 1')
    const l2 = screen.getByLabelText('Leucócitos Analista 2')
    const e1 = screen.getByLabelText('Hemácias Analista 1')
    const e2 = screen.getByLabelText('Hemácias Analista 2')

    await user.type(l1, '4')
    await user.type(l2, '3')
    await user.type(e1, '2')
    await user.type(e2, '2')

    // Altera bactérias do analista 2 para criar divergência (ESCASSA vs MODERADA)
    const bact2 = screen.getByLabelText('Bactérias Analista 2')
    await user.selectOptions(bact2, 'MODERADA')

    expect(screen.getByText('SEDIMENTO COM DIVERGÊNCIA (REPROVADO)')).toBeInTheDocument()
    expect(screen.getByText('Ação Corretiva Obrigatória (Sedimento com Divergência)')).toBeInTheDocument()

    // Clica em uma sugestão rápida
    const suggestionBtn = screen.getByRole('button', { name: /\+ Revisão conjunta das lâminas no microscópio/i })
    await user.click(suggestionBtn)

    // Verifica se o campo de texto foi preenchido com a ação selecionada
    const textarea = screen.getByPlaceholderText(/Descreva a ação tomada pelos analistas para harmonização dos resultados.../i)
    expect(textarea).toHaveValue('Revisão conjunta das lâminas no microscópio para alinhamento de campos')
  })

  it('deve exibir caixas de seleção (select) para parâmetros qualitativos da fita e Urobilinogênio com apenas NEGATIVO e AUMENTADO', async () => {
    const user = userEvent.setup()
    renderArea()

    // Preenche pH e densidade para sair de PENDENTE
    const phInput = screen.getByLabelText('Resultado de pH')
    const densityInput = screen.getByLabelText('Resultado de Densidade')
    await user.type(phInput, '5.5')
    await user.type(densityInput, '1.015')

    // Verifica que os campos qualitativos usam caixas de seleção (select)
    const proteinsSelect = screen.getByLabelText('Resultado de Proteínas') as HTMLSelectElement
    const glucoseSelect = screen.getByLabelText('Resultado de Glicose') as HTMLSelectElement
    const ketonesSelect = screen.getByLabelText('Resultado de Corpos Cetônicos') as HTMLSelectElement
    const bloodSelect = screen.getByLabelText('Resultado de Sangue / Hemoglobina') as HTMLSelectElement
    const uroSelect = screen.getByLabelText('Resultado de Urobilinogênio') as HTMLSelectElement
    const nitriteSelect = screen.getByLabelText('Resultado de Nitrito') as HTMLSelectElement

    expect(proteinsSelect.tagName).toBe('SELECT')
    expect(glucoseSelect.tagName).toBe('SELECT')
    expect(ketonesSelect.tagName).toBe('SELECT')
    expect(bloodSelect.tagName).toBe('SELECT')
    expect(uroSelect.tagName).toBe('SELECT')
    expect(nitriteSelect.tagName).toBe('SELECT')

    // Urobilinogênio deve ter exatamente 2 opções: NEGATIVO e AUMENTADO (sem frações mg/dL)
    const uroOptions = Array.from(uroSelect.options).map((opt) => opt.value)
    expect(uroOptions).toEqual(['NEGATIVO', 'AUMENTADO'])
    expect(uroOptions).not.toContain('0.2 mg/dL')
    expect(uroOptions).not.toContain('1.0 mg/dL')
    expect(uroOptions).not.toContain('2.0 mg/dL')

    // Inicialmente com NEGATIVO (esperado NORMAL na bula), o controle está aprovado
    expect(uroSelect.value).toBe('NEGATIVO')
    expect(screen.getByText('CONTROLE APROVADO')).toBeInTheDocument()

    // Ao mudar Urobilinogênio para AUMENTADO, deve acusar divergência imediata e REPROVADO
    await user.selectOptions(uroSelect, 'AUMENTADO')
    expect(uroSelect.value).toBe('AUMENTADO')
    expect(screen.getByText('CONTROLE REPROVADO')).toBeInTheDocument()

    // Ao retornar para NEGATIVO, volta a ser APROVADO
    await user.selectOptions(uroSelect, 'NEGATIVO')
    expect(uroSelect.value).toBe('NEGATIVO')
    expect(screen.getByText('CONTROLE APROVADO')).toBeInTheDocument()
  })

  it('deve usar caixas de seleção (select) para todos os elementos qualitativos de sedimento urinário', async () => {
    const user = userEvent.setup()
    renderArea()

    const sedimentTabBtn = screen.getAllByRole('button', { name: /Sedimento Urinário/i })[0]
    await user.click(sedimentTabBtn)

    const bactA1 = screen.getByLabelText('Bactérias Analista 1') as HTMLSelectElement
    const bactA2 = screen.getByLabelText('Bactérias Analista 2') as HTMLSelectElement
    const epithA1 = screen.getByLabelText('Células Epiteliais Analista 1') as HTMLSelectElement
    const epithA2 = screen.getByLabelText('Células Epiteliais Analista 2') as HTMLSelectElement
    const mucusA1 = screen.getByLabelText('Filamento de Muco Analista 1') as HTMLSelectElement
    const mucusA2 = screen.getByLabelText('Filamento de Muco Analista 2') as HTMLSelectElement
    const crystA1 = screen.getByLabelText('Cristais Analista 1') as HTMLSelectElement
    const crystA2 = screen.getByLabelText('Cristais Analista 2') as HTMLSelectElement
    const othersA1 = screen.getByLabelText('Outros Analista 1') as HTMLSelectElement
    const othersA2 = screen.getByLabelText('Outros Analista 2') as HTMLSelectElement

    expect(bactA1.tagName).toBe('SELECT')
    expect(bactA2.tagName).toBe('SELECT')
    expect(epithA1.tagName).toBe('SELECT')
    expect(epithA2.tagName).toBe('SELECT')
    expect(mucusA1.tagName).toBe('SELECT')
    expect(mucusA2.tagName).toBe('SELECT')
    expect(crystA1.tagName).toBe('SELECT')
    expect(crystA2.tagName).toBe('SELECT')
    expect(othersA1.tagName).toBe('SELECT')
    expect(othersA2.tagName).toBe('SELECT')

    const binaryOptions = ['AUSENTE', 'PRESENTE']
    expect(Array.from(epithA1.options).map((o) => o.value)).toEqual(binaryOptions)
    expect(Array.from(mucusA1.options).map((o) => o.value)).toEqual(binaryOptions)
    expect(Array.from(crystA1.options).map((o) => o.value)).toEqual(binaryOptions)
    expect(Array.from(othersA1.options).map((o) => o.value)).toEqual(binaryOptions)
  })

  it('deve exibir todos os dados no histórico de tiras e sedimento e abrir modais de inspeção completa', async () => {
    const user = userEvent.setup()
    mockUseUroStripRuns.mockReturnValue({
      data: [
        {
          id: 'strip-run-1',
          controlSetId: 'control-1',
          dataMedicao: '2026-09-04',
          controlLotSnapshot: 'URiE 02382024',
          controlValidUntilSnapshot: '2026-04-23',
          measuredPh: 5.5,
          statusPh: 'APROVADO',
          measuredDensity: 1.015,
          statusDensity: 'APROVADO',
          measuredProteins: 'NEGATIVO',
          statusProteins: 'APROVADO',
          measuredGlucose: 'NEGATIVO',
          statusGlucose: 'APROVADO',
          measuredKetones: 'NEGATIVO',
          statusKetones: 'APROVADO',
          measuredBlood: 'NEGATIVO',
          statusBlood: 'APROVADO',
          measuredUrobilinogen: 'NEGATIVO',
          statusUrobilinogen: 'APROVADO',
          measuredNitrite: 'NEGATIVO',
          statusNitrite: 'APROVADO',
          statusGeral: 'APROVADO',
          analyst: 'Ana Biomédica',
          notes: 'Fita lote 67551 conferida',
          createdAt: '2026-09-04T10:00:00Z',
        },
      ],
      isLoading: false,
    })

    mockUseUroSedimentRuns.mockReturnValue({
      data: [
        {
          id: 'sed-run-1',
          dataMedicao: '2026-09-04',
          patientCode: 'PAC9988',
          analyst1Name: 'Ana Biomédica',
          analyst2Name: 'Carlos Analista',
          leukocytesA1: 4,
          leukocytesA2: 3,
          leukocytesCv: 19.8,
          statusLeukocytes: 'APROVADO',
          erythrocytesA1: 2,
          erythrocytesA2: 2,
          erythrocytesCv: 0,
          statusErythrocytes: 'APROVADO',
          bacteriaA1: 'ESCASSA',
          bacteriaA2: 'ESCASSA',
          statusBacteria: 'APROVADO',
          epithelialCellsA1: 'AUSENTE',
          epithelialCellsA2: 'AUSENTE',
          statusEpithelialCells: 'APROVADO',
          mucusThreadsA1: 'AUSENTE',
          mucusThreadsA2: 'AUSENTE',
          statusMucusThreads: 'APROVADO',
          crystalsA1: 'AUSENTE',
          crystalsA2: 'AUSENTE',
          statusCrystals: 'APROVADO',
          othersA1: 'AUSENTE',
          othersA2: 'AUSENTE',
          statusOthers: 'APROVADO',
          statusGeral: 'APROVADO',
          notes: 'Concordância perfeita',
          createdAt: '2026-09-04T10:30:00Z',
        },
      ],
      isLoading: false,
    })

    renderArea()

    const historyTabBtn = screen.getByRole('button', { name: /Histórico & Corridas/i })
    await user.click(historyTabBtn)

    // Colunas da fita reativa presentes na tabela
    expect(screen.getByText('Corpos Cetônicos')).toBeInTheDocument()
    expect(screen.getByText('Sangue / Hb')).toBeInTheDocument()
    expect(screen.getByText('Urobilinogênio')).toBeInTheDocument()
    expect(screen.getByText('Nitrito')).toBeInTheDocument()
    expect(screen.getByText('Fita lote 67551 conferida')).toBeInTheDocument()

    // Abre modal de detalhes da fita
    const viewStripBtn = screen.getByLabelText('Ver detalhes da fita')
    await user.click(viewStripBtn)
    expect(screen.getByText('Todos os Dados do Controle de Qualidade — Tiras de Urina')).toBeInTheDocument()
    expect(screen.getByText('Constituintes da Fita Reativa (Físico-Químico)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()

    // Fecha modal
    await user.click(screen.getByRole('button', { name: 'Fechar' }))

    // Alterna para visão de sedimento
    const sedimentSubBtn = screen.getAllByRole('button', { name: /Sedimento Urinário/i })[1]
    await user.click(sedimentSubBtn)

    // Colunas do sedimento presentes na tabela
    expect(screen.getByText('Células Epiteliais')).toBeInTheDocument()
    expect(screen.getByText('Filamento de Muco')).toBeInTheDocument()
    expect(screen.getByText('Cristais')).toBeInTheDocument()
    expect(screen.getByText('PAC9988')).toBeInTheDocument()
    expect(screen.getByText('Concordância perfeita')).toBeInTheDocument()

    // Abre modal de detalhes do sedimento
    const viewSedBtn = screen.getByLabelText('Ver detalhes do sedimento')
    await user.click(viewSedBtn)
    expect(screen.getByText('Todos os Dados do Controle de Qualidade — Sedimento Urinário')).toBeInTheDocument()
    expect(screen.getByText('Avaliação Comparativa de Sedimento Urinário (Microscopia)')).toBeInTheDocument()
  })
})



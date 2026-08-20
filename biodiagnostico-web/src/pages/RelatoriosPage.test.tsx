import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../contexts/auth-context'
import type { ReportDefinition } from '../types/reportsV2'
import { ToastProvider } from '../components/ui'
import { RelatoriosPage } from './RelatoriosPage'

const mockCatalog = vi.fn()

vi.mock('../services/reportsV2Service', async () => {
  const actual = await vi.importActual<typeof import('../services/reportsV2Service')>(
    '../services/reportsV2Service',
  )
  return {
    ...actual,
    reportsV2Service: {
      ...actual.reportsV2Service,
      catalog: () => mockCatalog(),
      listExecutions: () => Promise.resolve({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 1 }),
    },
  }
})

// Mock hooks internos do RelatoriosTab V1 para evitar chamadas reais.
vi.mock('../hooks/useQcRecords', () => ({
  useQcExams: () => ({ data: [] }),
}))

vi.mock('../hooks/useReports', () => ({
  useReportHistory: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
}))

const authValue: AuthContextValue = {
  user: {
    id: 'user-1',
    username: 'admin',
    email: 'admin@bio.com',
    name: 'Admin',
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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/relatorios']}>
        <AuthContext.Provider value={authValue}>
          <ToastProvider>
            <RelatoriosPage />
          </ToastProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockCatalog.mockReset()
})

const sampleDefinition: ReportDefinition = {
  code: 'CQ_OPERATIONAL_V2',
  name: 'Relatorio Operacional de CQ',
  description: 'CQ com estatisticas e Westgard',
  subtitle: 'CQ completo com Levey-Jennings',
  icon: 'flask-conical',
  category: 'CONTROLE_QUALIDADE',
  supportedFormats: ['PDF'],
  filterSpec: { fields: [] },
  roleAccess: ['ADMIN'],
  signatureRequired: false,
  previewSupported: true,
  aiCommentaryCapable: true,
  retentionDays: 1825,
  legalBasis: 'RDC 786/2023',
}

describe('RelatoriosPage', () => {
  it('renderiza Relatórios e catálogo harmonizados com o design system', async () => {
    mockCatalog.mockResolvedValue([sampleDefinition])

    renderPage()

    expect(await screen.findByRole('button', { name: /Catálogo de Relatórios/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Histórico de Emissões/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: /Relatórios/i })).toBeInTheDocument()
    // Presets rápidos devem estar visíveis
    expect(screen.getByText(/Fechamento de CQ/i)).toBeInTheDocument()
    expect(screen.getByText(/Dossiê ANVISA/i)).toBeInTheDocument()
    // Card do laudo deve aparecer no catálogo
    expect(await screen.findByText('Relatorio Operacional de CQ')).toBeInTheDocument()
  })
})

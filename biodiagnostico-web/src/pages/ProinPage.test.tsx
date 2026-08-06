import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProinPage } from './ProinPage'

const mockUseAuth = vi.fn()

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: {
      id: 'user-1',
      username: 'ana',
      name: 'Ana',
      role: 'ADMIN',
      isActive: true,
      permissions: [],
    },
  })
})

vi.mock('../components/proin/AiAssistantPanel', () => ({ AiAssistantPanel: () => null }))
vi.mock('../components/proin/DashboardTab', () => ({
  DashboardTab: ({ area }: { area: string }) => <div>dashboard-{area}</div>,
}))
vi.mock('../components/proin/RegistroTab', () => ({
  RegistroTab: ({ area }: { area: string }) => <div>registro-{area}</div>,
}))
vi.mock('../components/proin/ReferenciasTab', () => ({
  ReferenciasTab: ({ area }: { area: string }) => <div>referencias-{area}</div>,
}))

describe('ProinPage — Coagulação', () => {
  it('oferece o mesmo ciclo completo de abas da Bioquímica', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/qc?area=coagulacao']}>
        <ProinPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Coagulação' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Seções de CQ de Coagulação' })).toBeInTheDocument()
    expect(await screen.findByText('dashboard-coagulacao')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Registro CQ' }))
    expect(await screen.findByText('registro-coagulacao')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Referências' }))
    expect(await screen.findByText('referencias-coagulacao')).toBeInTheDocument()
  })

  it('redireciona acesso direto ao registro para dashboard quando usuário não pode escrever CQ', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'viewer-1',
        username: 'bia',
        name: 'Bia',
        role: 'VISUALIZADOR',
        isActive: true,
        permissions: [],
      },
    })

    render(
      <MemoryRouter initialEntries={['/qc?area=coagulacao&tab=registro']}>
        <ProinPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('dashboard-coagulacao')).toBeInTheDocument()
    expect(screen.queryByText('registro-coagulacao')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registro CQ' })).not.toBeInTheDocument()
  })

  it('preserva redirect legado solicitado na Bioquímica', async () => {
    render(
      <MemoryRouter initialEntries={['/qc?area=bioquimica&tab=configuracao']}>
        <Routes>
          <Route path="/qc" element={<ProinPage />} />
          <Route path="/config" element={<div>destino-configuracao</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('destino-configuracao')).toBeInTheDocument()
  })

  it('faz aba desconhecida de Coagulação cair no dashboard sem redirect legado', async () => {
    render(
      <MemoryRouter initialEntries={['/qc?area=coagulacao&tab=configuracao']}>
        <Routes>
          <Route path="/qc" element={<ProinPage />} />
          <Route path="/config" element={<div>destino-configuracao</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('dashboard-coagulacao')).toBeInTheDocument()
    expect(screen.queryByText('destino-configuracao')).not.toBeInTheDocument()
  })
})

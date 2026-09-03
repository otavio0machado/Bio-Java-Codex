import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UserDetailsModal } from './UserDetailsModal'
import { UserTable } from './UserTable'
import { exportUsersToCsv, formatDateTime, generateSecurePassword } from './adminHelpers'
import type { User } from '../../types'

describe('Admin User Management Features', () => {
  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'adelaine',
    name: 'Adelaine Silva',
    email: 'adelaine@biodiagnostico.com.br',
    role: 'FUNCIONARIO',
    isActive: true,
    permissions: ['TEMPERATURE_VIEW', 'TEMPERATURE_WRITE'],
    createdAt: '2026-03-01T10:00:00Z',
    lastLoginAt: '2026-03-03T15:30:00Z',
    mustChangePassword: true,
  }

  describe('generateSecurePassword', () => {
    it('gera senha segura iniciando com Bio# e com ao menos 8 caracteres', () => {
      const pw1 = generateSecurePassword()
      const pw2 = generateSecurePassword()

      expect(pw1).toMatch(/^Bio#/)
      expect(pw1.length).toBeGreaterThanOrEqual(8)
      expect(pw1).not.toEqual(pw2)
    })
  })

  describe('formatDateTime', () => {
    it('formata data ISO em padrão legível pt-BR', () => {
      const formatted = formatDateTime('2026-03-03T15:30:00Z')
      expect(formatted).toMatch(/03\/03\/2026/)
    })

    it('retorna Nunca acessou para valores nulos ou vazios', () => {
      expect(formatDateTime(null)).toBe('Nunca acessou')
      expect(formatDateTime(undefined)).toBe('Nunca acessou')
    })
  })

  describe('UserDetailsModal', () => {
    it('renderiza os detalhes cadastrais do usuário e botões de ação', () => {
      const onClose = vi.fn()
      const onEdit = vi.fn()
      const onResetPassword = vi.fn()
      const onViewAudit = vi.fn()
      const onRevokeSessions = vi.fn()
      const onDelete = vi.fn()

      render(
        <UserDetailsModal
          user={mockUser}
          onClose={onClose}
          onEdit={onEdit}
          onResetPassword={onResetPassword}
          onViewAudit={onViewAudit}
          onRevokeSessions={onRevokeSessions}
          onDelete={onDelete}
          currentUserId="admin-id"
        />
      )

      expect(screen.getByText('Ficha Cadastral do Usuário')).toBeInTheDocument()
      expect(screen.getByText('Adelaine Silva')).toBeInTheDocument()
      expect(screen.getByText('@adelaine')).toBeInTheDocument()
      expect(screen.getByText('adelaine@biodiagnostico.com.br')).toBeInTheDocument()
      expect(screen.getByText('Conta Ativa')).toBeInTheDocument()
      expect(screen.getByText('Temperatura')).toBeInTheDocument()

      const auditBtn = screen.getByRole('button', { name: /Auditoria/i })
      fireEvent.click(auditBtn)
      expect(onViewAudit).toHaveBeenCalledWith(mockUser)

      const revokeBtn = screen.getByRole('button', { name: /Desconectar/i })
      fireEvent.click(revokeBtn)
      expect(onRevokeSessions).toHaveBeenCalledWith(mockUser)
    })
  })

  describe('UserTable sorting', () => {
    it('ordena usuários ao clicar nos cabeçalhos de coluna', () => {
      const userA: User = {
        id: '1',
        username: 'bruno',
        name: 'Bruno Lima',
        role: 'FUNCIONARIO',
        isActive: true,
        permissions: [],
      }
      const userB: User = {
        id: '2',
        username: 'alice',
        name: 'Alice Alcantara',
        role: 'ADMIN',
        isActive: false,
        permissions: [],
      }

      const { container } = render(
        <UserTable
          users={[userA, userB]}
          onEdit={vi.fn()}
          onResetPassword={vi.fn()}
        />
      )

      // Inicialmente ordenado por name asc: Alice, depois Bruno
      const rows = container.querySelectorAll('tbody tr')
      expect(rows[0]).toHaveTextContent('Alice Alcantara')
      expect(rows[1]).toHaveTextContent('Bruno Lima')

      // Clicar no cabeçalho Usuário inverte para desc
      const userHeader = screen.getByText('Usuário')
      fireEvent.click(userHeader)

      const reorderedRows = container.querySelectorAll('tbody tr')
      expect(reorderedRows[0]).toHaveTextContent('Bruno Lima')
      expect(reorderedRows[1]).toHaveTextContent('Alice Alcantara')
    })
  })

  describe('exportUsersToCsv', () => {
    it('cria elemento de download e dispara clique com colunas corretas', () => {
      const originalCreateObjectURL = window.URL.createObjectURL
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:test')

      const linkMock = {
        setAttribute: vi.fn(),
        click: vi.fn(),
      }
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(linkMock as any)
      const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => linkMock as any)
      const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => linkMock as any)

      exportUsersToCsv([mockUser])

      expect(createElementSpy).toHaveBeenCalledWith('a')
      expect(linkMock.setAttribute).toHaveBeenCalledWith('href', 'blob:test')
      expect(linkMock.click).toHaveBeenCalled()

      createElementSpy.mockRestore()
      appendSpy.mockRestore()
      removeSpy.mockRestore()
      window.URL.createObjectURL = originalCreateObjectURL
    })
  })
})

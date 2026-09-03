import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LOCAL_PERMISSION_CATALOG } from '../../lib/permissions'
import { ModulePermissionSelector } from './ModulePermissionSelector'
import { getUserActiveModules } from './UserTable'
import type { User } from '../../types'

describe('ModulePermissionSelector', () => {
  const catalog = LOCAL_PERMISSION_CATALOG.modules

  it('renderiza os módulos operacionais disponíveis', () => {
    render(
      <ModulePermissionSelector
        selectedPermissions={[]}
        onChange={vi.fn()}
        catalog={catalog}
      />
    )

    expect(screen.getByText('Controle de Temperatura')).toBeInTheDocument()
    expect(screen.getByText('Reagentes e Estoque')).toBeInTheDocument()
    expect(screen.getByText(/Controle de Qualidade/)).toBeInTheDocument()
    expect(screen.getByText('Manutenção de Equipamentos')).toBeInTheDocument()
    expect(screen.getByText('Central de Relatórios')).toBeInTheDocument()
  })

  it('permite selecionar somente o módulo de Temperatura em 1 clique', () => {
    const onChange = vi.fn()
    render(
      <ModulePermissionSelector
        selectedPermissions={[]}
        onChange={onChange}
        catalog={catalog}
      />
    )

    const btnTemp = screen.getByRole('button', { name: /Somente Temperatura/i })
    fireEvent.click(btnTemp)

    expect(onChange).toHaveBeenCalledTimes(1)
    const selected = onChange.mock.calls[0][0] as string[]
    expect(selected).toContain('TEMPERATURE_VIEW')
    expect(selected).toContain('TEMPERATURE_WRITE')
    expect(selected).toContain('DASHBOARD_VIEW')
    expect(selected).not.toContain('REAGENTS_WRITE')
    expect(selected).not.toContain('QC_WRITE')
  })

  it('permite selecionar somente o módulo de Reagentes em 1 clique', () => {
    const onChange = vi.fn()
    render(
      <ModulePermissionSelector
        selectedPermissions={[]}
        onChange={onChange}
        catalog={catalog}
      />
    )

    const btnReagents = screen.getByRole('button', { name: /Somente Reagentes/i })
    fireEvent.click(btnReagents)

    expect(onChange).toHaveBeenCalledTimes(1)
    const selected = onChange.mock.calls[0][0] as string[]
    expect(selected).toContain('REAGENTS_VIEW')
    expect(selected).toContain('REAGENTS_WRITE')
    expect(selected).toContain('DASHBOARD_VIEW')
    expect(selected).not.toContain('REAGENTS_DELETE') // seguro por padrão
    expect(selected).not.toContain('TEMPERATURE_WRITE')
  })

  it('permite desmarcar todos os módulos', () => {
    const onChange = vi.fn()
    render(
      <ModulePermissionSelector
        selectedPermissions={['TEMPERATURE_VIEW', 'TEMPERATURE_WRITE', 'DASHBOARD_VIEW']}
        onChange={onChange}
        catalog={catalog}
      />
    )

    const btnClear = screen.getByRole('button', { name: /Desmarcar Todos/i })
    fireEvent.click(btnClear)

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('exibe resumo dos módulos liberados', () => {
    render(
      <ModulePermissionSelector
        selectedPermissions={['TEMPERATURE_VIEW', 'TEMPERATURE_WRITE', 'DASHBOARD_VIEW']}
        onChange={vi.fn()}
        catalog={catalog}
      />
    )

    expect(
      screen.getByText(/Temperatura \(3 permissões\)/i)
    ).toBeInTheDocument()
  })

  it('alterna o nível de acesso para Apenas Consulta em módulo ativo', () => {
    const onChange = vi.fn()
    render(
      <ModulePermissionSelector
        selectedPermissions={['TEMPERATURE_VIEW', 'TEMPERATURE_WRITE', 'DASHBOARD_VIEW']}
        onChange={onChange}
        catalog={catalog}
      />
    )

    const btnReadOnly = screen.getByRole('button', {
      name: /Apenas Consulta \(Somente Leitura\)/i,
    })
    fireEvent.click(btnReadOnly)

    expect(onChange).toHaveBeenCalled()
    const selected = onChange.mock.calls[0][0] as string[]
    expect(selected).toContain('TEMPERATURE_VIEW')
    expect(selected).not.toContain('TEMPERATURE_WRITE')
  })
})

describe('getUserActiveModules helper', () => {
  it('retorna Acesso Total para ADMIN', () => {
    const user: User = {
      id: '1',
      username: 'admin',
      name: 'Admin',
      role: 'ADMIN',
      isActive: true,
      permissions: [],
    }
    expect(getUserActiveModules(user)).toEqual(['Acesso Total'])
  })

  it('retorna os módulos específicos autorizados para FUNCIONARIO', () => {
    const user: User = {
      id: '2',
      username: 'tec.temp',
      name: 'Técnico Temp',
      role: 'FUNCIONARIO',
      isActive: true,
      permissions: ['TEMPERATURE_VIEW', 'TEMPERATURE_WRITE', 'DASHBOARD_VIEW'],
    }
    expect(getUserActiveModules(user)).toEqual(['Temperatura'])
  })

  it('identifica múltiplos módulos específicos para FUNCIONARIO', () => {
    const user: User = {
      id: '3',
      username: 'tec.pleno',
      name: 'Técnico Pleno',
      role: 'FUNCIONARIO',
      isActive: true,
      permissions: [
        'TEMPERATURE_VIEW',
        'TEMPERATURE_WRITE',
        'REAGENTS_VIEW',
        'REAGENTS_WRITE',
        'DASHBOARD_VIEW',
      ],
    }
    expect(getUserActiveModules(user)).toEqual(['Temperatura', 'Reagentes'])
  })

  it('retorna Todos os Módulos quando todos os 5 módulos estão autorizados', () => {
    const user: User = {
      id: '4',
      username: 'tec.geral',
      name: 'Técnico Geral',
      role: 'FUNCIONARIO',
      isActive: true,
      permissions: [
        'TEMPERATURE_VIEW',
        'REAGENTS_VIEW',
        'QC_VIEW',
        'MAINTENANCE_VIEW',
        'REPORTS_VIEW',
        'DASHBOARD_VIEW',
      ],
    }
    expect(getUserActiveModules(user)).toEqual(['Todos os Módulos'])
  })
})

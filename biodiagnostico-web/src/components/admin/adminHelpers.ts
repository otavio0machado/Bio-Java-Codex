import axios from 'axios'
import { LOCAL_PERMISSION_CATALOG } from '../../lib/permissions'
import type { ModuleGroup } from '../../types'

export function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data
    if (typeof data === 'string' && data.trim()) return data
    if (data && typeof data === 'object') {
      if ('message' in data && typeof data.message === 'string' && data.message.trim()) {
        return data.message
      }
      if ('error' in data && typeof data.error === 'string' && data.error.trim()) {
        return data.error
      }
    }
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  return fallback
}

export function normalizeModuleCatalog(rawModules?: any[]): ModuleGroup[] {
  if (!rawModules || !Array.isArray(rawModules) || rawModules.length === 0) {
    return LOCAL_PERMISSION_CATALOG.modules
  }
  return rawModules.map((m) => {
    const moduleId = String(m.moduleId || m.module || '').toUpperCase()
    const moduleName = String(m.moduleName || m.label || moduleId)
    const description = String(m.description || '')
    const permissions = Array.isArray(m.permissions)
      ? m.permissions.map((p: any) => ({
          name: String(p.name || p.code || ''),
          label: String(p.label || p.name || p.code || ''),
          description: String(p.description || ''),
          module: String(p.module || moduleId),
          action: String(p.action || p.actionType || 'VIEW'),
          impliedPermissions: Array.isArray(p.impliedPermissions)
            ? p.impliedPermissions
            : Array.isArray(p.implies)
            ? p.implies
            : [],
        }))
      : []
    return {
      moduleId,
      moduleName,
      description,
      permissions,
    }
  })
}

export function generateSecurePassword(): string {
  const charsUpper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const charsLower = 'abcdefghjkmnpqrstuvwxyz'
  const charsDigits = '23456789'
  const charsSpecial = '!@#$%&*'

  const getRandom = (chars: string) => chars[Math.floor(Math.random() * chars.length)]

  const part1 = 'Bio#'
  const part2 = getRandom(charsDigits) + getRandom(charsDigits) + getRandom(charsDigits)
  const part3 = getRandom(charsSpecial) + getRandom(charsUpper) + getRandom(charsLower)

  return `${part1}${part2}${part3}`
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return 'Nunca acessou'
  try {
    const date = new Date(iso)
    if (isNaN(date.getTime())) return String(iso)
    return (
      date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }) +
      ' às ' +
      date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    )
  } catch {
    return String(iso)
  }
}

export function exportUsersToCsv(users: import('../../types').User[]): void {
  const headers = [
    'Nome Completo',
    'Login de Acesso',
    'Email Institucional',
    'Perfil de Acesso (Role)',
    'Status',
    'Módulos Autorizados',
    'Troca de Senha Obrigatória',
    'Último Acesso',
    'Data de Cadastro',
  ]

  const rows = users.map((u) => {
    let modulos = 'Acesso Total'
    if (u.role === 'FUNCIONARIO') {
      const perms = u.permissions || []
      const mods: string[] = []
      if (perms.some((p) => p.startsWith('TEMPERATURE_'))) mods.push('Temperatura')
      if (perms.some((p) => p.startsWith('REAGENTS_'))) mods.push('Reagentes')
      if (perms.some((p) => p.startsWith('QC_'))) mods.push('CQ PROIN')
      if (perms.some((p) => p.startsWith('MAINTENANCE_'))) mods.push('Manutenção')
      if (perms.some((p) => p.startsWith('REPORTS_'))) mods.push('Relatórios')
      modulos = mods.length === 5 ? 'Todos os Módulos' : mods.length === 0 ? 'Nenhum' : mods.join('; ')
    } else if (u.role === 'VIGILANCIA_SANITARIA') {
      modulos = 'Auditoria Geral (Leitura)'
    } else if (u.role === 'VISUALIZADOR') {
      modulos = 'Consulta Geral'
    }

    return [
      `"${(u.name || '').replace(/"/g, '""')}"`,
      `"${(u.username || '').replace(/"/g, '""')}"`,
      `"${(u.email || '').replace(/"/g, '""')}"`,
      `"${u.role}"`,
      `"${u.isActive ? 'Ativo' : 'Inativo'}"`,
      `"${modulos}"`,
      `"${u.mustChangePassword ? 'Sim' : 'Não'}"`,
      `"${formatDateTime(u.lastLoginAt)}"`,
      `"${formatDateTime(u.createdAt)}"`,
    ].join(',')
  })

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute(
    'download',
    `biodiagnostico_relacao_usuarios_${new Date().toISOString().slice(0, 10)}.csv`
  )
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

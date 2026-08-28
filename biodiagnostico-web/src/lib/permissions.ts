import type { User, Role, Permission, PermissionCatalogResponse } from '../types'

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  FUNCIONARIO: 'Funcionário',
  VIGILANCIA_SANITARIA: 'Vigilância Sanitária',
  VISUALIZADOR: 'Visualizador',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: 'Acesso total automático a todas as funcionalidades operacionais e administrativas do sistema.',
  FUNCIONARIO: 'Perfil operacional com permissões granulares configuráveis pelo administrador.',
  VIGILANCIA_SANITARIA: 'Perfil regulatório de auditoria com acesso de visualização a todos os módulos e exportação/download de relatórios.',
  VISUALIZADOR: 'Perfil somente-leitura em todos os módulos, sem permissões de escrita, exclusão ou download de arquivos.',
}

export const CANONICAL_PERMISSIONS: Permission[] = [
  'DASHBOARD_VIEW',
  'QC_VIEW',
  'QC_WRITE',
  'QC_AREAS_WRITE',
  'QC_IMPORT',
  'QC_EXPORT',
  'REAGENTS_VIEW',
  'REAGENTS_WRITE',
  'REAGENTS_DELETE',
  'MAINTENANCE_VIEW',
  'MAINTENANCE_WRITE',
  'TEMPERATURE_VIEW',
  'TEMPERATURE_WRITE',
  'REPORTS_VIEW',
  'REPORTS_GENERATE',
  'REPORTS_DOWNLOAD',
]

export const PERMISSION_LABELS: Record<string, string> = {
  DASHBOARD_VIEW: 'Visualizar Dashboard',
  QC_VIEW: 'Visualizar Controle de Qualidade',
  QC_WRITE: 'Registrar Medições de CQ',
  QC_AREAS_WRITE: 'Gerenciar CQ por Áreas (Hematologia/Imuno)',
  QC_IMPORT: 'Importar Lotes de CQ',
  QC_EXPORT: 'Exportar Dados de CQ',
  REAGENTS_VIEW: 'Visualizar Reagentes e Estoque',
  REAGENTS_WRITE: 'Gerenciar e Movimentar Lotes de Reagentes',
  REAGENTS_DELETE: 'Excluir Lotes de Reagentes',
  MAINTENANCE_VIEW: 'Visualizar Manutenções de Equipamentos',
  MAINTENANCE_WRITE: 'Registrar Manutenções Preventivas e Corretivas',
  TEMPERATURE_VIEW: 'Visualizar Controle de Temperatura',
  TEMPERATURE_WRITE: 'Registrar Temperaturas e Termômetros',
  REPORTS_VIEW: 'Acessar Central de Relatórios',
  REPORTS_GENERATE: 'Gerar Novos Relatórios Gerenciais',
  REPORTS_DOWNLOAD: 'Baixar e Exportar Relatórios',
  // Legados / Aliases
  REAGENT_WRITE: 'Gerenciar Reagentes (Legado)',
  DOWNLOAD: 'Baixar Relatórios (Legado)',
  IMPORT: 'Importar Dados (Legado)',
}

export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  DASHBOARD_VIEW: 'Permite visualizar os indicadores e métricas da página inicial.',
  QC_VIEW: 'Permite visualizar gráficos de Levey-Jennings, histórico e relatórios de CQ PROIN.',
  QC_WRITE: 'Permite lançar e editar resultados de medições de CQ e calibrações.',
  QC_AREAS_WRITE: 'Permite criar parâmetros e medições em Hematologia, Imunologia e Coagulação.',
  QC_IMPORT: 'Permite carregar arquivos CSV/lotes de importação de CQ.',
  QC_EXPORT: 'Permite exportar dados históricos de CQ.',
  REAGENTS_VIEW: 'Permite consultar o estoque de reagentes e movimentações.',
  REAGENTS_WRITE: 'Permite cadastrar reagentes, registrar entradas, saídas e arquivamentos.',
  REAGENTS_DELETE: 'Permite excluir permanentemente lotes de reagentes.',
  MAINTENANCE_VIEW: 'Permite visualizar cronogramas e histórico de manutenção.',
  MAINTENANCE_WRITE: 'Permite cadastrar e concluir manutenções de equipamentos.',
  TEMPERATURE_VIEW: 'Permite consultar mapa térmico e histórico de temperaturas.',
  TEMPERATURE_WRITE: 'Permite registrar temperaturas diárias e processar fotos via OCR.',
  REPORTS_VIEW: 'Permite acessar a página de relatórios analíticos.',
  REPORTS_GENERATE: 'Permite disparar a compilação de novos relatórios.',
  REPORTS_DOWNLOAD: 'Permite baixar PDFs e CSVs gerados.',
}

/**
 * Normaliza qualquer permissão (inclusive aliases legados) para a canônica.
 */
export function normalizePermission(raw: string): Permission | null {
  if (!raw) return null
  const upper = raw.trim().toUpperCase()
  if (upper === 'REAGENT_WRITE') return 'REAGENTS_WRITE'
  if (upper === 'DOWNLOAD') return 'REPORTS_DOWNLOAD'
  if (upper === 'IMPORT') return 'QC_IMPORT'
  if (CANONICAL_PERMISSIONS.includes(upper as Permission)) {
    return upper as Permission
  }
  return null
}

/**
 * Expande permissões implícitas (WRITE implica VIEW, etc.).
 */
export function expandImpliedPermissions(perms: string[]): Set<Permission> {
  const result = new Set<Permission>()

  for (const raw of perms) {
    const canonical = normalizePermission(raw)
    if (!canonical) continue
    result.add(canonical)

    if (canonical.startsWith('QC_') && canonical !== 'QC_VIEW') {
      result.add('QC_VIEW')
    } else if (canonical.startsWith('REAGENTS_') && canonical !== 'REAGENTS_VIEW') {
      result.add('REAGENTS_VIEW')
    } else if (canonical.startsWith('MAINTENANCE_') && canonical !== 'MAINTENANCE_VIEW') {
      result.add('MAINTENANCE_VIEW')
    } else if (canonical.startsWith('TEMPERATURE_') && canonical !== 'TEMPERATURE_VIEW') {
      result.add('TEMPERATURE_VIEW')
    } else if (canonical.startsWith('REPORTS_') && canonical !== 'REPORTS_VIEW') {
      result.add('REPORTS_VIEW')
    }
  }

  if (result.size > 0) {
    result.add('DASHBOARD_VIEW')
  }

  return result
}

/**
 * Fallback local do catálogo de permissões agrupado por módulo.
 */
export const LOCAL_PERMISSION_CATALOG: PermissionCatalogResponse = {
  modules: [
    {
      moduleId: 'DASHBOARD',
      moduleName: 'Dashboard Geral',
      description: 'Métricas gerais e indicadores do laboratório',
      permissions: [
        {
          name: 'DASHBOARD_VIEW',
          label: PERMISSION_LABELS.DASHBOARD_VIEW,
          description: PERMISSION_DESCRIPTIONS.DASHBOARD_VIEW,
          module: 'DASHBOARD',
          action: 'VIEW',
          impliedPermissions: [],
        },
      ],
    },
    {
      moduleId: 'QC',
      moduleName: 'Controle de Qualidade (PROIN & Áreas)',
      description: 'Lançamentos, gráficos de Levey-Jennings, regras de Westgard e importações',
      permissions: [
        {
          name: 'QC_VIEW',
          label: PERMISSION_LABELS.QC_VIEW,
          description: PERMISSION_DESCRIPTIONS.QC_VIEW,
          module: 'QC',
          action: 'VIEW',
          impliedPermissions: ['DASHBOARD_VIEW'],
        },
        {
          name: 'QC_WRITE',
          label: PERMISSION_LABELS.QC_WRITE,
          description: PERMISSION_DESCRIPTIONS.QC_WRITE,
          module: 'QC',
          action: 'WRITE',
          impliedPermissions: ['QC_VIEW', 'DASHBOARD_VIEW'],
        },
        {
          name: 'QC_AREAS_WRITE',
          label: PERMISSION_LABELS.QC_AREAS_WRITE,
          description: PERMISSION_DESCRIPTIONS.QC_AREAS_WRITE,
          module: 'QC',
          action: 'AREAS_WRITE',
          impliedPermissions: ['QC_VIEW', 'DASHBOARD_VIEW'],
        },
        {
          name: 'QC_IMPORT',
          label: PERMISSION_LABELS.QC_IMPORT,
          description: PERMISSION_DESCRIPTIONS.QC_IMPORT,
          module: 'QC',
          action: 'IMPORT',
          impliedPermissions: ['QC_VIEW', 'DASHBOARD_VIEW'],
        },
        {
          name: 'QC_EXPORT',
          label: PERMISSION_LABELS.QC_EXPORT,
          description: PERMISSION_DESCRIPTIONS.QC_EXPORT,
          module: 'QC',
          action: 'EXPORT',
          impliedPermissions: ['QC_VIEW', 'DASHBOARD_VIEW'],
        },
      ],
    },
    {
      moduleId: 'REAGENTS',
      moduleName: 'Reagentes e Estoque',
      description: 'Gestão de lotes, estoque, entradas, saídas e rastreabilidade',
      permissions: [
        {
          name: 'REAGENTS_VIEW',
          label: PERMISSION_LABELS.REAGENTS_VIEW,
          description: PERMISSION_DESCRIPTIONS.REAGENTS_VIEW,
          module: 'REAGENTS',
          action: 'VIEW',
          impliedPermissions: ['DASHBOARD_VIEW'],
        },
        {
          name: 'REAGENTS_WRITE',
          label: PERMISSION_LABELS.REAGENTS_WRITE,
          description: PERMISSION_DESCRIPTIONS.REAGENTS_WRITE,
          module: 'REAGENTS',
          action: 'WRITE',
          impliedPermissions: ['REAGENTS_VIEW', 'DASHBOARD_VIEW'],
        },
        {
          name: 'REAGENTS_DELETE',
          label: PERMISSION_LABELS.REAGENTS_DELETE,
          description: PERMISSION_DESCRIPTIONS.REAGENTS_DELETE,
          module: 'REAGENTS',
          action: 'DELETE',
          impliedPermissions: ['REAGENTS_VIEW', 'DASHBOARD_VIEW'],
        },
      ],
    },
    {
      moduleId: 'MAINTENANCE',
      moduleName: 'Manutenção de Equipamentos',
      description: 'Registros de manutenções preventivas, corretivas e calibrações',
      permissions: [
        {
          name: 'MAINTENANCE_VIEW',
          label: PERMISSION_LABELS.MAINTENANCE_VIEW,
          description: PERMISSION_DESCRIPTIONS.MAINTENANCE_VIEW,
          module: 'MAINTENANCE',
          action: 'VIEW',
          impliedPermissions: ['DASHBOARD_VIEW'],
        },
        {
          name: 'MAINTENANCE_WRITE',
          label: PERMISSION_LABELS.MAINTENANCE_WRITE,
          description: PERMISSION_DESCRIPTIONS.MAINTENANCE_WRITE,
          module: 'MAINTENANCE',
          action: 'WRITE',
          impliedPermissions: ['MAINTENANCE_VIEW', 'DASHBOARD_VIEW'],
        },
      ],
    },
    {
      moduleId: 'TEMPERATURE',
      moduleName: 'Controle de Temperatura',
      description: 'Monitoramento diário de termômetros, refrigeradores e ambientes laboratoriais',
      permissions: [
        {
          name: 'TEMPERATURE_VIEW',
          label: PERMISSION_LABELS.TEMPERATURE_VIEW,
          description: PERMISSION_DESCRIPTIONS.TEMPERATURE_VIEW,
          module: 'TEMPERATURE',
          action: 'VIEW',
          impliedPermissions: ['DASHBOARD_VIEW'],
        },
        {
          name: 'TEMPERATURE_WRITE',
          label: PERMISSION_LABELS.TEMPERATURE_WRITE,
          description: PERMISSION_DESCRIPTIONS.TEMPERATURE_WRITE,
          module: 'TEMPERATURE',
          action: 'WRITE',
          impliedPermissions: ['TEMPERATURE_VIEW', 'DASHBOARD_VIEW'],
        },
      ],
    },
    {
      moduleId: 'REPORTS',
      moduleName: 'Central de Relatórios',
      description: 'Geração e download de relatórios operacionais, analíticos e regulatórios',
      permissions: [
        {
          name: 'REPORTS_VIEW',
          label: PERMISSION_LABELS.REPORTS_VIEW,
          description: PERMISSION_DESCRIPTIONS.REPORTS_VIEW,
          module: 'REPORTS',
          action: 'VIEW',
          impliedPermissions: ['DASHBOARD_VIEW'],
        },
        {
          name: 'REPORTS_GENERATE',
          label: PERMISSION_LABELS.REPORTS_GENERATE,
          description: PERMISSION_DESCRIPTIONS.REPORTS_GENERATE,
          module: 'REPORTS',
          action: 'GENERATE',
          impliedPermissions: ['REPORTS_VIEW', 'DASHBOARD_VIEW'],
        },
        {
          name: 'REPORTS_DOWNLOAD',
          label: PERMISSION_LABELS.REPORTS_DOWNLOAD,
          description: PERMISSION_DESCRIPTIONS.REPORTS_DOWNLOAD,
          module: 'REPORTS',
          action: 'DOWNLOAD',
          impliedPermissions: ['REPORTS_VIEW', 'DASHBOARD_VIEW'],
        },
      ],
    },
  ],
  allPermissions: [],
}
LOCAL_PERMISSION_CATALOG.allPermissions = LOCAL_PERMISSION_CATALOG.modules.flatMap(m => m.permissions)

/**
 * Retorna as permissões efetivas do usuário com base no papel e conjunto atribuído.
 */
export function getEffectivePermissions(user: User | null): Set<Permission> {
  if (!user || !user.isActive) {
    return new Set()
  }

  if (user.role === 'ADMIN') {
    return new Set(CANONICAL_PERMISSIONS)
  }

  if (user.role === 'VIGILANCIA_SANITARIA') {
    return new Set([
      'DASHBOARD_VIEW',
      'QC_VIEW',
      'REAGENTS_VIEW',
      'MAINTENANCE_VIEW',
      'TEMPERATURE_VIEW',
      'REPORTS_VIEW',
      'REPORTS_DOWNLOAD',
    ])
  }

  if (user.role === 'VISUALIZADOR') {
    return new Set([
      'DASHBOARD_VIEW',
      'QC_VIEW',
      'REAGENTS_VIEW',
      'MAINTENANCE_VIEW',
      'TEMPERATURE_VIEW',
      'REPORTS_VIEW',
    ])
  }

  return expandImpliedPermissions(user.permissions || [])
}

/**
 * Verifica se o usuário possui uma permissão específica.
 */
export function hasPermission(user: User | null, permission: Permission | string): boolean {
  if (!user) return false
  const canonical = normalizePermission(permission)
  if (!canonical) return false
  const effective = getEffectivePermissions(user)
  return effective.has(canonical)
}

/**
 * Verifica se o usuário tem acesso de visualização a um módulo específico.
 */
export function canViewModule(
  user: User | null,
  module: 'DASHBOARD' | 'QC' | 'REAGENTS' | 'MAINTENANCE' | 'TEMPERATURE' | 'REPORTS'
): boolean {
  if (!user) return false
  switch (module) {
    case 'DASHBOARD':
      return hasPermission(user, 'DASHBOARD_VIEW')
    case 'QC':
      return hasPermission(user, 'QC_VIEW')
    case 'REAGENTS':
      return hasPermission(user, 'REAGENTS_VIEW')
    case 'MAINTENANCE':
      return hasPermission(user, 'MAINTENANCE_VIEW')
    case 'TEMPERATURE':
      return hasPermission(user, 'TEMPERATURE_VIEW')
    case 'REPORTS':
      return hasPermission(user, 'REPORTS_VIEW')
    default:
      return false
  }
}

// Helpers de Domínio Laboratorial

export function canWriteQc(user: User | null): boolean {
  return hasPermission(user, 'QC_WRITE')
}

export function canWriteQcAreas(user: User | null): boolean {
  return hasPermission(user, 'QC_AREAS_WRITE') || hasPermission(user, 'QC_WRITE')
}

export function canImportQc(user: User | null): boolean {
  return hasPermission(user, 'QC_IMPORT')
}

export function canExportQc(user: User | null): boolean {
  return hasPermission(user, 'QC_EXPORT') || hasPermission(user, 'REPORTS_DOWNLOAD')
}

export function canWriteReagents(user: User | null): boolean {
  return hasPermission(user, 'REAGENTS_WRITE')
}

export function canDeleteReagents(user: User | null): boolean {
  return hasPermission(user, 'REAGENTS_DELETE')
}

export function canWriteMaintenance(user: User | null): boolean {
  return hasPermission(user, 'MAINTENANCE_WRITE')
}

export function canWriteTemperature(user: User | null): boolean {
  return hasPermission(user, 'TEMPERATURE_WRITE')
}

export function canViewReports(user: User | null): boolean {
  return hasPermission(user, 'REPORTS_VIEW')
}

export function canGenerateReports(user: User | null): boolean {
  return hasPermission(user, 'REPORTS_GENERATE')
}

export function canDownloadReports(user: User | null): boolean {
  return hasPermission(user, 'REPORTS_DOWNLOAD')
}

// Retrocompatibilidade
export function canDownload(user: User | null): boolean {
  return canDownloadReports(user)
}

export function canWriteReagent(user: User | null): boolean {
  return canWriteReagents(user)
}

export function canImport(user: User | null): boolean {
  return canImportQc(user)
}

export function isReadOnly(user: User | null): boolean {
  if (!user) return true
  return user.role === 'VISUALIZADOR' || user.role === 'VIGILANCIA_SANITARIA'
}

export const ALL_PERMISSIONS = CANONICAL_PERMISSIONS

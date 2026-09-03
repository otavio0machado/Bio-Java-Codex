import {
  Eye,
  KeyRound,
  Pencil,
  Shield,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { Button } from '../ui'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../../lib/permissions'
import type { Role, User } from '../../types'

export const ROLE_COLORS: Record<Role, string> = {
  ADMIN: 'bg-violet-50 text-violet-800 border-violet-200',
  FUNCIONARIO: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  VIGILANCIA_SANITARIA: 'bg-amber-50 text-amber-800 border-amber-200',
  VISUALIZADOR: 'bg-neutral-100 text-neutral-700 border-neutral-200',
}

export const ROLE_ICONS: Record<Role, typeof Shield> = {
  ADMIN: ShieldCheck,
  FUNCIONARIO: UserCheck,
  VIGILANCIA_SANITARIA: Shield,
  VISUALIZADOR: Eye,
}

interface UserTableProps {
  users: User[]
  onEdit: (user: User) => void
  onResetPassword: (user: User) => void
  onToggleActive?: (user: User) => void
  currentUserId?: string
}

export function getUserActiveModules(user: User): string[] {
  if (user.role === 'ADMIN') return ['Acesso Total']
  if (user.role === 'VIGILANCIA_SANITARIA') return ['Auditoria Regulatória']
  if (user.role === 'VISUALIZADOR') return ['Somente Leitura']

  const perms = new Set(user.permissions || [])
  const modules: string[] = []

  const hasTemp = perms.has('TEMPERATURE_VIEW') || perms.has('TEMPERATURE_WRITE')
  const hasReagents = perms.has('REAGENTS_VIEW') || perms.has('REAGENTS_WRITE') || perms.has('REAGENTS_DELETE')
  const hasQc = perms.has('QC_VIEW') || perms.has('QC_WRITE') || perms.has('QC_AREAS_WRITE') || perms.has('QC_IMPORT') || perms.has('QC_EXPORT')
  const hasMaint = perms.has('MAINTENANCE_VIEW') || perms.has('MAINTENANCE_WRITE')
  const hasReports = perms.has('REPORTS_VIEW') || perms.has('REPORTS_GENERATE') || perms.has('REPORTS_DOWNLOAD')

  if (hasTemp && hasReagents && hasQc && hasMaint && hasReports) {
    return ['Todos os Módulos']
  }

  if (hasTemp) modules.push('Temperatura')
  if (hasReagents) modules.push('Reagentes')
  if (hasQc) modules.push('CQ (PROIN)')
  if (hasMaint) modules.push('Manutenção')
  if (hasReports) modules.push('Relatórios')

  return modules
}

export function UserTable({
  users,
  onEdit,
  onResetPassword,
  onToggleActive,
  currentUserId,
}: UserTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50/80 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 sm:pl-6">
                Usuário
              </th>
              <th scope="col" className="px-3 py-3.5">
                Perfil de Acesso
              </th>
              <th scope="col" className="px-3 py-3.5">
                Módulos Autorizados
              </th>
              <th scope="col" className="px-3 py-3.5">
                Status
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {users.map((user) => {
              const RoleIcon = ROLE_ICONS[user.role] ?? Shield
              const initials = (user.name || 'U')
                .split(' ')
                .filter(Boolean)
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'U'

              const activeModules = getUserActiveModules(user)
              const isSelf = currentUserId === user.id

              return (
                <tr key={user.id} className="transition hover:bg-neutral-50/70">
                  {/* Usuário */}
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                          user.isActive
                            ? 'bg-emerald-800 text-white shadow-xs'
                            : 'bg-neutral-200 text-neutral-500'
                        }`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900 truncate">
                            {user.name}
                          </span>
                          {isSelf && (
                            <span className="rounded-full bg-neutral-100 px-1.5 py-0.2 text-[10px] font-medium text-neutral-600">
                              Você
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500">@{user.username}</div>
                        {user.email && (
                          <div className="text-xs text-neutral-400 truncate max-w-xs">
                            {user.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Perfil */}
                  <td className="whitespace-nowrap px-3 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        ROLE_COLORS[user.role] ?? 'bg-neutral-100 text-neutral-600 border-neutral-200'
                      }`}
                      title={ROLE_DESCRIPTIONS[user.role]}
                    >
                      <RoleIcon className="h-3.5 w-3.5" />
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </td>

                  {/* Módulos Autorizados */}
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap gap-1 max-w-md">
                      {user.role === 'ADMIN' ? (
                        <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-800 border border-violet-200">
                          Acesso Total ao Sistema
                        </span>
                      ) : activeModules.length === 0 ? (
                        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
                          Nenhum Módulo (Bloqueado)
                        </span>
                      ) : (
                        activeModules.map((mod) => (
                          <span
                            key={mod}
                            className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 border border-emerald-200"
                          >
                            {mod}
                          </span>
                        ))
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="whitespace-nowrap px-3 py-4">
                    {onToggleActive && !isSelf ? (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={user.isActive}
                        onClick={() => onToggleActive(user)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                          user.isActive
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                        }`}
                        title={user.isActive ? 'Clique para desativar' : 'Clique para ativar'}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            user.isActive ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                        />
                        {user.isActive ? 'Ativo' : 'Inativo'}
                      </button>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          user.isActive
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            user.isActive ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                        />
                        {user.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    )}
                  </td>

                  {/* Ações */}
                  <td className="whitespace-nowrap py-4 pl-3 pr-4 sm:pr-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onEdit(user)}
                        title="Editar perfil e permissões"
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5 text-neutral-600" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onResetPassword(user)}
                        title="Redefinir senha de acesso"
                      >
                        <KeyRound className="mr-1 h-3.5 w-3.5 text-neutral-600" />
                        Senha
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { KeyRound, Pencil, Shield } from 'lucide-react'
import { Button, Card } from '../ui'
import { ROLE_COLORS, ROLE_ICONS, getUserActiveModules } from './UserTable'
import { ROLE_LABELS } from '../../lib/permissions'
import type { User } from '../../types'

interface UserCardsGridProps {
  users: User[]
  onEdit: (user: User) => void
  onResetPassword: (user: User) => void
  currentUserId?: string
}

export function UserCardsGrid({
  users,
  onEdit,
  onResetPassword,
  currentUserId,
}: UserCardsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <Card
            key={user.id}
            className="flex flex-col justify-between space-y-4 transition hover:shadow-elevated border border-neutral-200"
          >
            <div className="space-y-3">
              {/* Header do Card */}
              <div className="flex items-start gap-3.5">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold shadow-xs ${
                    user.isActive
                      ? 'bg-emerald-800 text-white'
                      : 'bg-neutral-200 text-neutral-500'
                  }`}
                >
                  {initials}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-neutral-900">
                      {user.name}
                    </h3>
                    {isSelf && (
                      <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.2 text-[10px] font-medium text-neutral-600">
                        Você
                      </span>
                    )}
                    {!user.isActive && (
                      <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 border border-red-200">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500">@{user.username}</p>
                  {user.email && (
                    <p className="truncate text-xs text-neutral-400 mt-0.5">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Role Badge */}
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    ROLE_COLORS[user.role] ?? 'bg-neutral-100 text-neutral-600 border-neutral-200'
                  }`}
                >
                  <RoleIcon className="h-3.5 w-3.5" />
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              </div>

              {/* Módulos Liberados */}
              <div className="space-y-1.5 pt-1 border-t border-neutral-100">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Módulos Autorizados
                </div>
                <div className="flex flex-wrap gap-1">
                  {user.role === 'ADMIN' ? (
                    <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-800 border border-violet-200">
                      Acesso Total ao Sistema
                    </span>
                  ) : activeModules.length === 0 ? (
                    <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
                      Nenhum Módulo (Acesso Bloqueado)
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
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-2 border-t border-neutral-100 pt-3">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => onEdit(user)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5 text-neutral-600" />
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => onResetPassword(user)}
              >
                <KeyRound className="mr-1.5 h-3.5 w-3.5 text-neutral-600" />
                Senha
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

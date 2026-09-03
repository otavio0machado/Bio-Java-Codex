import {
  Activity,
  Calendar,
  Clock,
  KeyRound,
  LogOut,
  Mail,
  Pencil,
  Shield,
  Trash2,
} from 'lucide-react'
import { Button, Modal } from '../ui'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../../lib/permissions'
import { ROLE_COLORS, ROLE_ICONS, getUserActiveModules } from './UserTable'
import { formatDateTime } from './adminHelpers'
import type { User } from '../../types'

interface UserDetailsModalProps {
  user: User
  onClose: () => void
  onEdit: (user: User) => void
  onResetPassword: (user: User) => void
  onViewAudit: (user: User) => void
  onRevokeSessions: (user: User) => void
  onDelete: (user: User) => void
  currentUserId?: string
}

export function UserDetailsModal({
  user,
  onClose,
  onEdit,
  onResetPassword,
  onViewAudit,
  onRevokeSessions,
  onDelete,
  currentUserId,
}: UserDetailsModalProps) {
  const isSelf = currentUserId === user.id
  const RoleIcon = ROLE_ICONS[user.role] ?? Shield
  const activeModules = getUserActiveModules(user)

  const initials = (user.name || 'U')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U'

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Ficha Cadastral do Usuário"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          {!isSelf && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                onClose()
                onDelete(user)
              }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Excluir Usuário
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                onClose()
                onResetPassword(user)
              }}
            >
              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
              Senha
            </Button>
            <Button
              onClick={() => {
                onClose()
                onEdit(user)
              }}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Editar
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Header com Avatar e Identificação */}
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-neutral-50 p-4 border border-neutral-200/80">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-800 text-base font-bold text-white shadow-xs">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-neutral-900 text-base truncate">{user.name}</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                    user.isActive
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                  }`}
                >
                  {user.isActive ? 'Conta Ativa' : 'Conta Inativa'}
                </span>
              </div>
              <div className="text-xs text-neutral-500">@{user.username}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose()
                onViewAudit(user)
              }}
              title="Visualizar trilha de auditoria deste usuário"
            >
              <Activity className="mr-1 h-3.5 w-3.5 text-violet-600" />
              Auditoria
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onRevokeSessions(user)}
              title="Desconectar todas as sessões ativas do usuário"
            >
              <LogOut className="mr-1 h-3.5 w-3.5 text-amber-600" />
              Desconectar
            </Button>
          </div>
        </div>

        {/* Informações Cadastrais */}
        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <div className="rounded-xl border border-neutral-200 p-3 bg-white space-y-1">
            <div className="flex items-center gap-1.5 text-neutral-500 font-medium">
              <Shield className="h-3.5 w-3.5 text-neutral-400" />
              Perfil de Acesso (Role)
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                  ROLE_COLORS[user.role]
                }`}
              >
                <RoleIcon className="h-3 w-3" />
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">{ROLE_DESCRIPTIONS[user.role]}</p>
          </div>

          <div className="rounded-xl border border-neutral-200 p-3 bg-white space-y-1">
            <div className="flex items-center gap-1.5 text-neutral-500 font-medium">
              <Mail className="h-3.5 w-3.5 text-neutral-400" />
              Email Institucional
            </div>
            <div className="text-sm font-semibold text-neutral-800 pt-0.5">
              {user.email || 'Não informado'}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 p-3 bg-white space-y-1">
            <div className="flex items-center gap-1.5 text-neutral-500 font-medium">
              <Clock className="h-3.5 w-3.5 text-neutral-400" />
              Último Acesso ao Sistema
            </div>
            <div className="text-sm font-semibold text-neutral-800 pt-0.5">
              {formatDateTime(user.lastLoginAt)}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 p-3 bg-white space-y-1">
            <div className="flex items-center gap-1.5 text-neutral-500 font-medium">
              <Calendar className="h-3.5 w-3.5 text-neutral-400" />
              Data de Cadastro
            </div>
            <div className="text-sm font-semibold text-neutral-800 pt-0.5">
              {formatDateTime(user.createdAt)}
            </div>
          </div>
        </div>

        {/* Módulos e Permissões Efetivas */}
        <div className="rounded-2xl border border-neutral-200 p-4 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
              Módulos Laboratoriais Autorizados
            </h4>
            <span className="text-[11px] text-neutral-500">
              {user.permissions?.length ?? 0} permissões ativas
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {activeModules.map((modName) => (
              <span
                key={modName}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200/80"
              >
                {modName}
              </span>
            ))}
          </div>

          {user.permissions && user.permissions.length > 0 && (
            <div className="pt-2 border-t border-neutral-100">
              <div className="text-[11px] font-semibold text-neutral-600 mb-1.5">
                Permissões Granulares Efetivas:
              </div>
              <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto pr-1">
                {user.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600 border border-neutral-200/70"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

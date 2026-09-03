import { useMemo, useState } from 'react'
import { Shield, ShieldAlert, X } from 'lucide-react'
import { Button, Input, Modal, useToast } from '../ui'
import { usePermissionsCatalog, useUpdateUser } from '../../hooks/useAdmin'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../../lib/permissions'
import { ModulePermissionSelector } from './ModulePermissionSelector'
import { ROLE_ICONS } from './UserTable'
import { extractErrorMessage, normalizeModuleCatalog } from './adminHelpers'
import type { Role, User } from '../../types'

const ROLES: Role[] = ['ADMIN', 'FUNCIONARIO', 'VIGILANCIA_SANITARIA', 'VISUALIZADOR']

interface EditUserModalProps {
  user: User
  onClose: () => void
  currentUserId?: string
}

export function EditUserModal({ user, onClose, currentUserId }: EditUserModalProps) {
  const { toast } = useToast()
  const updateUser = useUpdateUser()
  const { data: catalogData } = usePermissionsCatalog()
  const catalog = useMemo(() => normalizeModuleCatalog(catalogData?.modules), [catalogData])

  const [name, setName] = useState(user.name)
  const [role, setRole] = useState<Role>(user.role)
  const [email, setEmail] = useState(user.email ?? '')
  const [isActive, setIsActive] = useState(user.isActive)
  const [permissions, setPermissions] = useState<string[]>(user.permissions ?? [])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isSelf = currentUserId === user.id

  const handleSubmit = async () => {
    if (updateUser.isPending) return
    setErrorMessage(null)

    if (!name.trim()) {
      setErrorMessage('O nome completo não pode ser vazio.')
      return
    }

    try {
      await updateUser.mutateAsync({
        id: user.id,
        request: {
          name: name.trim(),
          role,
          isActive,
          email: email.trim() || undefined,
          permissions: role === 'FUNCIONARIO' ? permissions : undefined,
        },
      })
      toast.success('Usuário atualizado com sucesso!')
      onClose()
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Erro ao atualizar dados do usuário.')
      setErrorMessage(msg)
      toast.error(msg)
    }
  }

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
      title={`Editar Usuário — ${user.name}`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} loading={updateUser.isPending}>
            Salvar Alterações
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Banner de Erro da API */}
        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <ShieldAlert className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">
              <strong className="block font-semibold">Falha ao salvar</strong>
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {/* Card de Identificação */}
        <div className="flex items-center gap-3.5 rounded-2xl bg-neutral-50 p-3.5 border border-neutral-200/80">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-800 text-sm font-bold text-white shadow-xs">
            {initials}
          </div>
          <div>
            <div className="font-bold text-neutral-900">{user.name}</div>
            <div className="text-xs text-neutral-500">Login oficial: @{user.username}</div>
          </div>
        </div>

        {/* Informações Básicas */}
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Nome Completo *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Email Institucional"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@biodiagnostico.com.br"
          />
        </div>

        {/* Seleção de Perfil */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-neutral-900">
            Perfil de Acesso
          </label>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {ROLES.map((r) => {
              const Icon = ROLE_ICONS[r] ?? Shield
              const selected = role === r
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex items-start gap-3 rounded-2xl border-2 p-3 text-left transition ${
                    selected
                      ? 'border-emerald-800 bg-emerald-50/70 shadow-xs'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  <div
                    className={`mt-0.5 rounded-xl p-2 ${
                      selected ? 'bg-emerald-800 text-white' : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div
                      className={`text-sm font-bold ${
                        selected ? 'text-emerald-950' : 'text-neutral-800'
                      }`}
                    >
                      {ROLE_LABELS[r]}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {ROLE_DESCRIPTIONS[r]}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Seletor de Permissões ou Resumo */}
        {role === 'FUNCIONARIO' ? (
          <ModulePermissionSelector
            selectedPermissions={permissions}
            onChange={setPermissions}
            catalog={catalog}
          />
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600">
            <p className="font-semibold text-neutral-800 mb-1">Permissões Automáticas</p>
            <p>
              O perfil <strong>{ROLE_LABELS[role]}</strong> opera com a política padronizada do
              sistema, sem exigência de configuração manual.
            </p>
          </div>
        )}

        {/* Switch Ativo/Inativo */}
        <div className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3.5 bg-white">
          <div>
            <div className="text-sm font-bold text-neutral-900">Status da Conta</div>
            <div className="text-xs text-neutral-500">
              {isActive
                ? 'Usuário ativo (pode efetuar login no laboratório)'
                : 'Usuário bloqueado (sessões ativas canceladas imediatamente)'}
            </div>
            {isSelf && (
              <div className="text-xs text-amber-600 font-medium mt-1">
                Você não pode desativar sua própria conta de administrador.
              </div>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            disabled={isSelf}
            onClick={() => !isSelf && setIsActive(!isActive)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors ${
              isSelf ? 'opacity-50 cursor-not-allowed' : ''
            } ${isActive ? 'bg-emerald-700' : 'bg-neutral-300'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 translate-y-1 rounded-full bg-white shadow-sm transition-transform ${
                isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </Modal>
  )
}

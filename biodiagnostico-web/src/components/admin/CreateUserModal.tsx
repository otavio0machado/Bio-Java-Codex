import { useMemo, useState } from 'react'
import {
  Eye,
  EyeOff,
  Shield,
  ShieldAlert,
  UserPlus,
  X,
} from 'lucide-react'
import { Button, Input, Modal, useToast } from '../ui'
import { useCreateUser, usePermissionsCatalog } from '../../hooks/useAdmin'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../../lib/permissions'
import { ModulePermissionSelector } from './ModulePermissionSelector'
import { ROLE_ICONS } from './UserTable'
import { extractErrorMessage, normalizeModuleCatalog } from './adminHelpers'
import type { Role } from '../../types'

const ROLES: Role[] = ['ADMIN', 'FUNCIONARIO', 'VIGILANCIA_SANITARIA', 'VISUALIZADOR']

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateUserModal({ isOpen, onClose }: CreateUserModalProps) {
  const { toast } = useToast()
  const createUser = useCreateUser()
  const { data: catalogData } = usePermissionsCatalog()
  const catalog = useMemo(() => normalizeModuleCatalog(catalogData?.modules), [catalogData])

  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('FUNCIONARIO')
  const [email, setEmail] = useState('')
  const [permissions, setPermissions] = useState<string[]>([])
  const [showPw, setShowPw] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const resetForm = () => {
    setUsername('')
    setName('')
    setPassword('')
    setRole('FUNCIONARIO')
    setEmail('')
    setPermissions([])
    setShowPw(false)
    setErrorMessage(null)
  }

  const handleSubmit = async () => {
    if (createUser.isPending) return
    setErrorMessage(null)

    if (!username.trim() || !name.trim() || !password) {
      setErrorMessage('Preencha os campos obrigatórios: login, nome completo e senha.')
      toast.warning('Preencha os campos obrigatórios.')
      return
    }

    if (password.length < 4) {
      setErrorMessage('A senha inicial deve ter no mínimo 4 caracteres.')
      toast.warning('A senha deve ter pelo menos 4 caracteres.')
      return
    }

    try {
      await createUser.mutateAsync({
        username: username.trim().toLowerCase(),
        name: name.trim(),
        password,
        role,
        email: email.trim() || undefined,
        permissions: role === 'FUNCIONARIO' ? permissions : undefined,
      })
      toast.success(`Usuário "${name.trim()}" criado com sucesso!`)
      resetForm()
      onClose()
    } catch (err: unknown) {
      const msg = extractErrorMessage(
        err,
        'Erro ao criar usuário. Verifique se o login já existe ou atende aos requisitos.'
      )
      setErrorMessage(msg)
      toast.error(msg)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetForm()
        onClose()
      }}
      title="Cadastrar Novo Usuário"
      footer={
        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              resetForm()
              onClose()
            }}
          >
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} loading={createUser.isPending}>
            <UserPlus className="mr-2 h-4 w-4" />
            Cadastrar Usuário
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
              <strong className="block font-semibold">Não foi possível criar o usuário</strong>
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

        {/* Informações Básicas */}
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Login de Acesso *"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ex: ana.souza"
          />
          <Input
            label="Nome Completo *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Ana Souza"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative">
            <Input
              label="Senha Inicial *"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 4 caracteres"
            />
            <button
              type="button"
              className="absolute right-3 top-[2.65rem] rounded-full p-1 text-neutral-400 transition hover:text-neutral-700"
              onClick={() => setShowPw(!showPw)}
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Input
            label="Email Institucional (opcional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ana.souza@biodiagnostico.com.br"
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

        {/* Seletor de Permissões (para Funcionário) ou Aviso de Perfil Automático */}
        {role === 'FUNCIONARIO' ? (
          <ModulePermissionSelector
            selectedPermissions={permissions}
            onChange={setPermissions}
            catalog={catalog}
          />
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600">
            <p className="font-semibold text-neutral-800 mb-1">
              Permissões Gerenciadas Automaticamente
            </p>
            <p>
              O perfil <strong>{ROLE_LABELS[role]}</strong> possui política de permissões predefinida
              pelo laboratório, não necessitando de seleção manual de módulos.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}

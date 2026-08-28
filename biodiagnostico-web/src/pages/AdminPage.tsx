import axios from 'axios'
import {
  Activity,
  Beaker,
  Check,
  CheckCheck,
  Clock,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  KeyRound,
  LayoutDashboard,
  Pencil,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Thermometer,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { AiAssistResult } from '../components/proin/AiAssistShared'
import { Button, Card, EmptyState, Input, Modal, Select, StatCard, useToast } from '../components/ui'
import { useAuditLogs, useCreateUser, usePermissionsCatalog, useResetPassword, useUpdateUser, useUsers } from '../hooks/useAdmin'
import { useAuditSummary } from '../hooks/useAiAssist'
import {
  LOCAL_PERMISSION_CATALOG,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  getEffectivePermissions,
} from '../lib/permissions'
import type { ModuleGroup, Role, User } from '../types'

const ROLES: Role[] = ['ADMIN', 'FUNCIONARIO', 'VIGILANCIA_SANITARIA', 'VISUALIZADOR']

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: 'bg-violet-100 text-violet-800',
  FUNCIONARIO: 'bg-sky-100 text-sky-800',
  VIGILANCIA_SANITARIA: 'bg-amber-100 text-amber-800',
  VISUALIZADOR: 'bg-neutral-100 text-neutral-600',
}

const ROLE_ICONS: Record<Role, typeof Shield> = {
  ADMIN: ShieldCheck,
  FUNCIONARIO: UserCheck,
  VIGILANCIA_SANITARIA: Shield,
  VISUALIZADOR: Eye,
}

const MODULE_ICONS: Record<string, typeof Shield> = {
  DASHBOARD: LayoutDashboard,
  QC: Beaker,
  REAGENTS: FlaskConical,
  MAINTENANCE: Wrench,
  TEMPERATURE: Thermometer,
  REPORTS: FileText,
}

function extractErrorMessage(err: unknown, fallback: string): string {
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

export function AdminPage() {
  const { data: users = [], isLoading } = useUsers()
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [resetUser, setResetUser] = useState<User | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState<string>('')

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !searchQuery ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesRole = !filterRole || u.role === filterRole
      return matchesSearch && matchesRole
    })
  }, [users, searchQuery, filterRole])

  const stats = useMemo(() => {
    const active = users.filter((u) => u.isActive).length
    const inactive = users.filter((u) => !u.isActive).length
    const admins = users.filter((u) => u.role === 'ADMIN').length
    const funcionarios = users.filter((u) => u.role === 'FUNCIONARIO').length
    return { total: users.length, active, inactive, admins, funcionarios }
  }, [users])

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Gestão de Usuários & Acessos</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Administre contas, perfis e permissões granulares por módulo com controle total de RBAC
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="lg">
          <UserPlus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de Usuários" value={stats.total} icon={<Users className="h-5 w-5" />} iconColor="bg-green-800" />
        <StatCard label="Usuários Ativos" value={stats.active} icon={<UserCheck className="h-5 w-5" />} iconColor="bg-emerald-600" />
        <StatCard label="Administradores" value={stats.admins} icon={<ShieldCheck className="h-5 w-5" />} iconColor="bg-violet-600" />
        <StatCard label="Funcionários" value={stats.funcionarios} icon={<UserCheck className="h-5 w-5" />} iconColor="bg-sky-600" />
      </div>

      {/* Search and Filter */}
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="Buscar usuário"
            placeholder="Filtrar por nome, login ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="w-full sm:w-64">
          <Select
            label="Filtrar por perfil"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="">Todos os perfis</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </Select>
        </div>
      </Card>

      {/* User Cards Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-3xl bg-neutral-100" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title={searchQuery || filterRole ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
          description={
            searchQuery || filterRole
              ? 'Tente ajustar os filtros de busca.'
              : 'Clique em "Novo Usuário" para cadastrar o primeiro acesso.'
          }
          action={
            !searchQuery && !filterRole
              ? { label: 'Novo Usuário', onClick: () => setCreateOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              onEdit={() => setEditUser(u)}
              onResetPassword={() => setResetUser(u)}
            />
          ))}
        </div>
      )}

      {/* Activity Log */}
      <ActivityLogSection users={users} />

      <CreateUserModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      {editUser ? <EditUserModal user={editUser} onClose={() => setEditUser(null)} /> : null}
      {resetUser ? <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} /> : null}
    </div>
  )
}

/* ─── User Card ─── */

function UserCard({
  user,
  onEdit,
  onResetPassword,
}: {
  user: User
  onEdit: () => void
  onResetPassword: () => void
}) {
  const RoleIcon = ROLE_ICONS[user.role] ?? Shield
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const effectivePerms = useMemo(() => Array.from(getEffectivePermissions(user)), [user])

  return (
    <Card className="flex flex-col justify-between space-y-4 transition hover:shadow-elevated">
      <div className="space-y-3">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              user.isActive ? 'bg-green-800 text-white' : 'bg-neutral-300 text-neutral-600'
            }`}
          >
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-neutral-900">{user.name}</h3>
              {!user.isActive && (
                <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 border border-red-200">
                  Inativo
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500">@{user.username}</p>
            {user.email ? <p className="truncate text-xs text-neutral-400">{user.email}</p> : null}
          </div>
        </div>

        {/* Role Badge */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${ROLE_COLORS[user.role] ?? 'bg-neutral-100 text-neutral-600'}`}>
            <RoleIcon className="h-3.5 w-3.5" />
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </div>

        {/* Permissions Display */}
        {user.role === 'FUNCIONARIO' ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-neutral-400">
              <span>Permissões Efetivas ({effectivePerms.length})</span>
            </div>
            {effectivePerms.length > 0 ? (
              <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto pr-1">
                {effectivePerms.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-800 border border-green-200/60"
                  >
                    <Check className="h-3 w-3 text-green-600" />
                    {PERMISSION_LABELS[p] ?? p}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 border border-amber-200">
                Nenhuma permissão atribuída (acesso bloqueado aos módulos).
              </p>
            )}
          </div>
        ) : user.role === 'ADMIN' ? (
          <div className="rounded-xl bg-violet-50 p-2.5 text-xs text-violet-800 border border-violet-200/70">
            <strong>Acesso Total:</strong> Todas as permissões e telas operacionais e administrativas liberadas.
          </div>
        ) : user.role === 'VIGILANCIA_SANITARIA' ? (
          <div className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200/70">
            <strong>Auditoria Regulatória:</strong> Visualização de todos os módulos e download de relatórios.
          </div>
        ) : (
          <div className="rounded-xl bg-neutral-100 p-2.5 text-xs text-neutral-700 border border-neutral-200">
            <strong>Visualizador:</strong> Leitura em todos os módulos sem permissão de escrita ou exportação.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-neutral-100 pt-3">
        <Button variant="secondary" size="sm" className="flex-1" onClick={onEdit}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Editar
        </Button>
        <Button variant="ghost" size="sm" className="flex-1" onClick={onResetPassword}>
          <KeyRound className="mr-1.5 h-3.5 w-3.5" />
          Senha
        </Button>
      </div>
    </Card>
  )
}

/* ─── Permission Matrix Selector ─── */

interface PermissionSelectorProps {
  selectedPermissions: string[]
  onChange: (perms: string[]) => void
  catalog: ModuleGroup[]
}

function PermissionSelector({ selectedPermissions, onChange, catalog }: PermissionSelectorProps) {
  const currentSet = useMemo(() => new Set(selectedPermissions), [selectedPermissions])

  const togglePermission = (name: string) => {
    const next = new Set(currentSet)
    if (next.has(name)) {
      next.delete(name)
    } else {
      next.add(name)
      // Auto-imply view permissions when adding write/action
      if (name.startsWith('QC_') && name !== 'QC_VIEW') next.add('QC_VIEW')
      if (name.startsWith('REAGENTS_') && name !== 'REAGENTS_VIEW') next.add('REAGENTS_VIEW')
      if (name.startsWith('MAINTENANCE_') && name !== 'MAINTENANCE_VIEW') next.add('MAINTENANCE_VIEW')
      if (name.startsWith('TEMPERATURE_') && name !== 'TEMPERATURE_VIEW') next.add('TEMPERATURE_VIEW')
      if (name.startsWith('REPORTS_') && name !== 'REPORTS_VIEW') next.add('REPORTS_VIEW')
      next.add('DASHBOARD_VIEW')
    }
    onChange(Array.from(next))
  }

  const toggleModule = (module: ModuleGroup) => {
    const modulePermNames = module.permissions.map((p) => p.name)
    const allSelected = modulePermNames.every((p) => currentSet.has(p))
    const next = new Set(currentSet)

    if (allSelected) {
      modulePermNames.forEach((p) => next.delete(p))
    } else {
      modulePermNames.forEach((p) => next.add(p))
      next.add('DASHBOARD_VIEW')
    }
    onChange(Array.from(next))
  }

  const selectAll = () => {
    const all = catalog.flatMap((m) => m.permissions.map((p) => p.name))
    onChange(all)
  }

  const clearAll = () => {
    onChange([])
  }

  const applyPresetQc = () => {
    const next = new Set<string>(['DASHBOARD_VIEW', 'QC_VIEW', 'QC_WRITE', 'QC_AREAS_WRITE', 'REPORTS_VIEW', 'REPORTS_DOWNLOAD'])
    onChange(Array.from(next))
  }

  const applyPresetFullOperations = () => {
    const next = new Set<string>([
      'DASHBOARD_VIEW',
      'QC_VIEW',
      'QC_WRITE',
      'QC_AREAS_WRITE',
      'QC_IMPORT',
      'QC_EXPORT',
      'REAGENTS_VIEW',
      'REAGENTS_WRITE',
      'MAINTENANCE_VIEW',
      'MAINTENANCE_WRITE',
      'TEMPERATURE_VIEW',
      'TEMPERATURE_WRITE',
      'REPORTS_VIEW',
      'REPORTS_GENERATE',
      'REPORTS_DOWNLOAD',
    ])
    onChange(Array.from(next))
  }

  return (
    <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-sky-950">Matriz de Permissões Granulares</h4>
          <p className="text-xs text-sky-800">
            Selecione as permissões específicas que este funcionário terá acesso
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs text-sky-800 hover:bg-sky-100" onClick={selectAll}>
            <CheckCheck className="mr-1 h-3.5 w-3.5" />
            Todas
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-sky-800 hover:bg-sky-100" onClick={clearAll}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Limpar
          </Button>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-sky-200/70">
        <span className="text-[11px] font-semibold text-sky-800 mr-1">Atalhos rápidos:</span>
        <button
          type="button"
          onClick={applyPresetQc}
          className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-sky-700 shadow-xs border border-sky-200 hover:bg-sky-50"
        >
          Operador CQ + Laudos
        </button>
        <button
          type="button"
          onClick={applyPresetFullOperations}
          className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-sky-700 shadow-xs border border-sky-200 hover:bg-sky-50"
        >
          Operação Geral (Sem Exclusão)
        </button>
      </div>

      {/* Module Groups */}
      <div className="space-y-3 pt-2">
        {catalog.map((module) => {
          const ModuleIcon = MODULE_ICONS[module.moduleId] ?? Shield
          const modulePermNames = module.permissions.map((p) => p.name)
          const allModuleSelected = modulePermNames.every((p) => currentSet.has(p))

          return (
            <div
              key={module.moduleId}
              className="rounded-xl border border-neutral-200 bg-white p-3 shadow-xs transition hover:border-neutral-300"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-green-100/70 p-1.5 text-green-800">
                    <ModuleIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-neutral-900">{module.moduleName}</span>
                    <span className="ml-2 text-[11px] text-neutral-500 hidden sm:inline">
                      {module.description}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleModule(module)}
                  className="text-xs font-semibold text-green-800 hover:text-green-950 px-2 py-0.5 rounded-md hover:bg-green-50"
                >
                  {allModuleSelected ? 'Desmarcar Módulo' : 'Marcar Módulo'}
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {module.permissions.map((perm) => {
                  const isChecked = currentSet.has(perm.name)
                  return (
                    <label
                      key={perm.name}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${
                        isChecked
                          ? 'border-green-600 bg-green-50/50'
                          : 'border-neutral-200 bg-neutral-50/50 hover:bg-white hover:border-neutral-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePermission(perm.name)}
                        className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-green-800 focus:ring-green-700"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-semibold ${isChecked ? 'text-green-900' : 'text-neutral-800'}`}>
                            {perm.label}
                          </span>
                          <span className="rounded bg-neutral-100 px-1 py-0.2 text-[9px] font-mono text-neutral-600">
                            {perm.action}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-neutral-500 leading-tight">
                          {perm.description || PERMISSION_DESCRIPTIONS[perm.name]}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Create User Modal ─── */

function CreateUserModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const createUser = useCreateUser()
  const { data: catalogData } = usePermissionsCatalog()
  const catalog = catalogData?.modules ?? LOCAL_PERMISSION_CATALOG.modules

  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('FUNCIONARIO')
  const [email, setEmail] = useState('')
  const [permissions, setPermissions] = useState<string[]>([])
  const [showPw, setShowPw] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (createUser.isPending) return
    setErrorMessage(null)

    if (!username.trim() || !name.trim() || !password) {
      setErrorMessage('Preencha os campos obrigatórios: login, nome completo e senha.')
      toast.warning('Preencha os campos obrigatórios.')
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
      const msg = extractErrorMessage(err, 'Erro ao criar usuário. Verifique se o login já existe ou atende aos requisitos.')
      setErrorMessage(msg)
      toast.error(msg)
    }
  }

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { resetForm(); onClose() }}
      title="Cadastrar Novo Usuário"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => { resetForm(); onClose() }}>Cancelar</Button>
          <Button onClick={() => void handleSubmit()} loading={createUser.isPending}>
            <UserPlus className="mr-2 h-4 w-4" />
            Cadastrar Usuário
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <ShieldAlert className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">
              <strong className="block font-semibold">Não foi possível criar o usuário</strong>
              <span>{errorMessage}</span>
            </div>
            <button type="button" onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

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

        {/* Role Selection */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-neutral-900">Perfil de Acesso (Role)</label>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {ROLES.map((r) => {
              const Icon = ROLE_ICONS[r] ?? Shield
              const selected = role === r
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition ${
                    selected
                      ? 'border-green-800 bg-green-50/70 shadow-xs'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  <div className={`mt-0.5 rounded-xl p-2 ${selected ? 'bg-green-800 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className={`text-sm font-bold ${selected ? 'text-green-950' : 'text-neutral-800'}`}>
                      {ROLE_LABELS[r]}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{ROLE_DESCRIPTIONS[r]}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Permissions Section */}
        {role === 'FUNCIONARIO' ? (
          <PermissionSelector
            selectedPermissions={permissions}
            onChange={setPermissions}
            catalog={catalog}
          />
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600">
            <p className="font-semibold text-neutral-800 mb-1">Permissões Gerenciadas Automaticamente</p>
            <p>
              O perfil <strong>{ROLE_LABELS[role]}</strong> possui permissões predefinidas e auditadas pelo sistema,
              não necessitando de configuração manual de checkboxes.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ─── Edit User Modal ─── */

function EditUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { toast } = useToast()
  const updateUser = useUpdateUser()
  const { data: catalogData } = usePermissionsCatalog()
  const catalog = catalogData?.modules ?? LOCAL_PERMISSION_CATALOG.modules

  const [name, setName] = useState(user.name)
  const [role, setRole] = useState<Role>(user.role)
  const [email, setEmail] = useState(user.email ?? '')
  const [isActive, setIsActive] = useState(user.isActive)
  const [permissions, setPermissions] = useState<string[]>(user.permissions ?? [])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Editar Usuário — ${user.name}`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void handleSubmit()} loading={updateUser.isPending}>
            Salvar Alterações
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <ShieldAlert className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">
              <strong className="block font-semibold">Falha ao salvar</strong>
              <span>{errorMessage}</span>
            </div>
            <button type="button" onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {/* User Identity Banner */}
        <div className="flex items-center gap-4 rounded-2xl bg-neutral-50 p-4 border border-neutral-200">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-800 text-sm font-bold text-white">
            {user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-neutral-900">{user.name}</div>
            <div className="text-xs text-neutral-500">Login: @{user.username}</div>
          </div>
        </div>

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

        <div>
          <label className="mb-2 block text-sm font-semibold text-neutral-900">Perfil de Acesso</label>
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
                      ? 'border-green-800 bg-green-50/70 shadow-xs'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  <div className={`mt-0.5 rounded-xl p-2 ${selected ? 'bg-green-800 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className={`text-sm font-bold ${selected ? 'text-green-950' : 'text-neutral-800'}`}>
                      {ROLE_LABELS[r]}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{ROLE_DESCRIPTIONS[r]}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {role === 'FUNCIONARIO' ? (
          <PermissionSelector
            selectedPermissions={permissions}
            onChange={setPermissions}
            catalog={catalog}
          />
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600">
            <p className="font-semibold text-neutral-800 mb-1">Permissões Automáticas</p>
            <p>
              O perfil <strong>{ROLE_LABELS[role]}</strong> opera com conjunto fixo de permissões definidas pela política de segurança.
            </p>
          </div>
        )}

        {/* Active/Inactive Switch */}
        <div className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3.5 bg-white">
          <div>
            <div className="text-sm font-bold text-neutral-900">Status da Conta</div>
            <div className="text-xs text-neutral-500">
              {isActive ? 'Usuário ativo (pode efetuar login no sistema)' : 'Usuário bloqueado (sessões canceladas)'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors ${
              isActive ? 'bg-green-700' : 'bg-neutral-300'
            }`}
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

/* ─── Reset Password Modal ─── */

function ResetPasswordModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { toast } = useToast()
  const resetPassword = useResetPassword()
  const [newPassword, setNewPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (resetPassword.isPending) return
    setErrorMessage(null)

    if (newPassword.length < 4) {
      setErrorMessage('A nova senha deve possuir no mínimo 4 caracteres.')
      toast.warning('A senha deve ter pelo menos 4 caracteres.')
      return
    }
    try {
      await resetPassword.mutateAsync({ id: user.id, request: { newPassword } })
      toast.success(`Senha do usuário "${user.name}" redefinida com sucesso!`)
      setNewPassword('')
      onClose()
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Erro ao redefinir senha.')
      setErrorMessage(msg)
      toast.error(msg)
    }
  }

  return (
    <Modal
      isOpen
      onClose={() => { setNewPassword(''); onClose() }}
      title="Redefinir Senha de Acesso"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => { setNewPassword(''); onClose() }}>Cancelar</Button>
          <Button onClick={() => void handleSubmit()} loading={resetPassword.isPending}>
            <KeyRound className="mr-2 h-4 w-4" />
            Confirmar Nova Senha
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <ShieldAlert className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">
              <span>{errorMessage}</span>
            </div>
            <button type="button" onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 border border-amber-200/70">
          <UserX className="h-5 w-5 shrink-0 text-amber-700" />
          <span>
            Você está redefinindo a senha de <strong>{user.name}</strong> (@{user.username}).
            Todas as sessões ativas do usuário serão invalidadas por segurança.
          </span>
        </div>

        <div className="relative">
          <Input
            label="Nova Senha *"
            type={showPw ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Digite a nova senha (mínimo 4 dígitos)"
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
      </div>
    </Modal>
  )
}

/* ─── Activity Log Section ─── */

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Fez login no sistema',
  CRIAR_REGISTRO_CQ: 'Registrou medição CQ',
  CRIAR_USUARIO: 'Criou novo usuário',
  EDITAR_USUARIO: 'Editou perfil de usuário',
  RESETAR_SENHA: 'Redefiniu senha de usuário',
  USER_CREATED: 'Criou novo usuário',
  USER_UPDATED: 'Atualizou usuário',
  PASSWORD_RESET: 'Redefiniu senha',
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-blue-100 text-blue-700',
  CRIAR_REGISTRO_CQ: 'bg-green-100 text-green-700',
  CRIAR_USUARIO: 'bg-violet-100 text-violet-700',
  EDITAR_USUARIO: 'bg-amber-100 text-amber-700',
  RESETAR_SENHA: 'bg-red-100 text-red-700',
  USER_CREATED: 'bg-violet-100 text-violet-700',
  USER_UPDATED: 'bg-amber-100 text-amber-700',
  PASSWORD_RESET: 'bg-red-100 text-red-700',
}

function formatLogDate(iso: string) {
  try {
    const date = new Date(iso)
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function ActivityLogSection({ users }: { users: User[] }) {
  const [filterUser, setFilterUser] = useState<string>('')
  const { data: logs = [], isLoading } = useAuditLogs(filterUser || undefined)

  const auditSummary = useAuditSummary()
  const summaryGenerated = auditSummary.isPending || auditSummary.isError || auditSummary.data != null
  const isForbidden = axios.isAxiosError(auditSummary.error) && auditSummary.error.response?.status === 403

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-green-100 p-2.5 text-green-700">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Atividade Recente & Auditoria</h3>
            <p className="text-sm text-neutral-500">Rastreabilidade completa de ações e acessos no sistema</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
          <div className="w-full sm:w-56">
            <Select
              label="Filtrar por usuário"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
            >
              <option value="">Todos os usuários</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </div>
          <Button
            variant="secondary"
            icon={<Sparkles className="h-4 w-4 text-violet-500" />}
            onClick={() => {
              if (auditSummary.isPending) return
              auditSummary.mutate(filterUser ? { userId: filterUser } : {})
            }}
            loading={auditSummary.isPending}
          >
            Resumir com IA
          </Button>
        </div>
      </div>

      {summaryGenerated ? (
        <div className="mt-4">
          <AiAssistResult
            isPending={auditSummary.isPending}
            isError={auditSummary.isError}
            text={auditSummary.data ?? null}
            loadingLabel="Resumindo atividade com IA..."
            errorLabel={
              isForbidden
                ? 'Sem permissão para gerar o resumo de auditoria (restrito a administradores).'
                : 'Não foi possível resumir a atividade agora. Tente novamente.'
            }
          />
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-neutral-100" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-10 text-center text-sm text-neutral-500">
          Nenhuma atividade registrada{filterUser ? ' para este usuário' : ''}.
        </div>
      ) : (
        <div className="mt-4 space-y-1">
          {logs.map((log) => {
            const details = log.details as Record<string, unknown> | null
            return (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-neutral-50"
              >
                <div className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${ACTION_COLORS[log.action] ?? 'bg-neutral-100 text-neutral-600'}`}>
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium text-neutral-900">
                      {log.userName ?? log.username ?? 'Sistema'}
                    </span>
                    <span className="text-sm text-neutral-600">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </div>
                  {details ? (
                    <div className="mt-0.5 flex flex-wrap gap-1.5">
                      {Object.entries(details).map(([key, val]) =>
                        val != null ? (
                          <span key={key} className="inline-flex rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600">
                            {key}: {String(val)}
                          </span>
                        ) : null,
                      )}
                    </div>
                  ) : null}
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-neutral-400">
                  {formatLogDate(log.createdAt)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

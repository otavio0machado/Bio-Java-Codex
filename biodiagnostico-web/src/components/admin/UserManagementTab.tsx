import { useMemo, useState } from 'react'
import {
  LayoutGrid,
  List,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { Button, Card, EmptyState, Input, Select, StatCard } from '../ui'
import { ROLE_LABELS } from '../../lib/permissions'
import { UserCardsGrid } from './UserCardsGrid'
import { UserTable } from './UserTable'
import type { Role, User } from '../../types'

const ROLES: Role[] = ['ADMIN', 'FUNCIONARIO', 'VIGILANCIA_SANITARIA', 'VISUALIZADOR']

interface UserManagementTabProps {
  users: User[]
  isLoading: boolean
  onOpenCreate: () => void
  onEditUser: (user: User) => void
  onResetPassword: (user: User) => void
  onToggleActive?: (user: User) => void
  currentUserId?: string
}

export function UserManagementTab({
  users,
  isLoading,
  onOpenCreate,
  onEditUser,
  onResetPassword,
  onToggleActive,
  currentUserId,
}: UserManagementTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState<string>('')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

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
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total de Usuários"
          value={stats.total}
          icon={<Users className="h-5 w-5" />}
          iconColor="bg-emerald-800"
        />
        <StatCard
          label="Usuários Ativos"
          value={stats.active}
          icon={<UserCheck className="h-5 w-5" />}
          iconColor="bg-emerald-600"
        />
        <StatCard
          label="Administradores"
          value={stats.admins}
          icon={<ShieldCheck className="h-5 w-5" />}
          iconColor="bg-violet-600"
        />
        <StatCard
          label="Funcionários"
          value={stats.funcionarios}
          icon={<UserCheck className="h-5 w-5" />}
          iconColor="bg-sky-600"
        />
      </div>

      {/* Barra de Busca, Filtros e Alternador de Visualização */}
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-end justify-between">
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Buscar usuário"
              placeholder="Filtrar por nome, login ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="w-full sm:w-60">
            <Select
              label="Filtrar por perfil"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="">Todos os perfis</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2.5">
          {/* Alternador Tabela / Cards */}
          <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                viewMode === 'table'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
              title="Visualização em tabela detalhada"
            >
              <List className="h-4 w-4" />
              Tabela
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                viewMode === 'cards'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
              title="Visualização em grade de cards"
            >
              <LayoutGrid className="h-4 w-4" />
              Cards
            </button>
          </div>

          <Button onClick={onOpenCreate}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Novo Usuário
          </Button>
        </div>
      </Card>

      {/* Lista de Usuários */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-neutral-100" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8 text-neutral-400" />}
          title={
            searchQuery || filterRole
              ? 'Nenhum usuário encontrado'
              : 'Nenhum usuário cadastrado'
          }
          description={
            searchQuery || filterRole
              ? 'Tente ajustar os termos de busca ou o filtro de perfil.'
              : 'Cadastre o primeiro usuário operacional ou administrativo do laboratório.'
          }
          action={
            !searchQuery && !filterRole
              ? { label: 'Novo Usuário', onClick: onOpenCreate }
              : undefined
          }
        />
      ) : viewMode === 'table' ? (
        <UserTable
          users={filteredUsers}
          onEdit={onEditUser}
          onResetPassword={onResetPassword}
          onToggleActive={onToggleActive}
          currentUserId={currentUserId}
        />
      ) : (
        <UserCardsGrid
          users={filteredUsers}
          onEdit={onEditUser}
          onResetPassword={onResetPassword}
          currentUserId={currentUserId}
        />
      )}
    </div>
  )
}

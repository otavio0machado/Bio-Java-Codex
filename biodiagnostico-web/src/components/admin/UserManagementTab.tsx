import { useMemo, useState } from 'react'
import {
  Download,
  LayoutGrid,
  List,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { Button, Card, EmptyState, Input, Select, StatCard, useToast } from '../ui'
import { ROLE_LABELS } from '../../lib/permissions'
import { exportUsersToCsv } from './adminHelpers'
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
  onViewDetails?: (user: User) => void
  onViewAudit?: (user: User) => void
  onRevokeSessions?: (user: User) => void
  onDelete?: (user: User) => void
  currentUserId?: string
}

export function UserManagementTab({
  users,
  isLoading,
  onOpenCreate,
  onEditUser,
  onResetPassword,
  onToggleActive,
  onViewDetails,
  onViewAudit,
  onRevokeSessions,
  onDelete,
  currentUserId,
}: UserManagementTabProps) {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !searchQuery ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesRole = !filterRole || u.role === filterRole
      const matchesStatus =
        filterStatus === 'ALL'
          ? true
          : filterStatus === 'ACTIVE'
          ? u.isActive
          : !u.isActive
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, searchQuery, filterRole, filterStatus])

  const stats = useMemo(() => {
    const active = users.filter((u) => u.isActive).length
    const inactive = users.filter((u) => !u.isActive).length
    const admins = users.filter((u) => u.role === 'ADMIN').length
    const funcionarios = users.filter((u) => u.role === 'FUNCIONARIO').length
    return { total: users.length, active, inactive, admins, funcionarios }
  }, [users])

  const handleExportCsv = () => {
    if (filteredUsers.length === 0) {
      toast.warning('Nenhum usuário para exportar com os filtros atuais.')
      return
    }
    exportUsersToCsv(filteredUsers)
    toast.success(`Exportados ${filteredUsers.length} usuários em CSV!`)
  }

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
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Buscar usuário"
              placeholder="Filtrar por nome, login ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="w-full sm:w-48">
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
          <div className="w-full sm:w-40">
            <Select
              label="Status da conta"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">Todos os status</option>
              <option value="ACTIVE">Apenas Ativos</option>
              <option value="INACTIVE">Apenas Inativos</option>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          {/* Botão Exportar CSV */}
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            title="Exportar listagem filtrada para planilha CSV"
          >
            <Download className="mr-1.5 h-4 w-4 text-neutral-600" />
            Exportar CSV
          </Button>

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
            searchQuery || filterRole || filterStatus !== 'ALL'
              ? 'Nenhum usuário encontrado'
              : 'Nenhum usuário cadastrado'
          }
          description={
            searchQuery || filterRole || filterStatus !== 'ALL'
              ? 'Tente ajustar os termos de busca ou filtros selecionados.'
              : 'Cadastre o primeiro usuário operacional ou administrativo do laboratório.'
          }
          action={
            !searchQuery && !filterRole && filterStatus === 'ALL'
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
          onViewDetails={onViewDetails}
          onViewAudit={onViewAudit}
          onRevokeSessions={onRevokeSessions}
          onDelete={onDelete}
          currentUserId={currentUserId}
        />
      ) : (
        <UserCardsGrid
          users={filteredUsers}
          onEdit={onEditUser}
          onResetPassword={onResetPassword}
          onViewDetails={onViewDetails}
          onViewAudit={onViewAudit}
          onRevokeSessions={onRevokeSessions}
          onDelete={onDelete}
          currentUserId={currentUserId}
        />
      )}
    </div>
  )
}

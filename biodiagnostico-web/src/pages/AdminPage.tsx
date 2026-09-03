import { useMemo, useState } from 'react'
import {
  Activity,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { Button, useToast } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { usePermissionsCatalog, useUpdateUser, useUsers } from '../hooks/useAdmin'
import { AuditLogsTab } from '../components/admin/AuditLogsTab'
import { CreateUserModal } from '../components/admin/CreateUserModal'
import { EditUserModal } from '../components/admin/EditUserModal'
import { PermissionMatrixTab } from '../components/admin/PermissionMatrixTab'
import { ResetPasswordModal } from '../components/admin/ResetPasswordModal'
import { UserManagementTab } from '../components/admin/UserManagementTab'
import { normalizeModuleCatalog } from '../components/admin/adminHelpers'
import type { User } from '../types'

type AdminTab = 'usuarios' | 'auditoria' | 'matriz'

export function AdminPage() {
  const { user: currentUser } = useAuth()
  const { toast } = useToast()
  const { data: users = [], isLoading } = useUsers()
  const updateUser = useUpdateUser()
  const { data: catalogData } = usePermissionsCatalog()
  const catalog = useMemo(() => normalizeModuleCatalog(catalogData?.modules), [catalogData])

  const [activeTab, setActiveTab] = useState<AdminTab>('usuarios')
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [resetUser, setResetUser] = useState<User | null>(null)

  const handleToggleActive = async (targetUser: User) => {
    if (targetUser.id === currentUser?.id) {
      toast.warning('Você não pode desativar o seu próprio usuário.')
      return
    }
    const nextStatus = !targetUser.isActive
    try {
      await updateUser.mutateAsync({
        id: targetUser.id,
        request: {
          isActive: nextStatus,
        },
      })
      toast.success(
        `Usuário "${targetUser.name}" ${nextStatus ? 'ativado' : 'desativado'} com sucesso.`
      )
    } catch {
      toast.error('Erro ao alterar status do usuário.')
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Principal */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Gestão de Usuários & Acessos
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Administração centralizada de contas, perfis e permissões modulares do laboratório (RBAC)
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="lg">
          <UserPlus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Navegação por Abas Oficiais */}
      <div className="border-b border-neutral-200">
        <nav className="-mb-px flex space-x-6 sm:space-x-8" aria-label="Abas de Administração">
          <button
            type="button"
            onClick={() => setActiveTab('usuarios')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition-colors ${
              activeTab === 'usuarios'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
            }`}
          >
            <Users className="h-4 w-4" />
            Usuários & Funcionários
            <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
              {users.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('auditoria')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition-colors ${
              activeTab === 'auditoria'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
            }`}
          >
            <Activity className="h-4 w-4" />
            Atividade & Auditoria
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('matriz')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition-colors ${
              activeTab === 'matriz'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Perfis & Matriz de Permissões
          </button>
        </nav>
      </div>

      {/* Conteúdo da Aba Ativa */}
      {activeTab === 'usuarios' && (
        <UserManagementTab
          users={users}
          isLoading={isLoading}
          onOpenCreate={() => setCreateOpen(true)}
          onEditUser={(u) => setEditUser(u)}
          onResetPassword={(u) => setResetUser(u)}
          onToggleActive={handleToggleActive}
          currentUserId={currentUser?.id}
        />
      )}

      {activeTab === 'auditoria' && <AuditLogsTab users={users} />}

      {activeTab === 'matriz' && <PermissionMatrixTab catalog={catalog} />}

      {/* Modais */}
      <CreateUserModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          currentUserId={currentUser?.id}
        />
      )}
      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
      )}
    </div>
  )
}

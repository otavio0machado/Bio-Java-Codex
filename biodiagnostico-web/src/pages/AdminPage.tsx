import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { Button, Modal, useToast } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import {
  useDeleteUser,
  usePermissionsCatalog,
  useRevokeUserSessions,
  useUpdateUser,
  useUsers,
} from '../hooks/useAdmin'
import { AuditLogsTab } from '../components/admin/AuditLogsTab'
import { CreateUserModal } from '../components/admin/CreateUserModal'
import { EditUserModal } from '../components/admin/EditUserModal'
import { PermissionMatrixTab } from '../components/admin/PermissionMatrixTab'
import { ResetPasswordModal } from '../components/admin/ResetPasswordModal'
import { UserDetailsModal } from '../components/admin/UserDetailsModal'
import { UserManagementTab } from '../components/admin/UserManagementTab'
import { extractErrorMessage, normalizeModuleCatalog } from '../components/admin/adminHelpers'
import type { User } from '../types'

type AdminTab = 'usuarios' | 'auditoria' | 'matriz'

export function AdminPage() {
  const { user: currentUser } = useAuth()
  const { toast } = useToast()
  const { data: users = [], isLoading } = useUsers()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const revokeSessions = useRevokeUserSessions()
  const { data: catalogData } = usePermissionsCatalog()
  const catalog = useMemo(() => normalizeModuleCatalog(catalogData?.modules), [catalogData])

  const [activeTab, setActiveTab] = useState<AdminTab>('usuarios')
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [resetUser, setResetUser] = useState<User | null>(null)
  const [selectedUserDetails, setSelectedUserDetails] = useState<User | null>(null)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [auditPreselectedUserId, setAuditPreselectedUserId] = useState<string | undefined>(undefined)

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

  const handleRevokeSessions = async (targetUser: User) => {
    try {
      await revokeSessions.mutateAsync(targetUser.id)
      toast.success(`Todas as sessões ativas de "${targetUser.name}" foram revogadas com sucesso!`)
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Erro ao revogar sessões do usuário.'))
    }
  }

  const handleViewAudit = (targetUser: User) => {
    setAuditPreselectedUserId(targetUser.id)
    setActiveTab('auditoria')
  }

  const handleConfirmDelete = async () => {
    if (!userToDelete) return
    try {
      const res = await deleteUser.mutateAsync(userToDelete.id)
      if (res.status === 'DEACTIVATED') {
        toast.info(res.message)
      } else {
        toast.success(res.message)
      }
      setUserToDelete(null)
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Erro ao excluir usuário.'))
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
            onClick={() => {
              setAuditPreselectedUserId(undefined)
              setActiveTab('auditoria')
            }}
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
          onViewDetails={(u) => setSelectedUserDetails(u)}
          onViewAudit={handleViewAudit}
          onRevokeSessions={handleRevokeSessions}
          onDelete={(u) => setUserToDelete(u)}
          currentUserId={currentUser?.id}
        />
      )}

      {activeTab === 'auditoria' && (
        <AuditLogsTab users={users} initialUserId={auditPreselectedUserId} />
      )}

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

      {selectedUserDetails && (
        <UserDetailsModal
          user={selectedUserDetails}
          onClose={() => setSelectedUserDetails(null)}
          onEdit={(u) => setEditUser(u)}
          onResetPassword={(u) => setResetUser(u)}
          onViewAudit={handleViewAudit}
          onRevokeSessions={handleRevokeSessions}
          onDelete={(u) => setUserToDelete(u)}
          currentUserId={currentUser?.id}
        />
      )}

      {/* Modal de Confirmação de Exclusão com Conformidade RDC 786 */}
      {userToDelete && (
        <Modal
          isOpen
          onClose={() => setUserToDelete(null)}
          title="Confirmar Exclusão de Usuário"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setUserToDelete(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                loading={deleteUser.isPending}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Confirmar Exclusão
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 border border-amber-200/80">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Deseja excluir o usuário {userToDelete.name} (@{userToDelete.username})?
                </p>
                <p className="mt-2 text-xs text-amber-800 leading-relaxed">
                  <strong>Conformidade Regulatória (RDC 786 / PNCQ):</strong>
                  <br />
                  Se este usuário possuir qualquer registro no laboratório (laudos, medições de CQ,
                  registros de temperatura ou trilhas de auditoria), o sistema irá
                  <strong> inativar a conta e desconectar sessões</strong> imediatamente para preservar a
                  rastreabilidade legal. A exclusão permanente só ocorrerá caso a conta não tenha nenhum
                  vínculo histórico.
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

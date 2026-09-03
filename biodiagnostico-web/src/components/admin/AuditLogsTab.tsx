import axios from 'axios'
import { Activity, Clock, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { AiAssistResult } from '../proin/AiAssistShared'
import { Button, Card, Select } from '../ui'
import { useAuditLogs } from '../../hooks/useAdmin'
import { useAuditSummary } from '../../hooks/useAiAssist'
import type { User } from '../../types'

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Fez login no sistema',
  CRIAR_REGISTRO_CQ: 'Registrou medição CQ',
  CRIAR_USUARIO: 'Criou novo usuário',
  EDITAR_USUARIO: 'Editou perfil de usuário',
  RESETAR_SENHA: 'Redefiniu senha de usuário',
  USER_CREATED: 'Criou novo usuário',
  USER_UPDATED: 'Atualizou usuário',
  PASSWORD_RESET: 'Redefiniu senha',
  USER_DEACTIVATED: 'Desativou usuário (auditoria preservada)',
  USER_DELETED: 'Excluiu usuário permanentemente',
  SESSIONS_REVOKED: 'Revogou sessões ativas',
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-blue-50 text-blue-700 border-blue-200',
  CRIAR_REGISTRO_CQ: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CRIAR_USUARIO: 'bg-violet-50 text-violet-700 border-violet-200',
  EDITAR_USUARIO: 'bg-amber-50 text-amber-700 border-amber-200',
  RESETAR_SENHA: 'bg-red-50 text-red-700 border-red-200',
  USER_CREATED: 'bg-violet-50 text-violet-700 border-violet-200',
  USER_UPDATED: 'bg-amber-50 text-amber-700 border-amber-200',
  PASSWORD_RESET: 'bg-red-50 text-red-700 border-red-200',
  USER_DEACTIVATED: 'bg-orange-50 text-orange-700 border-orange-200',
  USER_DELETED: 'bg-red-50 text-red-700 border-red-200',
  SESSIONS_REVOKED: 'bg-amber-50 text-amber-700 border-amber-200',
}

function formatLogDate(iso: string) {
  try {
    const date = new Date(iso)
    return (
      date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }) +
      ' às ' +
      date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    )
  } catch {
    return iso
  }
}

interface AuditLogsTabProps {
  users: User[]
  initialUserId?: string
}

export function AuditLogsTab({ users, initialUserId }: AuditLogsTabProps) {
  const [filterUser, setFilterUser] = useState<string>(initialUserId || '')
  const { data: logs = [], isLoading } = useAuditLogs(filterUser || undefined)

  const auditSummary = useAuditSummary()
  const summaryGenerated =
    auditSummary.isPending || auditSummary.isError || auditSummary.data != null
  const isForbidden =
    axios.isAxiosError(auditSummary.error) && auditSummary.error.response?.status === 403

  return (
    <Card className="space-y-6">
      {/* Header com Filtro e Botão de IA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 shadow-xs">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-neutral-900">
              Trilha de Auditoria & Atividade
            </h3>
            <p className="text-xs text-neutral-500">
              Rastreabilidade regulatória completa de ações e acessos executados no sistema
            </p>
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
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="secondary"
            icon={<Sparkles className="h-4 w-4 text-violet-600" />}
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

      {/* Resumo de IA */}
      {summaryGenerated ? (
        <div className="rounded-2xl border border-violet-200/80 bg-violet-50/40 p-4 shadow-xs">
          <AiAssistResult
            isPending={auditSummary.isPending}
            isError={auditSummary.isError}
            text={auditSummary.data ?? null}
            loadingLabel="Resumindo atividades e padrões com IA..."
            errorLabel={
              isForbidden
                ? 'Sem permissão para gerar o resumo de auditoria (restrito a administradores).'
                : 'Não foi possível resumir a atividade agora. Tente novamente.'
            }
          />
        </div>
      ) : null}

      {/* Lista de Registros de Auditoria */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-neutral-100" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-12 text-center text-sm text-neutral-500">
          Nenhuma atividade registrada{filterUser ? ' para o usuário selecionado' : ''}.
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const details = log.details as Record<string, unknown> | null
            return (
              <div
                key={log.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-neutral-200/70 p-3 transition hover:bg-neutral-50"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 shrink-0 rounded-lg p-1.5 border ${
                      ACTION_COLORS[log.action] ??
                      'bg-neutral-100 text-neutral-600 border-neutral-200'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                      <span className="font-bold text-neutral-900">
                        {log.userName ?? log.username ?? 'Sistema'}
                      </span>
                      <span className="text-neutral-600">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </div>

                    {details && Object.keys(details).length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(details).map(([key, val]) =>
                          val != null ? (
                            <span
                              key={key}
                              className="inline-flex rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 border border-neutral-200/60"
                            >
                              {key}: {String(val)}
                            </span>
                          ) : null
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <span className="shrink-0 text-xs text-neutral-400 sm:text-right">
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

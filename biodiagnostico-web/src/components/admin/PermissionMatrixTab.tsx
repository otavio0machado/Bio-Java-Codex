import {
  Card,
} from '../ui'
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from '../../lib/permissions'
import { MODULE_ICONS } from './ModulePermissionSelector'
import { ROLE_COLORS, ROLE_ICONS } from './UserTable'
import type { ModuleGroup, Role } from '../../types'

const ROLES: Role[] = ['ADMIN', 'FUNCIONARIO', 'VIGILANCIA_SANITARIA', 'VISUALIZADOR']

interface PermissionMatrixTabProps {
  catalog: ModuleGroup[]
}

export function PermissionMatrixTab({ catalog }: PermissionMatrixTabProps) {
  return (
    <div className="space-y-6">
      {/* Resumo dos Perfis Canônicos */}
      <div>
        <h3 className="text-base font-bold text-neutral-900 mb-3">
          Perfis de Acesso Canônicos (Roles)
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r) => {
            const Icon = ROLE_ICONS[r]
            return (
              <Card key={r} className="space-y-2 border border-neutral-200">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      ROLE_COLORS[r]
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {ROLE_LABELS[r]}
                  </span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  {ROLE_DESCRIPTIONS[r]}
                </p>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Matriz Completa de Permissões por Módulo */}
      <div>
        <h3 className="text-base font-bold text-neutral-900 mb-3">
          Catálogo Canônico de Permissões por Módulo
        </h3>
        <div className="space-y-4">
          {catalog.map((mod) => {
            const ModuleIcon = MODULE_ICONS[mod.moduleId]
            return (
              <div
                key={mod.moduleId}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs"
              >
                <div className="flex items-center gap-3 border-b border-neutral-100 bg-neutral-50/80 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                    <ModuleIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900">{mod.moduleName}</h4>
                    <p className="text-xs text-neutral-500">{mod.description}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-neutral-100 bg-neutral-50/40 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      <tr>
                        <th className="py-2.5 pl-4 pr-3 sm:pl-6">Permissão</th>
                        <th className="px-3 py-2.5">Ação</th>
                        <th className="px-3 py-2.5">Finalidade Operacional</th>
                        <th className="py-2.5 pl-3 pr-4 sm:pr-6 text-right">
                          Acesso Automático
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {mod.permissions.map((p) => {
                        const isView = p.action === 'VIEW'
                        const isDownload = p.action === 'DOWNLOAD'

                        return (
                          <tr key={p.name} className="hover:bg-neutral-50/60">
                            <td className="whitespace-nowrap py-3 pl-4 pr-3 font-semibold text-neutral-900 sm:pl-6">
                              <div>{p.label || p.name}</div>
                              <span className="font-mono text-[10px] text-neutral-400">
                                {p.name}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-600">
                                {p.action}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-neutral-600 max-w-md">
                              {p.description}
                            </td>
                            <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right sm:pr-6">
                              <div className="flex items-center justify-end gap-1">
                                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800 border border-violet-200">
                                  Admin
                                </span>
                                {isView && (
                                  <>
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                                      Vigilância
                                    </span>
                                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 border border-neutral-200">
                                      Visualizador
                                    </span>
                                  </>
                                )}
                                {isDownload && (
                                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                                    Vigilância
                                  </span>
                                )}
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                                  Funcionário (Configurável)
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

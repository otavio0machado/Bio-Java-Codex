import { useMemo, useState } from 'react'
import {
  Beaker,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  FileText,
  FlaskConical,
  LayoutDashboard,
  RotateCcw,
  Shield,
  Thermometer,
  Wrench,
  Sliders,
} from 'lucide-react'
import { Button } from '../ui'
import {
  PERMISSION_DESCRIPTIONS,
  PERMISSION_LABELS,
} from '../../lib/permissions'
import type { ModuleGroup } from '../../types'

export const MODULE_ICONS: Record<string, typeof Shield> = {
  DASHBOARD: LayoutDashboard,
  QC: Beaker,
  REAGENTS: FlaskConical,
  MAINTENANCE: Wrench,
  TEMPERATURE: Thermometer,
  REPORTS: FileText,
}

export const MODULE_SHORT_NAMES: Record<string, string> = {
  DASHBOARD: 'Dashboard',
  QC: 'CQ (PROIN)',
  REAGENTS: 'Reagentes',
  MAINTENANCE: 'Manutenção',
  TEMPERATURE: 'Temperatura',
  REPORTS: 'Relatórios',
}

interface ModulePermissionSelectorProps {
  selectedPermissions: string[]
  onChange: (perms: string[]) => void
  catalog: ModuleGroup[]
}

export function ModulePermissionSelector({
  selectedPermissions,
  onChange,
  catalog,
}: ModulePermissionSelectorProps) {
  const currentSet = useMemo(() => new Set(selectedPermissions), [selectedPermissions])
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({})

  const toggleExpand = (moduleId: string) => {
    setExpandedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }))
  }

  // Identifica módulos operacionais (exclui DASHBOARD da listagem principal pois ele é concedido automaticamente)
  const operationalModules = useMemo(() => {
    return catalog.filter((m) => m.moduleId !== 'DASHBOARD')
  }, [catalog])

  // Normaliza lista com DASHBOARD_VIEW se houver qualquer módulo operacional selecionado
  const updatePermissions = (newSet: Set<string>) => {
    const operationalSelected = catalog
      .filter((m) => m.moduleId !== 'DASHBOARD')
      .some((m) => m.permissions.some((p) => newSet.has(p.name)))

    if (operationalSelected) {
      newSet.add('DASHBOARD_VIEW')
    } else {
      newSet.delete('DASHBOARD_VIEW')
    }

    onChange(Array.from(newSet))
  }

  // Alterna o módulo inteiro ON/OFF
  const toggleModule = (module: ModuleGroup) => {
    const modulePerms = module.permissions.map((p) => p.name)
    const isModuleActive = modulePerms.some((p) => currentSet.has(p))
    const next = new Set(currentSet)

    if (isModuleActive) {
      // Desativa módulo inteiro
      modulePerms.forEach((p) => next.delete(p))
    } else {
      // Ativa módulo com permissões padrão operacionais (exceto DELETE que deve ser opt-in explícito)
      modulePerms.forEach((p) => {
        if (p === 'REAGENTS_DELETE') return // Exclusão de reagentes é perigosa, fica no avançado
        next.add(p)
      })
    }
    updatePermissions(next)
  }

  // Alterna nível do módulo entre "Completo" (escrita + leitura) e "Apenas Leitura"
  const setModuleAccessLevel = (module: ModuleGroup, level: 'FULL' | 'READ_ONLY') => {
    const next = new Set(currentSet)
    const viewPerm = module.permissions.find((p) => p.action === 'VIEW')?.name || `${module.moduleId}_VIEW`

    if (level === 'READ_ONLY') {
      // Mantém apenas a permissão de visualização
      module.permissions.forEach((p) => next.delete(p.name))
      next.add(viewPerm)
    } else {
      // Ativa todas as permissões normais operacionais
      module.permissions.forEach((p) => {
        if (p.name === 'REAGENTS_DELETE') return
        next.add(p.name)
      })
    }
    updatePermissions(next)
  }

  // Alterna uma permissão individual específica
  const toggleSinglePermission = (module: ModuleGroup, permName: string) => {
    const next = new Set(currentSet)
    const viewPerm = module.permissions.find((p) => p.action === 'VIEW')?.name || `${module.moduleId}_VIEW`

    if (next.has(permName)) {
      next.delete(permName)
      // Se removeu a de VIEW, remove todas as outras de escrita daquele módulo
      if (permName === viewPerm) {
        module.permissions.forEach((p) => next.delete(p.name))
      }
    } else {
      next.add(permName)
      // Se adicionou uma permissão de escrita/ação, garante que a VIEW do módulo esteja ativa
      next.add(viewPerm)
    }
    updatePermissions(next)
  }

  // ─── Presets Rápidos ───

  const applySingleModulePreset = (moduleId: string) => {
    const target = catalog.find((m) => m.moduleId === moduleId)
    if (!target) return
    const next = new Set<string>()
    target.permissions.forEach((p) => {
      if (p.name === 'REAGENTS_DELETE') return // seguro por padrão
      next.add(p.name)
    })
    next.add('DASHBOARD_VIEW')
    onChange(Array.from(next))
  }

  const applyAllModules = () => {
    const next = new Set<string>()
    catalog.forEach((m) => {
      m.permissions.forEach((p) => next.add(p.name))
    })
    onChange(Array.from(next))
  }

  const clearAll = () => {
    onChange([])
  }

  // Lista de módulos com pelo menos 1 permissão ativa
  const activeModules = useMemo(() => {
    return operationalModules.filter((m) =>
      m.permissions.some((p) => currentSet.has(p.name))
    )
  }, [operationalModules, currentSet])

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4">
      {/* Header do Seletor */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200/80 pb-3">
        <div>
          <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <Sliders className="h-4 w-4 text-emerald-700" />
            Permissões por Módulo Laboratorial
          </h4>
          <p className="text-xs text-neutral-500 mt-0.5">
            Selecione quais áreas do laboratório este funcionário terá autorização para acessar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-neutral-700 hover:text-neutral-900"
            onClick={applyAllModules}
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-700" />
            Todos os Módulos
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-neutral-500 hover:text-red-700"
            onClick={clearAll}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Desmarcar Todos
          </Button>
        </div>
      </div>

      {/* Barra de Atalhos Rápidos (Presets Clínicos de 1-Clique) */}
      <div className="space-y-1.5 rounded-xl bg-white p-3 border border-neutral-200/80 shadow-xs">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Atalhos de 1 clique (Acesso a módulo único):
        </span>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => applySingleModulePreset('TEMPERATURE')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-900"
          >
            <Thermometer className="h-3.5 w-3.5 text-emerald-600" />
            Somente Temperatura
          </button>
          <button
            type="button"
            onClick={() => applySingleModulePreset('REAGENTS')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-900"
          >
            <FlaskConical className="h-3.5 w-3.5 text-emerald-600" />
            Somente Reagentes
          </button>
          <button
            type="button"
            onClick={() => applySingleModulePreset('QC')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-900"
          >
            <Beaker className="h-3.5 w-3.5 text-emerald-600" />
            Somente CQ (PROIN)
          </button>
          <button
            type="button"
            onClick={() => applySingleModulePreset('MAINTENANCE')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-900"
          >
            <Wrench className="h-3.5 w-3.5 text-emerald-600" />
            Somente Manutenção
          </button>
          <button
            type="button"
            onClick={() => applySingleModulePreset('REPORTS')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-900"
          >
            <FileText className="h-3.5 w-3.5 text-emerald-600" />
            Somente Relatórios
          </button>
        </div>
      </div>

      {/* Cards de Módulo */}
      <div className="space-y-3 pt-1">
        {operationalModules.map((module) => {
          const ModuleIcon = MODULE_ICONS[module.moduleId] ?? Shield
          const modulePermNames = module.permissions.map((p) => p.name)
          const isModuleActive = modulePermNames.some((p) => currentSet.has(p))
          const isExpanded = !!expandedModules[module.moduleId]

          // Verifica se está em modo "Apenas Leitura" ou "Completo"
          const hasWritePerms = module.permissions
            .filter((p) => p.action !== 'VIEW')
            .some((p) => currentSet.has(p.name))

          const isReadOnly = isModuleActive && !hasWritePerms

          return (
            <div
              key={module.moduleId}
              className={`rounded-2xl border transition-all ${
                isModuleActive
                  ? 'border-emerald-300 bg-white shadow-xs ring-1 ring-emerald-500/10'
                  : 'border-neutral-200 bg-white/70 hover:border-neutral-300'
              }`}
            >
              {/* Header do Módulo com Switch */}
              <div className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                      isModuleActive
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    <ModuleIcon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-neutral-900">
                        {module.moduleName}
                      </span>
                      {isModuleActive && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                          {isReadOnly ? 'Apenas Consulta' : 'Operação Completa'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 line-clamp-1">
                      {module.description}
                    </p>
                  </div>
                </div>

                {/* Switch de Ativação do Módulo */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isModuleActive}
                    onClick={() => toggleModule(module)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                      isModuleActive ? 'bg-emerald-700' : 'bg-neutral-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 translate-y-1 rounded-full bg-white shadow-xs transition-transform ${
                        isModuleActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Opções quando o módulo está ativo */}
              {isModuleActive && (
                <div className="border-t border-neutral-100 bg-neutral-50/50 px-3.5 py-3 rounded-b-2xl space-y-3">
                  {/* Seletor de Nível (Operação vs Leitura) */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModuleAccessLevel(module, 'FULL')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          !isReadOnly
                            ? 'bg-emerald-800 text-white shadow-xs'
                            : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                        }`}
                      >
                        Operação Completa (Registro & Edição)
                      </button>
                      <button
                        type="button"
                        onClick={() => setModuleAccessLevel(module, 'READ_ONLY')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          isReadOnly
                            ? 'bg-emerald-800 text-white shadow-xs'
                            : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                        }`}
                      >
                        Apenas Consulta (Somente Leitura)
                      </button>
                    </div>

                    {/* Botão para Expandir Configuração Avançada */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(module.moduleId)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-500 hover:text-neutral-800"
                    >
                      {isExpanded ? (
                        <>
                          Recolher Avançado
                          <ChevronUp className="h-3.5 w-3.5" />
                        </>
                      ) : (
                        <>
                          Permissões Específicas ({module.permissions.filter((p) => currentSet.has(p.name)).length}/{module.permissions.length})
                          <ChevronDown className="h-3.5 w-3.5" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Painel Avançado com Permissões Detalhadas */}
                  {isExpanded && (
                    <div className="grid gap-2 pt-1 sm:grid-cols-2 border-t border-neutral-200/60 mt-2">
                      {module.permissions.map((perm) => {
                        const isChecked = currentSet.has(perm.name)
                        return (
                          <label
                            key={perm.name}
                            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${
                              isChecked
                                ? 'border-emerald-600 bg-emerald-50/50'
                                : 'border-neutral-200 bg-white hover:border-neutral-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSinglePermission(module, perm.name)}
                              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-emerald-800 focus:ring-emerald-700"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-semibold ${isChecked ? 'text-emerald-950' : 'text-neutral-800'}`}>
                                  {perm.label || PERMISSION_LABELS[perm.name] || perm.name}
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
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Resumo Final de Acessos Ativos */}
      <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
          <span className="font-bold text-neutral-700">Módulos com acesso liberado:</span>
          <span className="font-semibold text-emerald-800">
            {activeModules.length === 0
              ? 'Nenhum módulo selecionado (Acesso Bloqueado)'
              : `${activeModules.map((m) => MODULE_SHORT_NAMES[m.moduleId] || m.moduleName).join(', ')} (${currentSet.size} permissões)`}
          </span>
        </div>
      </div>
    </div>
  )
}

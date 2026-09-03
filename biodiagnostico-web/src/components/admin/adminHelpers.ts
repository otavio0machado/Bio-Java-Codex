import axios from 'axios'
import { LOCAL_PERMISSION_CATALOG } from '../../lib/permissions'
import type { ModuleGroup } from '../../types'

export function extractErrorMessage(err: unknown, fallback: string): string {
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

export function normalizeModuleCatalog(rawModules?: any[]): ModuleGroup[] {
  if (!rawModules || !Array.isArray(rawModules) || rawModules.length === 0) {
    return LOCAL_PERMISSION_CATALOG.modules
  }
  return rawModules.map((m) => {
    const moduleId = String(m.moduleId || m.module || '').toUpperCase()
    const moduleName = String(m.moduleName || m.label || moduleId)
    const description = String(m.description || '')
    const permissions = Array.isArray(m.permissions)
      ? m.permissions.map((p: any) => ({
          name: String(p.name || p.code || ''),
          label: String(p.label || p.name || p.code || ''),
          description: String(p.description || ''),
          module: String(p.module || moduleId),
          action: String(p.action || p.actionType || 'VIEW'),
          impliedPermissions: Array.isArray(p.impliedPermissions)
            ? p.impliedPermissions
            : Array.isArray(p.implies)
            ? p.implies
            : [],
        }))
      : []
    return {
      moduleId,
      moduleName,
      description,
      permissions,
    }
  })
}

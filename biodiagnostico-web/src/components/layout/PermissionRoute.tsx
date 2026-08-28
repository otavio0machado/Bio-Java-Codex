import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { Permission, Role } from '../../types'
import { canViewModule, hasPermission } from '../../lib/permissions'

interface PermissionRouteProps {
  permission?: Permission | string
  module?: 'DASHBOARD' | 'QC' | 'REAGENTS' | 'MAINTENANCE' | 'TEMPERATURE' | 'REPORTS'
  roles?: Role[]
  children: React.ReactNode
  fallbackPath?: string
}

export function PermissionRoute({
  permission,
  module,
  roles,
  children,
  fallbackPath = '/dashboard',
}: PermissionRouteProps) {
  const { user } = useAuth()

  if (!user || !user.isActive) {
    return <Navigate to="/login" replace />
  }

  // Se houver restrição por role explícita (ex: ADMIN apenas)
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to={fallbackPath} replace />
  }

  // Se houver restrição por módulo
  if (module && !canViewModule(user, module)) {
    return <Navigate to={fallbackPath} replace />
  }

  // Se houver restrição por permissão granular
  if (permission && !hasPermission(user, permission)) {
    return <Navigate to={fallbackPath} replace />
  }

  return <>{children}</>
}

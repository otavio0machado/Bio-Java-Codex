import { cn } from '../../utils/cn'

interface StatusBadgeProps {
  status: 'APROVADO' | 'REPROVADO' | 'ALERTA' | 'ativo' | 'em_uso' | 'inativo' | 'vencido' | 'quarentena' | string
}

const badgeMap: Record<string, string> = {
  APROVADO: 'bg-green-100 text-green-800',
  ativo: 'bg-green-100 text-green-800',
  REPROVADO: 'bg-red-100 text-red-800',
  vencido: 'bg-red-100 text-red-800',
  ALERTA: 'bg-amber-100 text-amber-800',
  em_uso: 'bg-blue-100 text-blue-800',
  inativo: 'bg-neutral-100 text-neutral-600',
  quarentena: 'bg-amber-100 text-amber-800',
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold',
        badgeMap[status] ?? 'bg-neutral-100 text-neutral-600',
      )}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

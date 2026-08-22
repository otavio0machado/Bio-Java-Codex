import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, Thermometer } from 'lucide-react'
import type { TemperatureSummary } from '../../types/temperature'
import { StatCard } from '../ui'

interface TemperatureSummaryCardsProps {
  summary?: TemperatureSummary
  isLoading?: boolean
}

export function TemperatureSummaryCards({ summary, isLoading }: TemperatureSummaryCardsProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-neutral-100" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Pontos Ativos"
        value={`${summary.activeLocations} / ${summary.totalLocations}`}
        icon={<Thermometer className="h-5 w-5 text-emerald-600" />}
        iconColor="bg-emerald-50"
      />

      <StatCard
        label="Monitoramento Hoje"
        value={`${summary.recordedToday} de ${summary.activeLocations}`}
        icon={
          summary.pendingToday === 0 ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <Clock className="h-5 w-5 text-amber-600" />
          )
        }
        iconColor={summary.pendingToday === 0 ? 'bg-emerald-50' : 'bg-amber-50'}
      />

      <StatCard
        label="Não Conformidades (Mês)"
        value={String(summary.nonCompliantMonth)}
        icon={
          summary.nonCompliantMonth > 0 ? (
            <AlertTriangle className="h-5 w-5 text-rose-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          )
        }
        iconColor={summary.nonCompliantMonth > 0 ? 'bg-rose-50' : 'bg-emerald-50'}
      />

      <StatCard
        label="Calibrações RBC (30d)"
        value={String(summary.expiringCalibrationsCount)}
        icon={
          summary.expiringCalibrationsCount > 0 ? (
            <ShieldAlert className="h-5 w-5 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          )
        }
        iconColor={summary.expiringCalibrationsCount > 0 ? 'bg-amber-50' : 'bg-emerald-50'}
      />
    </div>
  )
}

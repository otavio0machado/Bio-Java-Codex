import {
  Activity,
  AlertTriangle,
  Beaker,
  CheckCircle2,
  ChevronRight,
  Clock,
  Package,
  TrendingUp,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDashboardAlerts, useDashboardKpis, useRecentRecords } from '../hooks/useDashboard'
import { Card, EmptyState, Skeleton, StatCard, StatusBadge } from '../components/ui'

export function DashboardPage() {
  const navigate = useNavigate()
  const { data: kpis, isLoading: loadingKpis } = useDashboardKpis()
  const { data: alerts, isLoading: loadingAlerts } = useDashboardAlerts()
  const { data: records, isLoading: loadingRecords } = useRecentRecords()

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <Card className="overflow-hidden bg-gradient-to-r from-green-900 via-green-800 to-green-700 text-white">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-green-100">Taxa de Aprovação</p>
            <div className="mt-3 text-5xl font-bold">
              {loadingKpis ? '...' : `${Math.round(kpis?.approvalRate ?? 0)}%`}
            </div>
            <p className="mt-2 text-sm text-green-100">Mês atual</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
            <div className="text-sm text-green-100">Tendência do período</div>
            <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
              <TrendingUp className="h-5 w-5" />
              Estável para operação
            </div>
          </div>
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loadingKpis ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} height="10rem" />)
        ) : (
          <>
            <StatCard icon={<Activity className="h-5 w-5" />} iconColor="bg-blue-600" value={kpis?.totalToday ?? 0} label="CQ Hoje" />
            <StatCard icon={<Beaker className="h-5 w-5" />} iconColor="bg-green-700" value={kpis?.totalMonth ?? 0} label="CQ Mês" />
            <StatCard icon={<TrendingUp className="h-5 w-5" />} iconColor="bg-emerald-600" value={`${Math.round(kpis?.approvalRate ?? 0)}%`} label="Taxa de Aprovação" />
            <StatCard icon={<AlertTriangle className="h-5 w-5" />} iconColor="bg-orange-500" value={kpis?.alertsCount ?? 0} label="Alertas Ativos" />
          </>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="animate-fadeIn">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Alertas Ativos</h3>
              <p className="text-sm text-neutral-500">Visão consolidada da operação</p>
            </div>
          </div>

          {loadingAlerts ? (
            <Skeleton type="line" lines={4} />
          ) : alerts && alerts.expiringReagents.count + alerts.pendingMaintenances.count + alerts.westgardViolations.count > 0 ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4">
                <Package className="mt-1 h-5 w-5 text-amber-700" />
                <div>
                  <div className="font-medium text-amber-900">
                    {alerts.expiringReagents.count} lotes vencem nos próximos 30 dias
                  </div>
                  <div className="text-sm text-amber-700">
                    Priorize a revisão de estoque para evitar ruptura operacional.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-red-50 p-4">
                <Clock className="mt-1 h-5 w-5 text-red-700" />
                <div>
                  <div className="font-medium text-red-900">
                    {alerts.pendingMaintenances.count} manutenções pendentes
                  </div>
                  <div className="text-sm text-red-700">Equipamentos com revisão vencida exigem atenção.</div>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-red-50 p-4">
                <AlertTriangle className="mt-1 h-5 w-5 text-red-700" />
                <div>
                  <div className="font-medium text-red-900">
                    {alerts.westgardViolations.count} registros com violações de Westgard
                  </div>
                  <div className="text-sm text-red-700">Faça a análise crítica antes de liberar a rotina.</div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<CheckCircle2 className="h-8 w-8" />}
              title="Tudo em ordem!"
              description="Não há alertas ativos críticos no momento."
            />
          )}
        </Card>

        <Card className="animate-fadeIn">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Registros Recentes</h3>
              <p className="text-sm text-neutral-500">Últimos 10 lançamentos de CQ</p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm font-medium text-green-800"
              onClick={() => navigate('/qc')}
            >
              Ver todos <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {loadingRecords ? (
            <Skeleton type="line" lines={6} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="pb-3 font-medium">Data</th>
                    <th className="pb-3 font-medium">Exame</th>
                    <th className="pb-3 font-medium">Nível</th>
                    <th className="pb-3 font-medium">Valor</th>
                    <th className="pb-3 font-medium">CV%</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {records?.map((record) => (
                    <tr key={record.id}>
                      <td className="py-3">{new Date(record.date).toLocaleDateString('pt-BR')}</td>
                      <td className="py-3 font-medium text-neutral-900">{record.examName}</td>
                      <td className="py-3">{record.level}</td>
                      <td className="py-3">{record.value.toFixed(2)}</td>
                      <td className="py-3">{record.cv.toFixed(2)}</td>
                      <td className="py-3"><StatusBadge status={record.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { title: 'Registrar CQ', description: 'Lançar novo controle de qualidade', action: () => navigate('/qc') },
          { title: 'Reagentes', description: 'Acompanhar lotes e consumo', action: () => navigate('/qc?tab=reagentes') },
          { title: 'Relatórios', description: 'Gerar PDF e abrir gráficos', action: () => navigate('/qc?tab=relatorios') },
        ].map((item) => (
          <Card key={item.title} onClick={item.action} className="animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">{item.title}</h3>
                <p className="mt-2 text-sm text-neutral-500">{item.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-neutral-400" />
            </div>
          </Card>
        ))}
      </section>
    </div>
  )
}

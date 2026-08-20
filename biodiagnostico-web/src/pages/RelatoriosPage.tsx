import {
  Clock,
  FileCheck2,
  FileText,
  FlaskConical,
  FlaskRound,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExecutionsTable } from '../components/relatoriosV2/ExecutionsTable'
import { ReportCatalogGrid } from '../components/relatoriosV2/ReportCatalogGrid'
import { useReportCatalogV2, useReportExecutions } from '../hooks/useReportsV2'
import { Card, Skeleton, StatCard } from '../components/ui'
import { cn } from '../utils/cn'

type PageTab = 'catalog' | 'history'

export function RelatoriosPage() {
  const navigate = useNavigate()
  const catalog = useReportCatalogV2()
  const executionsQuery = useReportExecutions({ page: 0, size: 1 })
  const [activeTab, setActiveTab] = useState<PageTab>('catalog')

  if (catalog.isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <Skeleton height="2.5rem" width="16rem" />
          <Skeleton height="1.25rem" width="28rem" />
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton height="8rem" />
          <Skeleton height="8rem" />
          <Skeleton height="8rem" />
          <Skeleton height="8rem" />
        </div>
        <Skeleton height="20rem" />
      </div>
    )
  }

  const totalDefinitions = catalog.definitions.length
  const totalExecutions = executionsQuery.data?.totalElements ?? 0
  const totalSignedRequired = catalog.definitions.filter((d) => d.signatureRequired).length

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Padronizado */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Relatórios</h1>
          <p className="mt-1 text-base text-neutral-500">
            Geração de laudos oficiais de controle de qualidade, reagentes, manutenção e auditoria regulatória.
          </p>
        </div>
      </header>

      {/* KPIs no padrão do Dashboard e Manutenção */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          iconColor="bg-green-700"
          value={totalDefinitions}
          label="Modelos de Laudo"
        />
        <StatCard
          icon={<FileCheck2 className="h-5 w-5" />}
          iconColor="bg-blue-600"
          value={totalExecutions}
          label="Laudos Emitidos"
        />
        <StatCard
          icon={<ShieldCheck className="h-5 w-5" />}
          iconColor="bg-purple-600"
          value={totalSignedRequired}
          label="Exigem Assinatura RT"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          iconColor="bg-amber-600"
          value="5 a 10 anos"
          label="Retenção Regulatória"
        />
      </section>

      {/* Ações Rápidas em Cards Padrão */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          onClick={() => navigate('/relatorios/CQ_OPERATIONAL_V2')}
          className="cursor-pointer border-l-4 border-green-600 bg-green-50/50 hover:shadow-elevated transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-700 p-3 text-white">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">Fechamento de CQ</h3>
              <p className="text-xs text-neutral-600">Levey-Jennings & Westgard</p>
            </div>
          </div>
        </Card>

        <Card
          onClick={() => navigate('/relatorios/REGULATORIO_PACOTE')}
          className="cursor-pointer border-l-4 border-purple-600 bg-purple-50/50 hover:shadow-elevated transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-700 p-3 text-white">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">Dossiê ANVISA</h3>
              <p className="text-xs text-neutral-600">Pacote fiscal RDC 786</p>
            </div>
          </div>
        </Card>

        <Card
          onClick={() => navigate('/relatorios/REAGENTES_RASTREABILIDADE')}
          className="cursor-pointer border-l-4 border-blue-600 bg-blue-50/50 hover:shadow-elevated transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-600 p-3 text-white">
              <FlaskRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">Insumos & Lotes</h3>
              <p className="text-xs text-neutral-600">Validades e consumo</p>
            </div>
          </div>
        </Card>

        <Card
          onClick={() => navigate('/relatorios/MANUTENCAO_KPI')}
          className="cursor-pointer border-l-4 border-amber-600 bg-amber-50/50 hover:shadow-elevated transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-600 p-3 text-white">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">Engenharia Clínica</h3>
              <p className="text-xs text-neutral-600">MTBF e preventivas</p>
            </div>
          </div>
        </Card>
      </section>

      {/* Navegação por Abas no Padrão do ProinPage */}
      <nav className="flex flex-wrap gap-6 border-b border-neutral-200">
        <button
          type="button"
          className={cn(
            'border-b-2 pb-3 text-base font-medium transition',
            activeTab === 'catalog'
              ? 'border-green-800 text-green-800'
              : 'border-transparent text-neutral-500 hover:text-neutral-700',
          )}
          onClick={() => setActiveTab('catalog')}
        >
          Catálogo de Relatórios
        </button>
        <button
          type="button"
          className={cn(
            'border-b-2 pb-3 text-base font-medium transition',
            activeTab === 'history'
              ? 'border-green-800 text-green-800'
              : 'border-transparent text-neutral-500 hover:text-neutral-700',
          )}
          onClick={() => setActiveTab('history')}
        >
          Histórico de Emissões
        </button>
      </nav>

      {/* Conteúdo da Aba */}
      <main>
        {activeTab === 'catalog' ? <ReportCatalogGrid definitions={catalog.definitions} /> : null}
        {activeTab === 'history' ? <ExecutionsTable definitions={catalog.definitions} /> : null}
      </main>
    </div>
  )
}

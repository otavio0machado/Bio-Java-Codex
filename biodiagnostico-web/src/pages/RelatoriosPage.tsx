import {
  ArrowRight,
  FileCheck2,
  FileSignature,
  FlaskConical,
  FlaskRound,
  History,
  LayoutGrid,
  QrCode,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExecutionsTable } from '../components/relatoriosV2/ExecutionsTable'
import { ReportCatalogGrid } from '../components/relatoriosV2/ReportCatalogGrid'
import { useReportCatalogV2 } from '../hooks/useReportsV2'
import { Card, Skeleton } from '../components/ui'
import { cn } from '../utils/cn'

type PageTab = 'catalog' | 'history'

export function RelatoriosPage() {
  const navigate = useNavigate()
  const catalog = useReportCatalogV2()
  const [activeTab, setActiveTab] = useState<PageTab>('catalog')

  if (catalog.isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <Skeleton height="2.5rem" width="20rem" />
          <Skeleton height="1.25rem" width="30rem" />
        </header>
        <div className="grid gap-4 sm:grid-cols-4">
          <Skeleton height="6rem" />
          <Skeleton height="6rem" />
          <Skeleton height="6rem" />
          <Skeleton height="6rem" />
        </div>
        <Skeleton height="24rem" />
      </div>
    )
  }

  const totalCount = catalog.definitions.length

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Executive Hero Header */}
      <header className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-gradient-to-br from-green-950 via-green-900 to-neutral-900 p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-300 ring-1 ring-green-400/30 backdrop-blur-md">
                <ShieldCheck className="h-3.5 w-3.5" /> RDC ANVISA 786/2023 & ISO 15189
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-neutral-200 backdrop-blur-md">
                <FileSignature className="h-3.5 w-3.5" /> Assinatura Digital do RT
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-neutral-200 backdrop-blur-md">
                <QrCode className="h-3.5 w-3.5" /> Validação Pública SHA-256
              </span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              Central de Inteligência & Laudos Oficiais
            </h1>
            <p className="text-sm leading-relaxed text-neutral-300 sm:text-base">
              Emissão padronizada de laudos metrológicos de controle de qualidade, estatística analítica (Levey-Jennings & Westgard), rastreabilidade de insumos e dossiês regulatórios com autenticação digital.
            </p>
          </div>

          {/* Quick Metrics Badge */}
          <div className="flex shrink-0 flex-row gap-4 lg:flex-col lg:items-end">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-md">
              <p className="text-3xl font-black text-white">{totalCount}</p>
              <p className="text-xs font-medium text-neutral-300">Modelos Homologados</p>
            </div>
          </div>
        </div>

        {/* Subtle background decoration */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-green-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      </header>

      {/* Quick Action Presets (1-Clique) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-green-800" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-700">Ações Rápidas de Emissão (1-Clique)</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PresetCard
            title="Fechamento Mensal de Qualidade"
            subtitle="CQ Operacional, Levey-Jennings, Westgard e pós-calibração do mês"
            icon={FlaskConical}
            badge="Essencial"
            color="emerald"
            onClick={() => navigate('/relatorios/CQ_OPERATIONAL_V2')}
          />
          <PresetCard
            title="Dossiê Fiscal ANVISA"
            subtitle="Pacote regulatório consolidado com termo de autenticidade RDC 786"
            icon={FileCheck2}
            badge="Regulatório"
            color="purple"
            onClick={() => navigate('/relatorios/REGULATORIO_PACOTE')}
          />
          <PresetCard
            title="Auditoria de Lotes & Insumos"
            subtitle="Rastreabilidade de reagentes, controle de validade e consumo"
            icon={FlaskRound}
            badge="Insumos"
            color="blue"
            onClick={() => navigate('/relatorios/REAGENTES_RASTREABILIDADE')}
          />
          <PresetCard
            title="Status de Engenharia Clínica"
            subtitle="KPIs de manutenção, MTBF e histórico por analisador"
            icon={Wrench}
            badge="Equipamentos"
            color="amber"
            onClick={() => navigate('/relatorios/MANUTENCAO_KPI')}
          />
        </div>
      </section>

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-3">
        <div className="inline-flex gap-1.5 rounded-2xl border border-neutral-200/80 bg-neutral-100/70 p-1.5">
          <TabButton
            active={activeTab === 'catalog'}
            onClick={() => setActiveTab('catalog')}
            icon={<LayoutGrid className="h-4 w-4" />}
          >
            Catálogo de Laudos Oficiais
          </TabButton>
          <TabButton
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            icon={<History className="h-4 w-4" />}
          >
            Histórico & Custódia de Emissões
          </TabButton>
        </div>
      </div>

      {/* Tab Content */}
      <main>
        {activeTab === 'catalog' ? <ReportCatalogGrid definitions={catalog.definitions} /> : null}
        {activeTab === 'history' ? <ExecutionsTable definitions={catalog.definitions} /> : null}
      </main>
    </div>
  )
}

interface PresetCardProps {
  title: string
  subtitle: string
  icon: React.ElementType
  badge: string
  color: 'emerald' | 'purple' | 'blue' | 'amber'
  onClick: () => void
}

function PresetCard({ title, subtitle, icon: Icon, badge, color, onClick }: PresetCardProps) {
  const colorStyles = {
    emerald: 'hover:border-emerald-500/50 bg-gradient-to-br from-white to-emerald-50/30 text-emerald-900 badge-emerald',
    purple: 'hover:border-purple-500/50 bg-gradient-to-br from-white to-purple-50/30 text-purple-900 badge-purple',
    blue: 'hover:border-blue-500/50 bg-gradient-to-br from-white to-blue-50/30 text-blue-900 badge-blue',
    amber: 'hover:border-amber-500/50 bg-gradient-to-br from-white to-amber-50/30 text-amber-900 badge-amber',
  }[color]

  const badgeStyles = {
    emerald: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    purple: 'bg-purple-100 text-purple-800 ring-purple-200',
    blue: 'bg-blue-100 text-blue-800 ring-blue-200',
    amber: 'bg-amber-100 text-amber-800 ring-amber-200',
  }[color]

  return (
    <Card
      className={`group relative flex cursor-pointer flex-col justify-between p-4 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md border border-neutral-200/90 ${colorStyles}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div>
        <div className="flex items-center justify-between">
          <div className="rounded-xl bg-white p-2 text-neutral-800 ring-1 ring-neutral-200 shadow-2xs group-hover:scale-105 transition-transform">
            <Icon className="h-5 w-5" />
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${badgeStyles}`}>
            {badge}
          </span>
        </div>
        <h3 className="mt-3 text-sm font-bold text-neutral-900 leading-snug group-hover:text-green-900 transition-colors">
          {title}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500 line-clamp-2">{subtitle}</p>
      </div>

      <div className="mt-4 flex items-center justify-end text-xs font-semibold text-green-800">
        <span className="inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
          Emitir Agora <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Card>
  )
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}

function TabButton({ active, onClick, icon, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
        active
          ? 'bg-white text-green-900 shadow-sm ring-1 ring-neutral-200/80'
          : 'text-neutral-600 hover:bg-white/60 hover:text-neutral-900',
      )}
      aria-pressed={active}
    >
      {icon}
      {children}
    </button>
  )
}

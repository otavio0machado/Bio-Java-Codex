import {
  AlertTriangle,
  ArrowRight,
  Beaker,
  CalendarClock,
  CheckCircle2,
  Crosshair,
  FileCheck2,
  FileText,
  FlaskConical,
  FlaskRound,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReportDefinition } from '../../types/reportsV2'
import { Card, EmptyState } from '../ui'

interface ReportCatalogGridProps {
  definitions: ReportDefinition[]
}

interface PillarDefinition {
  id: string
  title: string
  subtitle: string
  icon: LucideIcon
  colorBg: string
  colorText: string
  colorBadge: string
  categories: string[]
}

const PILLARS: PillarDefinition[] = [
  {
    id: 'qualidade',
    title: 'Controle de Qualidade & Estatística Analítica',
    subtitle: 'Laudos operacionais, Levey-Jennings, Westgard e eficácia de calibrações',
    icon: FlaskConical,
    colorBg: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    colorText: 'text-emerald-900',
    colorBadge: 'bg-emerald-100 text-emerald-800',
    categories: ['CONTROLE_QUALIDADE', 'WESTGARD', 'CALIBRACAO', 'HEMATOLOGIA'],
  },
  {
    id: 'insumos',
    title: 'Gestão de Insumos & Rastreabilidade',
    subtitle: 'Cadeia de custódia de reagentes, controle de validade e mapa de lotes',
    icon: FlaskRound,
    colorBg: 'bg-blue-50 text-blue-800 ring-blue-100',
    colorText: 'text-blue-900',
    colorBadge: 'bg-blue-100 text-blue-800',
    categories: ['REAGENTES'],
  },
  {
    id: 'engenharia',
    title: 'Engenharia Clínica & Parque Analítico',
    subtitle: 'KPIs de manutenção, MTBF e histórico de intervenções em analisadores',
    icon: Wrench,
    colorBg: 'bg-amber-50 text-amber-800 ring-amber-100',
    colorText: 'text-amber-900',
    colorBadge: 'bg-amber-100 text-amber-800',
    categories: ['MANUTENCAO'],
  },
  {
    id: 'regulatorio',
    title: 'Governança Regulatória & Dossiê ANVISA',
    subtitle: 'Pacotes consolidados de fiscalização com termo de autenticidade RDC 786/2023',
    icon: FileCheck2,
    colorBg: 'bg-purple-50 text-purple-800 ring-purple-100',
    colorText: 'text-purple-900',
    colorBadge: 'bg-purple-100 text-purple-800',
    categories: ['REGULATORIO', 'CONSOLIDADO'],
  },
]

// Mapeamento de icones individuais
const ICON_MAP: Record<string, LucideIcon> = {
  'flask-conical': FlaskConical,
  'alert-triangle': AlertTriangle,
  'beaker': Beaker,
  'wrench': Wrench,
  'crosshair': Crosshair,
  'layout-dashboard': LayoutDashboard,
  'file-check-2': FileCheck2,
}

export function ReportCatalogGrid({ definitions }: ReportCatalogGridProps) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedPillar, setSelectedPillar] = useState<string>('all')

  const filteredDefinitions = useMemo(() => {
    return definitions.filter((def) => {
      const matchesSearch =
        search === '' ||
        def.name.toLowerCase().includes(search.toLowerCase()) ||
        def.code.toLowerCase().includes(search.toLowerCase()) ||
        def.description.toLowerCase().includes(search.toLowerCase()) ||
        def.legalBasis.toLowerCase().includes(search.toLowerCase())

      if (!matchesSearch) return false

      if (selectedPillar === 'all') return true

      const pillar = PILLARS.find((p) => p.id === selectedPillar)
      return pillar ? pillar.categories.includes(String(def.category)) : true
    })
  }, [definitions, search, selectedPillar])

  if (definitions.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-8 w-8" />}
        title="Nenhum laudo disponível"
        description="Seu perfil de acesso ainda não possui relatórios homologados cadastrados. Contate a administração do laboratório."
      />
    )
  }

  return (
    <div className="space-y-8">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar laudo por título, código (ex: CQ_01), base regulatória ou finalidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-green-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-green-800"
          />
        </div>

        {/* Pillar Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedPillar('all')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              selectedPillar === 'all'
                ? 'bg-green-800 text-white shadow-2xs'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            Todos ({definitions.length})
          </button>
          {PILLARS.map((pillar) => {
            const count = definitions.filter((d) => pillar.categories.includes(String(d.category))).length
            if (count === 0) return null
            const isActive = selectedPillar === pillar.id
            return (
              <button
                key={pillar.id}
                type="button"
                onClick={() => setSelectedPillar(pillar.id)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                <pillar.icon className="h-3.5 w-3.5" />
                {pillar.title.split('&')[0].trim()} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Pillars and Sections */}
      {PILLARS.map((pillar) => {
        const pillarItems = filteredDefinitions.filter((def) =>
          pillar.categories.includes(String(def.category)),
        )
        if (pillarItems.length === 0) return null

        return (
          <section key={pillar.id} className="space-y-4">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 pb-3">
              <div className="flex items-center gap-3">
                <div className={`rounded-xl p-2.5 ring-1 ${pillar.colorBg}`}>
                  <pillar.icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-neutral-900">{pillar.title}</h2>
                  <p className="text-xs text-neutral-500">{pillar.subtitle}</p>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${pillar.colorBadge}`}>
                {pillarItems.length} {pillarItems.length === 1 ? 'modelo' : 'modelos'}
              </span>
            </header>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {pillarItems.map((def) => (
                <DefinitionCard
                  key={def.code}
                  definition={def}
                  pillar={pillar}
                  onOpen={() => navigate(`/relatorios/${def.code}`)}
                />
              ))}
            </div>
          </section>
        )
      })}

      {filteredDefinitions.length === 0 && (
        <EmptyState
          icon={<Search className="h-8 w-8" />}
          title="Nenhum laudo encontrado"
          description={`Não encontramos nenhum modelo de laudo correspondente à busca "${search}".`}
        />
      )}
    </div>
  )
}

interface DefinitionCardProps {
  definition: ReportDefinition
  pillar: PillarDefinition
  onOpen: () => void
}

function DefinitionCard({ definition, pillar, onOpen }: DefinitionCardProps) {
  const Icon: LucideIcon =
    (definition.icon ? ICON_MAP[definition.icon] : undefined) ?? pillar.icon ?? FileText
  const summary = definition.subtitle?.trim() || definition.description
  const retentionLabel = formatRetention(definition.retentionDays)

  return (
    <Card
      className="group relative flex h-full flex-col justify-between overflow-hidden border border-neutral-200/90 p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-green-800/40 hover:shadow-lg bg-white"
      onClick={onOpen}
      role="button"
      aria-label={`Abrir laudo ${definition.name}`}
    >
      <div className="space-y-4">
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-[11px] font-bold text-neutral-700">
            {definition.code}
          </span>
          {definition.signatureRequired ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-800 ring-1 ring-purple-200/60">
              <ShieldCheck className="h-3 w-3" /> Assinatura RT
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200/60">
              <CheckCircle2 className="h-3 w-3" /> Pronto p/ Uso
            </span>
          )}
        </div>

        {/* Title & Description */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-2xl bg-neutral-50 p-2.5 text-neutral-800 ring-1 ring-neutral-200 transition-colors group-hover:bg-green-100 group-hover:text-green-900 group-hover:ring-green-300">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-snug text-neutral-900 group-hover:text-green-900 transition-colors">
              {definition.name}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-600">{summary}</p>
          </div>
        </div>

        {/* Legal basis box */}
        <div className="rounded-xl bg-neutral-50/80 p-2.5 text-[11px] text-neutral-500 border border-neutral-100">
          <span className="font-semibold text-neutral-700">Base Normativa: </span>
          <span className="line-clamp-1">{definition.legalBasis}</span>
        </div>
      </div>

      {/* Footer Meta & Action */}
      <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-3">
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1 font-medium text-neutral-700">
            {definition.supportedFormats.join(' · ')}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3 text-neutral-400" />
            {retentionLabel}
          </span>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-green-800 transition-transform group-hover:translate-x-1">
          Configurar e Emitir
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Card>
  )
}

function formatRetention(days: number): string {
  if (!days || days <= 0) return 'Permanente'
  if (days < 30) return `${days} dias`
  if (days < 365) {
    const months = Math.round(days / 30)
    return `${months} ${months === 1 ? 'mês' : 'meses'}`
  }
  const years = Math.round((days / 365) * 10) / 10
  const rounded = Number.isInteger(years) ? years.toFixed(0) : years.toFixed(1)
  return `${rounded} ${years === 1 ? 'ano' : 'anos'}`
}

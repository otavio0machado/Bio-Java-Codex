import {
  AlertTriangle,
  ArrowRight,
  Beaker,
  Crosshair,
  FileCheck2,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReportDefinition } from '../../types/reportsV2'
import { Button, Card, EmptyState, Input, Select } from '../ui'

interface ReportCatalogGridProps {
  definitions: ReportDefinition[]
}

const CATEGORY_NAMES: Record<string, string> = {
  CONTROLE_QUALIDADE: 'Controle de Qualidade',
  WESTGARD: 'Análise Westgard',
  REAGENTES: 'Reagentes & Estoque',
  MANUTENCAO: 'Manutenção de Equipamentos',
  CALIBRACAO: 'Eficácia de Calibração',
  CONSOLIDADO: 'Visão Multi-Área',
  REGULATORIO: 'Regulatório & Auditoria',
  HEMATOLOGIA: 'Hematologia',
}

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
  const [categoryFilter, setCategoryFilter] = useState<string>('todas')

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const def of definitions) {
      set.add(String(def.category))
    }
    return Array.from(set)
  }, [definitions])

  const filtered = useMemo(() => {
    return definitions.filter((def) => {
      const matchesCategory =
        categoryFilter === 'todas' || String(def.category) === categoryFilter

      const query = search.trim().toLowerCase()
      const matchesSearch =
        !query ||
        def.name.toLowerCase().includes(query) ||
        def.code.toLowerCase().includes(query) ||
        def.description.toLowerCase().includes(query) ||
        def.legalBasis.toLowerCase().includes(query)

      return matchesCategory && matchesSearch
    })
  }, [definitions, search, categoryFilter])

  if (definitions.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-8 w-8" />}
        title="Nenhum relatório disponível"
        description="Seu perfil de acesso ainda não possui relatórios homologados cadastrados. Contate a administração do laboratório."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Barra de Filtros no Padrão do Sistema */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-[1fr_220px]">
          <Input
            placeholder="Buscar por nome, código, norma ou objetivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="todas">Todas as categorias</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_NAMES[cat] ?? cat}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Grid de Cards de Relatório */}
      {filtered.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((def) => {
            const Icon = (def.icon ? ICON_MAP[def.icon] : undefined) ?? FileText
            const categoryLabel = CATEGORY_NAMES[String(def.category)] ?? String(def.category)

            return (
              <Card
                key={def.code}
                className="flex flex-col justify-between p-6 transition-shadow hover:shadow-elevated cursor-pointer space-y-4"
                onClick={() => navigate(`/relatorios/${def.code}`)}
              >
                <div className="space-y-3">
                  {/* Top line with Category & Code */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-500 uppercase tracking-wider">
                      {categoryLabel}
                    </span>
                    <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[11px] font-medium text-neutral-600">
                      {def.code}
                    </span>
                  </div>

                  {/* Title and Icon */}
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-green-50 p-2.5 text-green-800 ring-1 ring-green-100 shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900 leading-snug">
                        {def.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                        {def.subtitle?.trim() || def.description}
                      </p>
                    </div>
                  </div>

                  {/* Metadata and Compliance */}
                  <div className="space-y-2 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Base Normativa:</span>
                      <span className="font-medium text-neutral-800 line-clamp-1">{def.legalBasis}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Retenção:</span>
                      <span className="font-medium text-neutral-800">{formatRetention(def.retentionDays)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer with Action */}
                <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
                  {def.signatureRequired ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="h-3 w-3" /> Assinatura RT
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-500">
                      Formato: {def.supportedFormats.join(', ')}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<ArrowRight className="h-3.5 w-3.5" />}
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/relatorios/${def.code}`)
                    }}
                  >
                    Gerar
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Search className="h-8 w-8" />}
          title="Nenhum laudo encontrado"
          description={`Nenhum modelo corresponde aos critérios de pesquisa informados.`}
        />
      )}
    </div>
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

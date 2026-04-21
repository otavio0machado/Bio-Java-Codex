import {
  ArrowRight,
  FileText,
  FlaskConical,
  FlaskRound,
  HeartPulse,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ReportCategory, ReportDefinition } from '../../types/reportsV2'
import { Button, Card, EmptyState } from '../ui'

interface ReportCatalogGridProps {
  definitions: ReportDefinition[]
}

const CATEGORY_LABEL: Record<string, string> = {
  CONTROLE_QUALIDADE: 'Controle de Qualidade',
  REAGENTES: 'Reagentes',
  MANUTENCAO: 'Manutencao',
  HEMATOLOGIA: 'Hematologia',
}

const CATEGORY_ICON: Record<string, LucideIcon> = {
  CONTROLE_QUALIDADE: FlaskConical,
  REAGENTES: FlaskRound,
  MANUTENCAO: Wrench,
  HEMATOLOGIA: HeartPulse,
}

const CATEGORY_ORDER: ReportCategory[] = [
  'CONTROLE_QUALIDADE',
  'REAGENTES',
  'MANUTENCAO',
  'HEMATOLOGIA',
]

export function ReportCatalogGrid({ definitions }: ReportCatalogGridProps) {
  const navigate = useNavigate()

  if (definitions.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-8 w-8" />}
        title="Nenhum relatorio disponivel"
        description="Seu perfil ainda nao tem nenhum relatorio V2 liberado. Fale com o administrador do laboratorio."
      />
    )
  }

  // Agrupa por categoria preservando a ordem definida. Categorias novas
  // (nao mapeadas) vao ao fim na ordem em que aparecerem.
  const groups = new Map<string, ReportDefinition[]>()
  for (const def of definitions) {
    const category = String(def.category)
    if (!groups.has(category)) groups.set(category, [])
    groups.get(category)!.push(def)
  }
  const orderedCategories: string[] = [
    ...CATEGORY_ORDER.filter((c) => groups.has(c)),
    ...Array.from(groups.keys()).filter((c) => !CATEGORY_ORDER.includes(c as ReportCategory)),
  ]

  return (
    <div className="space-y-10">
      {orderedCategories.map((category) => {
        const items = groups.get(category) ?? []
        const Icon = CATEGORY_ICON[category] ?? FileText
        const label = CATEGORY_LABEL[category] ?? category
        return (
          <section key={category} className="space-y-4">
            <header className="flex items-center gap-3">
              <div className="rounded-xl bg-green-100 p-2 text-green-800">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-neutral-900">{label}</h2>
              <span className="text-sm text-neutral-500">{items.length} disponivel{items.length > 1 ? 'is' : ''}</span>
            </header>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((def) => (
                <DefinitionCard
                  key={def.code}
                  definition={def}
                  onOpen={() => navigate(`/relatorios/${def.code}`)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

interface DefinitionCardProps {
  definition: ReportDefinition
  onOpen: () => void
}

function DefinitionCard({ definition, onOpen }: DefinitionCardProps) {
  const Icon = CATEGORY_ICON[String(definition.category)] ?? FileText
  return (
    <Card
      className="flex flex-col gap-4"
      onClick={onOpen}
      role="button"
      aria-label={`Abrir relatorio ${definition.name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-neutral-100 p-3 text-neutral-700">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-neutral-900">{definition.name}</h3>
            <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{definition.description}</p>
          </div>
        </div>
        {definition.signatureRequired ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            <ShieldCheck className="h-3 w-3" />
            Assinatura
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {definition.supportedFormats.map((format) => (
          <span
            key={format}
            className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-xs font-medium text-neutral-700"
          >
            {format}
          </span>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="text-xs text-neutral-500">Retencao: {definition.retentionDays} dias</span>
        <Button
          size="sm"
          onClick={(event) => {
            event.stopPropagation()
            onOpen()
          }}
          icon={<ArrowRight className="h-4 w-4" />}
        >
          Gerar
        </Button>
      </div>
    </Card>
  )
}

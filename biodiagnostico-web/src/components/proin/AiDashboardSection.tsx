import { Activity, ListChecks, Package, Sparkles, Wrench } from 'lucide-react'
import { usePriorities, useDashboardSummary } from '../../hooks/useAiAssist'
import type { PriorityCategory, PriorityItem, PriorityUrgency } from '../../types'
import { Button, Card } from '../ui'
import { AiAssistDisclaimer, AiAssistResult } from './AiAssistShared'

/**
 * Onda 3 — bloco assistivo de IA do dashboard. Agrupa C9 (resumo executivo) e
 * D12 (prioridades). Ambos sao read-only e geram sob clique do operador (sem
 * gasto de IA no load da pagina). Nao alteram nenhuma regra de CQ; sao apoio a
 * decisao. O dashboard atual nao tem contexto de area/periodo, entao usamos os
 * defaults do backend (visao geral, janela padrao).
 */
export function AiDashboardSection() {
  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <ExecutiveSummaryCard />
      <PrioritiesCard />
    </section>
  )
}

/** C9 — Resumo executivo (IA) do dashboard. */
function ExecutiveSummaryCard() {
  const summary = useDashboardSummary()
  const generated = summary.isPending || summary.isError || summary.data != null

  return (
    <Card className="animate-fadeIn">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-violet-100 p-2.5 text-violet-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">Resumo executivo (IA)</h3>
            <p className="text-base text-neutral-500">Visão geral do período em linguagem natural</p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Sparkles className="h-4 w-4 text-violet-500" />}
          onClick={() => {
            if (summary.isPending) return
            summary.mutate({})
          }}
          loading={summary.isPending}
        >
          {summary.data != null ? 'Atualizar resumo' : 'Gerar resumo'}
        </Button>
      </div>

      {generated ? (
        <AiAssistResult
          isPending={summary.isPending}
          isError={summary.isError}
          text={summary.data ?? null}
          loadingLabel="Gerando resumo executivo com IA..."
          errorLabel="Não foi possível gerar o resumo agora. Tente novamente."
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 px-5 py-8 text-center">
          <p className="text-base text-neutral-600">
            Clique em <span className="font-semibold">Gerar resumo</span> para uma síntese dos
            indicadores, alertas e registros recentes.
          </p>
          <AiAssistDisclaimer className="mt-3 justify-center" />
        </div>
      )}
    </Card>
  )
}

/** D12 — Prioridades (itens determinísticos + recomendação da IA). */
function PrioritiesCard() {
  const priorities = usePriorities()
  const data = priorities.data
  const generated = priorities.isPending || priorities.isError || data != null

  return (
    <Card className="animate-fadeIn">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-violet-100 p-2.5 text-violet-600">
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">Prioridades</h3>
            <p className="text-base text-neutral-500">O que merece atenção primeiro</p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Sparkles className="h-4 w-4 text-violet-500" />}
          onClick={() => {
            if (priorities.isPending) return
            priorities.mutate(undefined)
          }}
          loading={priorities.isPending}
        >
          {data != null ? 'Reanalisar' : 'Analisar prioridades'}
        </Button>
      </div>

      {!generated ? (
        <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 px-5 py-8 text-center">
          <p className="text-base text-neutral-600">
            Clique em <span className="font-semibold">Analisar prioridades</span> para listar
            reagentes, manutenções e CQ que pedem ação, com recomendação da IA.
          </p>
          <AiAssistDisclaimer className="mt-3 justify-center" />
        </div>
      ) : priorities.isPending ? (
        <AiAssistResult
          isPending
          isError={false}
          text={null}
          loadingLabel="Analisando prioridades com IA..."
        />
      ) : priorities.isError ? (
        <AiAssistResult
          isPending={false}
          isError
          text={null}
          errorLabel="Não foi possível analisar as prioridades agora. Tente novamente."
        />
      ) : (
        <div className="space-y-4">
          {data && data.items.length > 0 ? (
            <ul className="space-y-2">
              {data.items.map((item, index) => (
                <PriorityRow key={index} item={item} />
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-6 text-center text-base text-green-800">
              Sem prioridades no momento.
            </div>
          )}

          {/* Recomendacao textual da IA (degradacao graciosa: pode vir vazia). */}
          {data && data.recommendation.trim() ? (
            <AiAssistResult isPending={false} isError={false} text={data.recommendation} />
          ) : null}
        </div>
      )}
    </Card>
  )
}

function PriorityRow({ item }: { item: PriorityItem }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-neutral-200 px-4 py-3">
      <div className="mt-0.5 shrink-0 rounded-lg bg-neutral-100 p-1.5 text-neutral-600">
        <PriorityCategoryIcon category={item.category} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-base font-semibold text-neutral-900">{item.title}</span>
          <PriorityUrgencyBadge urgency={item.urgency} />
        </div>
        <p className="mt-0.5 text-sm text-neutral-600">{item.detail}</p>
        <p className="mt-0.5 text-xs uppercase tracking-wide text-neutral-400">
          {categoryLabel(item.category)}
        </p>
      </div>
    </li>
  )
}

/**
 * D12 — paleta de urgencia. Espelha o contrato do backend (ALTA=vermelho,
 * MEDIA=ambar, BAIXA=neutro); valor desconhecido cai no neutro. So apresentacao:
 * nao reordena nem recalcula urgencia (a lista ja vem ranqueada do backend).
 */
const URGENCY_STYLES: Record<string, { badge: string; label: string }> = {
  ALTA: { badge: 'bg-red-100 text-red-800', label: 'Alta' },
  MEDIA: { badge: 'bg-amber-100 text-amber-800', label: 'Média' },
  BAIXA: { badge: 'bg-neutral-100 text-neutral-600', label: 'Baixa' },
}

function PriorityUrgencyBadge({ urgency }: { urgency: PriorityUrgency | string }) {
  const style = URGENCY_STYLES[urgency] ?? { badge: 'bg-neutral-100 text-neutral-600', label: urgency }
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>
      {style.label}
    </span>
  )
}

/** Icone por categoria de item priorizado (D12). Reagente, manutencao e CQ. */
function PriorityCategoryIcon({ category }: { category: PriorityCategory | string }) {
  const className = 'h-4 w-4'
  if (category === 'REAGENTE') return <Package className={className} />
  if (category === 'MANUTENCAO') return <Wrench className={className} />
  if (category === 'CQ') return <Activity className={className} />
  return <Sparkles className={className} />
}

const CATEGORY_LABELS: Record<string, string> = {
  REAGENTE: 'Reagente',
  MANUTENCAO: 'Manutenção',
  CQ: 'Controle de qualidade',
}

function categoryLabel(category: PriorityCategory | string): string {
  return CATEGORY_LABELS[category] ?? category
}

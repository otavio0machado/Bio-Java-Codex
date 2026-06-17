import { Activity, ListChecks, Package, Sparkles, TrendingUp, Wrench } from 'lucide-react'
import { useDriftDetection, usePriorities, useDashboardSummary } from '../../hooks/useAiAssist'
import type {
  DriftAlert,
  PriorityCategory,
  PriorityItem,
  PriorityUrgency,
} from '../../types'
import { Button, Card } from '../ui'
import { AiAssistDisclaimer, AiAssistResult } from './AiAssistShared'

/**
 * Onda 3 — bloco assistivo de IA do dashboard. Agrupa C9 (resumo executivo),
 * D12 (prioridades) e D11 (deteccao preventiva de drift). Todos sao read-only e
 * geram sob clique do operador (sem gasto de IA no load da pagina). Nao alteram
 * nenhuma regra de CQ; sao apoio a decisao. O dashboard atual nao tem contexto
 * de area/periodo, entao usamos os defaults do backend (visao geral, janela
 * padrao — 14 dias para o drift).
 */
export function AiDashboardSection() {
  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-2">
        <ExecutiveSummaryCard />
        <PrioritiesCard />
      </section>
      {/* D11 — deteccao preventiva de drift (sob demanda, read-only). */}
      <DriftDetectionCard />
    </div>
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

/**
 * D11 — Detecao preventiva de drift (IA interpreta candidatos deterministicos).
 *
 * ALERTA PREVENTIVO: lista series que AINDA NAO violaram a regra de rejeicao
 * Westgard mas mostram tendencia/sequencia. So apresentacao: nao reclassifica
 * padrao/severidade nem recalcula nada — a deteccao e do backend. Geracao sob
 * clique (sem custo de IA no load). Lista vazia = controles estaveis.
 */
function DriftDetectionCard() {
  const drift = useDriftDetection()
  const data = drift.data
  const generated = drift.isPending || drift.isError || data != null

  return (
    <Card className="animate-fadeIn">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-violet-100 p-2.5 text-violet-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">Tendências / Detecção de drift</h3>
            <p className="text-base text-neutral-500">
              Alerta preventivo de séries que ainda não violaram Westgard
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Sparkles className="h-4 w-4 text-violet-500" />}
          onClick={() => {
            if (drift.isPending) return
            drift.mutate({})
          }}
          loading={drift.isPending}
        >
          {data != null ? 'Verificar novamente' : 'Verificar tendências'}
        </Button>
      </div>

      {!generated ? (
        <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 px-5 py-8 text-center">
          <p className="text-base text-neutral-600">
            Clique em <span className="font-semibold">Verificar tendências</span> para detectar
            derivas e sequências nas séries de CQ <span className="font-semibold">antes</span> de
            violarem a regra de rejeição — um alerta preventivo para revisão antecipada.
          </p>
          <AiAssistDisclaimer className="mt-3 justify-center" />
        </div>
      ) : drift.isPending ? (
        <AiAssistResult
          isPending
          isError={false}
          text={null}
          loadingLabel="Analisando tendências das séries de CQ com IA..."
        />
      ) : drift.isError ? (
        <AiAssistResult
          isPending={false}
          isError
          text={null}
          errorLabel="Não foi possível verificar as tendências agora. Tente novamente."
        />
      ) : data && data.alerts.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            Séries com tendência ou sequência atípica que <span className="font-semibold">ainda
            não</span> violaram a regra de rejeição. Reveja preventivamente — o status oficial de
            CQ não muda.
          </p>
          <ul className="space-y-2">
            {data.alerts.map((alert, index) => (
              <DriftAlertRow key={index} alert={alert} />
            ))}
          </ul>
          <AiAssistDisclaimer />
        </div>
      ) : (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-6 text-center text-base text-green-800">
          Nenhuma tendência de drift detectada — controles estáveis.
        </div>
      )}
    </Card>
  )
}

/**
 * D11 — uma linha de alerta de drift. Mostra exame + nivel, badge de severidade,
 * rotulo do padrao e a interpretacao da IA ({@code detail}). O {@code detail}
 * pode vir vazio (degradacao graciosa): nesse caso so o cabecalho e exibido.
 */
function DriftAlertRow({ alert }: { alert: DriftAlert }) {
  return (
    <li className="rounded-2xl border border-neutral-200 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-base font-semibold text-neutral-900">{alert.examName}</span>
          <span className="ml-2 text-sm text-neutral-500">Nível {alert.level}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DriftPatternBadge pattern={alert.pattern} />
          <DriftSeverityBadge severity={alert.severity} />
        </div>
      </div>
      {alert.detail.trim() ? (
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
          {alert.detail}
        </p>
      ) : null}
    </li>
  )
}

/**
 * D11 — paleta de severidade do drift. Espelha o contrato do backend
 * (ALTA=vermelho, MEDIA=ambar, BAIXA=neutro); valor desconhecido cai no neutro.
 * So apresentacao: nao recalcula severidade (ja vem do backend).
 */
const DRIFT_SEVERITY_STYLES: Record<string, { badge: string; label: string }> = {
  ALTA: { badge: 'bg-red-100 text-red-800', label: 'Alta' },
  MEDIA: { badge: 'bg-amber-100 text-amber-800', label: 'Média' },
  BAIXA: { badge: 'bg-neutral-100 text-neutral-600', label: 'Baixa' },
}

function DriftSeverityBadge({ severity }: { severity: string }) {
  const style =
    DRIFT_SEVERITY_STYLES[severity] ?? { badge: 'bg-neutral-100 text-neutral-600', label: severity }
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>
      {style.label}
    </span>
  )
}

/**
 * D11 — rotulo legivel do padrao de drift. Espelha o contrato do backend
 * (DRIFT_UP/DRIFT_DOWN/SHIFT/RUN); padrao desconhecido exibe o valor cru.
 */
const DRIFT_PATTERN_LABELS: Record<string, string> = {
  DRIFT_UP: 'Deriva ascendente',
  DRIFT_DOWN: 'Deriva descendente',
  SHIFT: 'Degrau',
  RUN: 'Sequência',
}

function DriftPatternBadge({ pattern }: { pattern: string }) {
  const label = DRIFT_PATTERN_LABELS[pattern] ?? pattern
  return (
    <span className="inline-flex shrink-0 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
      {label}
    </span>
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

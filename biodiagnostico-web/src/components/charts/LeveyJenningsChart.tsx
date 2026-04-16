import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useLeveyJennings } from '../../hooks/useQcRecords'
import type { LeveyJenningsPoint } from '../../types'
import { Card, EmptyState, Skeleton, StatusBadge } from '../ui'
import { Activity } from 'lucide-react'

interface LeveyJenningsChartProps {
  examName: string
  level: string
  area: string
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartPoint }>
}) {
  if (!active || !payload?.length) {
    return null
  }

  const data = payload[0]?.payload as ChartPoint
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg">
      <div className="text-sm font-semibold text-neutral-900">{formatDate(data.date)}</div>
      <div className="mt-3 space-y-1 text-sm text-neutral-600">
        <div>Valor: <strong>{data.value.toFixed(2)}</strong></div>
        <div>Alvo: {data.target.toFixed(2)}</div>
        <div>DP: ±{data.sd.toFixed(2)}</div>
        <div>Z-Score: {data.zScore.toFixed(2)}</div>
        <div className="pt-1"><StatusBadge status={data.status} /></div>
      </div>
    </div>
  )
}

interface ChartPoint extends LeveyJenningsPoint {
  upper1sd: number
  lower1sd: number
}

export function LeveyJenningsChart({ examName, level, area }: LeveyJenningsChartProps) {
  const { data, isLoading } = useLeveyJennings(examName, level, area)

  if (isLoading) {
    return <Skeleton height="24rem" />
  }

  if (!data?.length) {
    return (
      <EmptyState
        icon={<Activity className="h-8 w-8" />}
        title="Sem dados para o gráfico"
        description="Selecione um exame e um nível que já possuam registros de CQ para visualizar a curva de Levey-Jennings."
      />
    )
  }

  const chartData: ChartPoint[] = data.map((point) => ({
    ...point,
    upper1sd: point.target + point.sd,
    lower1sd: point.target - point.sd,
  }))

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Levey-Jennings</h3>
          <p className="text-sm text-neutral-500">
            {examName} · {level} · {area}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Curva baseada nos últimos 30 registros canônicos de CQ. Faixas de referência acompanham cada registro individualmente.
          </p>
        </div>
      </div>
      <div className="h-[26rem] w-full overflow-x-auto">
        <div className="min-w-[720px] h-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />

              {/* Faixa ±3SD (vermelha) */}
              <Area type="monotone" dataKey="upper3sd" stroke="none" fill="#fee2e2" fillOpacity={0.25} isAnimationActive={false} dot={false} activeDot={false} legendType="none" />
              <Area type="monotone" dataKey="lower3sd" stroke="none" fill="#ffffff" fillOpacity={1} isAnimationActive={false} dot={false} activeDot={false} legendType="none" />

              {/* Faixa ±2SD (amarela) */}
              <Area type="monotone" dataKey="upper2sd" stroke="none" fill="#fef3c7" fillOpacity={0.35} isAnimationActive={false} dot={false} activeDot={false} legendType="none" />
              <Area type="monotone" dataKey="lower2sd" stroke="none" fill="#ffffff" fillOpacity={1} isAnimationActive={false} dot={false} activeDot={false} legendType="none" />

              {/* Faixa ±1SD (verde) */}
              <Area type="monotone" dataKey="upper1sd" stroke="none" fill="#dcfce7" fillOpacity={0.45} isAnimationActive={false} dot={false} activeDot={false} legendType="none" />
              <Area type="monotone" dataKey="lower1sd" stroke="none" fill="#ffffff" fillOpacity={1} isAnimationActive={false} dot={false} activeDot={false} legendType="none" />

              {/* Linhas de referência dinâmicas por ponto */}
              <Line type="monotone" dataKey="target" stroke="#16a34a" strokeDasharray="5 5" strokeWidth={1} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="upper2sd" stroke="#eab308" strokeDasharray="5 5" strokeWidth={1} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="lower2sd" stroke="#eab308" strokeDasharray="5 5" strokeWidth={1} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="upper3sd" stroke="#dc2626" strokeDasharray="5 5" strokeWidth={1} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="lower3sd" stroke="#dc2626" strokeDasharray="5 5" strokeWidth={1} dot={false} isAnimationActive={false} />

              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />

              {/* Linha de valores medidos */}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2}
                dot={(props) => {
                  const payload = props.payload as ChartPoint
                  const fill =
                    payload.status === 'REPROVADO'
                      ? '#dc2626'
                      : payload.status === 'ALERTA'
                        ? '#ea580c'
                        : '#16a34a'
                  return <circle cx={props.cx} cy={props.cy} r={5} fill={fill} stroke="#fff" strokeWidth={2} />
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  )
}

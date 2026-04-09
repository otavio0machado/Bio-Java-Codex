import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
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
  payload?: Array<{ payload: LeveyJenningsPoint }>
}) {
  if (!active || !payload?.length) {
    return null
  }

  const data = payload[0]?.payload as LeveyJenningsPoint
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg">
      <div className="text-sm font-semibold text-neutral-900">{formatDate(data.date)}</div>
      <div className="mt-3 space-y-1 text-sm text-neutral-600">
        <div>Valor: <strong>{data.value.toFixed(2)}</strong></div>
        <div>Alvo: {data.target.toFixed(2)}</div>
        <div>Z-Score: {data.zScore.toFixed(2)}</div>
        <div className="pt-1"><StatusBadge status={data.status} /></div>
      </div>
    </div>
  )
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

  const first = data[0]
  const target = first.target
  const upper1 = target + first.sd
  const lower1 = target - first.sd
  const upper2 = first.upper2sd
  const lower2 = first.lower2sd
  const upper3 = first.upper3sd
  const lower3 = first.lower3sd

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Levey-Jennings</h3>
          <p className="text-sm text-neutral-500">
            {examName} · {level} · {area}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Curva baseada nos ultimos 30 registros canonicos de CQ. Pos-calibracoes nao sao adicionadas como novos pontos.
          </p>
        </div>
      </div>
      <div className="h-[26rem] w-full overflow-x-auto">
        <div className="min-w-[720px] h-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
              <ReferenceArea y1={lower3} y2={upper3} fill="#fee2e2" fillOpacity={0.25} />
              <ReferenceArea y1={lower2} y2={upper2} fill="#fef3c7" fillOpacity={0.35} />
              <ReferenceArea y1={lower1} y2={upper1} fill="#dcfce7" fillOpacity={0.45} />
              <ReferenceLine y={target} stroke="#16a34a" strokeDasharray="5 5" />
              <ReferenceLine y={upper2} stroke="#eab308" strokeDasharray="5 5" />
              <ReferenceLine y={lower2} stroke="#eab308" strokeDasharray="5 5" />
              <ReferenceLine y={upper3} stroke="#dc2626" strokeDasharray="5 5" />
              <ReferenceLine y={lower3} stroke="#dc2626" strokeDasharray="5 5" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2}
                dot={(props) => {
                  const payload = props.payload as LeveyJenningsPoint
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

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Thermometer } from 'lucide-react'
import type { TemperatureLocation, TemperatureRecord } from '../../types/temperature'
import { Card, EmptyState } from '../ui'
import { formatShortBR } from '../../utils/date'

interface TemperatureChartProps {
  location?: TemperatureLocation
  records: TemperatureRecord[]
  month: number
  year: number
}

export function TemperatureChart({ location, records, month, year }: TemperatureChartProps) {
  if (!location) {
    return (
      <Card className="p-8 text-center text-neutral-500">
        Selecione um ponto de monitoramento para visualizar o gráfico térmico.
      </Card>
    )
  }

  // Ordena por data crescente
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))

  const chartData = sorted.map((r) => ({
    date: r.date,
    formattedDate: formatShortBR(r.date),
    tempMax: r.tempMax,
    tempMin: r.tempMin,
    tempCurrent: r.tempCurrent,
    minTarget: location.minTempTarget,
    maxTarget: location.maxTempTarget,
    status: r.status,
    responsible: r.responsible,
  }))

  if (chartData.length === 0) {
    return (
      <Card className="p-8">
        <EmptyState
          icon={<Thermometer className="h-8 w-8 text-neutral-400" />}
          title="Sem medições no período"
          description={`Nenhum registro de temperatura encontrado para ${location.name} no mês ${month}/${year}.`}
        />
      </Card>
    )
  }

  // Define domínio do eixo Y com folga
  const allTemps = sorted.flatMap((r) => [r.tempMin, r.tempMax, r.tempCurrent].filter((v): v is number => v !== null && v !== undefined))
  allTemps.push(location.minTempTarget, location.maxTempTarget)
  const minVal = Math.floor(Math.min(...allTemps) - 1)
  const maxVal = Math.ceil(Math.max(...allTemps) + 1)

  return (
    <Card className="space-y-4">
      <div className="flex flex-col justify-between gap-2 border-b border-neutral-100 pb-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">
            Curva de Controle Térmico — {location.name}
          </h3>
          <p className="text-xs text-neutral-500">
            Faixa Aceitável: <strong>{location.minTempTarget}°C a {location.maxTempTarget}°C</strong> | Termômetro: {location.thermometerCode || 'Padrão'}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-neutral-600">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span>Temp. Máxima</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
            <span>Temp. Mínima</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            <span>Limites Alvo</span>
          </div>
        </div>
      </div>

      <div className="mt-6 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="formattedDate"
              stroke="#6b7280"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[minVal, maxVal]}
              stroke="#6b7280"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              unit="°C"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload
                const isAlert = d.status === 'NAO_CONFORME'
                return (
                  <div className="rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-xl text-xs">
                    <p className="font-bold text-neutral-900">{formatShortBR(d.date)}</p>
                    <div className="mt-2 space-y-1 text-neutral-700">
                      <p>Máxima: <strong className="text-rose-600">{d.tempMax}°C</strong></p>
                      <p>Mínima: <strong className="text-sky-600">{d.tempMin}°C</strong></p>
                      {d.tempCurrent !== null && <p>Ambiente: <strong>{d.tempCurrent}°C</strong></p>}
                      <p className="text-neutral-500">Resp: {d.responsible}</p>
                      <p className="pt-1">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isAlert ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {d.status}
                        </span>
                      </p>
                    </div>
                  </div>
                )
              }}
            />
            {/* Linhas de Referência de Limite */}
            <ReferenceLine
              y={location.maxTempTarget}
              stroke="#059669"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: `Máx ${location.maxTempTarget}°C`, fill: '#059669', fontSize: 10, position: 'insideTopRight' }}
            />
            <ReferenceLine
              y={location.minTempTarget}
              stroke="#059669"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: `Mín ${location.minTempTarget}°C`, fill: '#059669', fontSize: 10, position: 'insideBottomRight' }}
            />

            {/* Linhas de Máxima e Mínima */}
            <Line
              type="monotone"
              dataKey="tempMax"
              stroke="#f43f5e"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#f43f5e' }}
              activeDot={{ r: 6 }}
              name="Temp. Máxima"
            />
            <Line
              type="monotone"
              dataKey="tempMin"
              stroke="#0ea5e9"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#0ea5e9' }}
              activeDot={{ r: 6 }}
              name="Temp. Mínima"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

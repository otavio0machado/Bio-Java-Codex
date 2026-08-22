import {
  CheckCircle2,
  Pencil,
  Plus,
  ShieldAlert,
  Thermometer,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  useDeleteTemperatureLocation,
  useTemperatureLocations,
} from '../../hooks/useTemperature'
import type { TemperatureLocation } from '../../types/temperature'
import { Button, Card, EmptyState, useToast } from '../ui'
import { formatShortBR } from '../../utils/date'

interface TemperatureLocationsTableProps {
  onNewLocation: () => void
  onEditLocation: (location: TemperatureLocation) => void
}

export function TemperatureLocationsTable({
  onNewLocation,
  onEditLocation,
}: TemperatureLocationsTableProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const isAdmin = user?.role === 'ADMIN'

  const { data: locations, isLoading } = useTemperatureLocations()
  const deleteLocation = useDeleteTemperatureLocation()

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Deseja realmente excluir o ponto de monitoramento "${name}" e todos os seus históricos?`)) {
      deleteLocation.mutate(id, {
        onSuccess: () => {
          toast.success('Ponto de monitoramento excluído.')
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || 'Falha ao excluir ponto de monitoramento.')
        },
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">
            Pontos de Monitoramento & Cadeia de Frio
          </h3>
          <p className="text-xs text-neutral-500">
            Geladeiras de reagentes, freezers de amostras, estufas bacteriológicas e salas técnicas.
          </p>
        </div>

        {isAdmin && (
          <Button onClick={onNewLocation} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Novo Equipamento
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Código / Nome</th>
                <th className="px-4 py-3.5">Categoria / Setor</th>
                <th className="px-4 py-3.5 text-right">Faixa Temp. Alvo</th>
                <th className="px-4 py-3.5 text-right">Faixa Umidade</th>
                <th className="px-4 py-3.5">Termômetro & Certificado</th>
                <th className="px-4 py-3.5 text-center">Calibração RBC</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                {isAdmin && <th className="px-4 py-3.5 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="p-8 text-center text-neutral-500">
                    Carregando equipamentos...
                  </td>
                </tr>
              ) : locations && locations.length > 0 ? (
                locations.map((loc) => {
                  let isCalibExpiring = false
                  if (loc.calibrationDueDate) {
                    const due = new Date(loc.calibrationDueDate)
                    const diffDays = (due.getTime() - new Date().getTime()) / (1000 * 3600 * 24)
                    if (diffDays <= 30) {
                      isCalibExpiring = true
                    }
                  }

                  return (
                    <tr key={loc.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-neutral-900">
                        <div>{loc.name}</div>
                        <div className="text-xs font-mono text-neutral-500">{loc.code}</div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="inline-flex rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                          {loc.category}
                        </span>
                        <div className="mt-0.5 text-xs text-neutral-500">{loc.area}</div>
                      </td>

                      <td className="px-4 py-3.5 text-right font-semibold text-emerald-700">
                        {loc.minTempTarget}°C a {loc.maxTempTarget}°C
                      </td>

                      <td className="px-4 py-3.5 text-right text-neutral-600">
                        {loc.minHumidityTarget != null && loc.maxHumidityTarget != null
                          ? `${loc.minHumidityTarget}% a ${loc.maxHumidityTarget}%`
                          : '-'}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-xs text-neutral-800 font-medium">
                          {loc.thermometerCode || 'Sensor Padrão'}
                        </div>
                        {loc.calibrationCertNumber && (
                          <div className="text-xs text-neutral-500">
                            Cert: {loc.calibrationCertNumber}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {loc.calibrationDueDate ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isCalibExpiring
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isCalibExpiring ? (
                              <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            )}
                            {formatShortBR(loc.calibrationDueDate)}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400">Não informada</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            loc.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-neutral-100 text-neutral-600'
                          }`}
                        >
                          {loc.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      {isAdmin && (
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onEditLocation(loc)}
                              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                              title="Editar Ponto"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(loc.id, loc.name)}
                              className="rounded-lg p-1.5 text-neutral-500 hover:bg-rose-50 hover:text-rose-600"
                              title="Excluir Ponto"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="p-8">
                    <EmptyState
                      icon={<Thermometer className="h-8 w-8 text-neutral-400" />}
                      title="Nenhum ponto cadastrado"
                      description="Cadastre as geladeiras, freezers e ambientes do laboratório."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

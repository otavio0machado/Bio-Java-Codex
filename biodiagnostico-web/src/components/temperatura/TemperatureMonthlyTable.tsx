import {
  Image as ImageIcon,
  Pencil,
  Thermometer,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useDeleteTemperatureRecord } from '../../hooks/useTemperature'
import type { TemperatureRecord } from '../../types/temperature'
import { Button, Card, EmptyState, Modal, StatusBadge, useToast } from '../ui'
import { formatShortBR } from '../../utils/date'

interface TemperatureMonthlyTableProps {
  records: TemperatureRecord[]
  isLoading: boolean
  canWrite: boolean
  onEditRecord: (record: TemperatureRecord) => void
}

export function TemperatureMonthlyTable({
  records,
  isLoading,
  canWrite,
  onEditRecord,
}: TemperatureMonthlyTableProps) {
  const { toast } = useToast()
  const deleteRecord = useDeleteTemperatureRecord()

  const [previewPhoto, setPreviewPhoto] = useState<{
    title: string
    maxUrl?: string | null
    minUrl?: string | null
    activeTab: 'MAX' | 'MIN'
  } | null>(null)

  const handleDelete = (id: string, equipName: string, date: string) => {
    if (confirm(`Deseja excluir a medição de ${equipName} do dia ${formatShortBR(date)}?`)) {
      deleteRecord.mutate(id, {
        onSuccess: () => {
          toast.success('Registro de temperatura excluído.')
        },
        onError: () => {
          toast.error('Erro ao excluir registro de temperatura.')
        },
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50/70 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Data / Hora</th>
                <th className="px-4 py-3.5">Equipamento</th>
                <th className="px-3 py-3.5 text-right text-rose-700">Máx OUT</th>
                <th className="px-3 py-3.5 text-right text-sky-700">Mín OUT</th>
                <th className="px-3 py-3.5 text-right text-amber-800">Temp. Ambiente</th>
                <th className="px-3 py-3.5 text-right">UR (%)</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5">Responsável</th>
                <th className="px-4 py-3.5 text-center">Evidência</th>
                {canWrite && <th className="px-4 py-3.5 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading ? (
                <tr>
                  <td colSpan={canWrite ? 10 : 9} className="p-8 text-center text-neutral-500">
                    Carregando medições...
                  </td>
                </tr>
              ) : records && records.length > 0 ? (
                records.map((r) => {
                  const isAlert = r.status === 'NAO_CONFORME'
                  const displayCurrent =
                    r.tempCurrent != null
                      ? r.tempCurrent
                      : r.tempMaxIn != null && r.tempMinIn != null
                      ? Number(((r.tempMaxIn + r.tempMinIn) / 2).toFixed(1))
                      : null

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-neutral-50/80 transition-colors ${
                        isAlert ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-neutral-900 whitespace-nowrap">
                        <div>{formatShortBR(r.date)}</div>
                        <div className="text-xs text-neutral-500 font-normal">
                          {r.time ? r.time.substring(0, 5) : '-'} ({r.period})
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-800">{r.locationName}</div>
                        <div className="text-xs text-neutral-500">
                          {r.locationCode} • [{r.minTempTarget}°C a {r.maxTempTarget}°C]
                        </div>
                      </td>

                      <td className="px-3 py-3 text-right font-semibold text-rose-600 whitespace-nowrap">
                        {r.tempMax != null ? `${r.tempMax}°C` : '-'}
                      </td>

                      <td className="px-3 py-3 text-right font-semibold text-sky-600 whitespace-nowrap">
                        {r.tempMin != null ? `${r.tempMin}°C` : '-'}
                      </td>

                      <td className="px-3 py-3 text-right font-medium text-amber-800 whitespace-nowrap">
                        {displayCurrent != null ? `${displayCurrent}°C` : '-'}
                      </td>

                      <td className="px-3 py-3 text-right text-neutral-600 whitespace-nowrap">
                        {r.humidity != null ? `${r.humidity}%` : '-'}
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <StatusBadge status={r.status} />
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-neutral-800 font-medium">{r.responsible}</div>
                        {r.actionTaken && (
                          <div className="mt-0.5 text-xs text-rose-700 font-normal truncate max-w-xs">
                            Ação: {r.actionTaken}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {r.photoUrl || r.photoMinUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                title: `${r.locationName} — ${formatShortBR(r.date)} ${r.time?.substring(0, 5)}`,
                                maxUrl: r.photoUrl,
                                minUrl: r.photoMinUrl,
                                activeTab: r.photoUrl ? 'MAX' : 'MIN',
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 shadow-2xs transition-all"
                            title="Visualizar fotos do display"
                          >
                            <ImageIcon className="h-3.5 w-3.5 text-neutral-500" />
                            <span>
                              {r.photoUrl && r.photoMinUrl ? 'Fotos (MAX/MIN)' : 'Ver Foto'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-400">-</span>
                        )}
                      </td>

                      {canWrite && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onEditRecord(r)}
                              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                              title="Editar medição"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(r.id, r.locationName, r.date)}
                              className="rounded-lg p-1.5 text-neutral-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              title="Excluir medição"
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
                  <td colSpan={canWrite ? 10 : 9} className="p-8">
                    <EmptyState
                      icon={<Thermometer className="h-8 w-8 text-neutral-400" />}
                      title="Nenhum registro de temperatura encontrado"
                      description="Faça o primeiro lançamento ou ajuste os filtros do mês."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de Zoom da Foto */}
      {previewPhoto && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewPhoto(null)}
          title={`Evidência Fotográfica: ${previewPhoto.title}`}
        >
          <div className="space-y-4">
            {previewPhoto.maxUrl && previewPhoto.minUrl && (
              <div className="flex items-center justify-center gap-2 border-b border-neutral-200 pb-3">
                <button
                  type="button"
                  onClick={() => setPreviewPhoto({ ...previewPhoto, activeTab: 'MAX' })}
                  className={`rounded-xl px-4 py-1.5 text-xs font-bold transition-colors ${
                    previewPhoto.activeTab === 'MAX'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  Visor em MÁX (MAX OUT)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPhoto({ ...previewPhoto, activeTab: 'MIN' })}
                  className={`rounded-xl px-4 py-1.5 text-xs font-bold transition-colors ${
                    previewPhoto.activeTab === 'MIN'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  Visor em MÍN (MIN OUT)
                </button>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900 p-2 text-center">
              <img
                src={
                  previewPhoto.activeTab === 'MIN' && previewPhoto.minUrl
                    ? previewPhoto.minUrl
                    : previewPhoto.maxUrl || previewPhoto.minUrl || ''
                }
                alt={`Foto do Termômetro (${previewPhoto.activeTab})`}
                className="max-h-[70vh] w-full object-contain"
              />
              <p className="mt-2 text-xs font-medium text-neutral-300">
                {previewPhoto.activeTab === 'MAX'
                  ? 'Exibindo visor em modo MÁXIMA (MAX)'
                  : 'Exibindo visor em modo MÍNIMA (MIN)'}
              </p>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setPreviewPhoto(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

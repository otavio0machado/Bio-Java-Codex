import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Thermometer,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { canWriteTemperature } from '../../lib/permissions'
import {
  useDeleteTemperatureRecord,
  useTemperatureLocations,
  useTemperatureRecords,
} from '../../hooks/useTemperature'
import { temperatureService } from '../../services/temperatureService'
import type { TemperatureRecord } from '../../types/temperature'
import { Button, Card, EmptyState, Modal, Select, useToast } from '../ui'
import { formatShortBR } from '../../utils/date'

interface TemperatureMonthlyTableProps {
  onNewRecord: () => void
  onEditRecord: (record: TemperatureRecord) => void
}

export function TemperatureMonthlyTable({
  onNewRecord,
  onEditRecord,
}: TemperatureMonthlyTableProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const canWrite = canWriteTemperature(user)

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')

  const [previewPhoto, setPreviewPhoto] = useState<{
    title: string
    maxUrl?: string | null
    minUrl?: string | null
    activeTab: 'MAX' | 'MIN'
  } | null>(null)
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false)
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false)

  const { data: locations } = useTemperatureLocations()
  const { data: records, isLoading } = useTemperatureRecords({
    locationId: selectedLocationId || undefined,
    month: selectedMonth,
    year: selectedYear,
    status: selectedStatus || undefined,
  })

  const deleteRecord = useDeleteTemperatureRecord()

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

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true)
      const blob = await temperatureService.exportExcel(
        selectedLocationId || undefined,
        selectedMonth,
        selectedYear
      )
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Controle_Temperatura_${String(selectedMonth).padStart(2, '0')}_${selectedYear}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Planilha exportada com sucesso!')
    } catch {
      toast.error('Erro ao exportar planilha.')
    } finally {
      setIsExportingExcel(false)
    }
  }

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true)
      const blob = await temperatureService.exportPdf(
        selectedLocationId || undefined,
        selectedMonth,
        selectedYear
      )
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Relatorio_Temperatura_${String(selectedMonth).padStart(2, '0')}_${selectedYear}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Folha mensal PDF gerada com sucesso!')
    } catch {
      toast.error('Erro ao gerar relatório PDF.')
    } finally {
      setIsExportingPdf(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra de Filtros e Ações de Exportação */}
      <Card className="border-neutral-200/80 bg-white p-5 shadow-sm sm:rounded-3xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 lg:flex lg:items-center">
            <div className="w-full sm:w-64">
              <Select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
              >
                <option value="">Todos os Equipamentos</option>
                {locations?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </Select>
            </div>

            <div className="w-full sm:w-36">
              <Select
                value={String(selectedMonth)}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
              >
                <option value="1">Janeiro</option>
                <option value="2">Fevereiro</option>
                <option value="3">Março</option>
                <option value="4">Abril</option>
                <option value="5">Maio</option>
                <option value="6">Junho</option>
                <option value="7">Julho</option>
                <option value="8">Agosto</option>
                <option value="9">Setembro</option>
                <option value="10">Outubro</option>
                <option value="11">Novembro</option>
                <option value="12">Dezembro</option>
              </Select>
            </div>

            <div className="w-full sm:w-28">
              <Select
                value={String(selectedYear)}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </Select>
            </div>

            <div className="w-full sm:w-36">
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">Todos os Status</option>
                <option value="CONFORME">Conformes</option>
                <option value="NAO_CONFORME">Não Conformes</option>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportExcel}
              loading={isExportingExcel}
            >
              <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-600" />
              Exportar Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportPdf}
              loading={isExportingPdf}
            >
              <FileText className="mr-1.5 h-4 w-4 text-rose-600" />
              Folha Mensal PDF
            </Button>
            {canWrite && (
              <Button size="sm" onClick={onNewRecord}>
                <Plus className="mr-1.5 h-4 w-4" />
                Novo Lançamento
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Tabela de Medições */}
      <Card className="overflow-hidden border-neutral-200/80 bg-white shadow-sm sm:rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
              <tr>
                <th className="px-3.5 py-3.5">Data / Hora</th>
                <th className="px-3.5 py-3.5">Equipamento</th>
                <th className="px-3 py-3.5 text-right text-rose-700">Máx OUT</th>
                <th className="px-3 py-3.5 text-right text-sky-700">Mín OUT</th>
                <th className="px-3 py-3.5 text-right text-amber-800">Momento</th>
                <th className="px-3 py-3.5 text-right">UR (%)</th>
                <th className="px-3.5 py-3.5 text-center">Status</th>
                <th className="px-3.5 py-3.5">Responsável</th>
                <th className="px-3.5 py-3.5 text-center">Foto / Evidência</th>
                {canWrite && <th className="px-3.5 py-3.5 text-right">Ações</th>}
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
                      <td className="px-3.5 py-3 font-medium text-neutral-900 whitespace-nowrap">
                        <div>{formatShortBR(r.date)}</div>
                        <div className="text-xs text-neutral-500 font-normal">
                          {r.time ? r.time.substring(0, 5) : '-'} ({r.period})
                        </div>
                      </td>

                      <td className="px-3.5 py-3">
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

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isAlert
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isAlert ? (
                            <AlertCircle className="h-3.5 w-3.5" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          {r.status}
                        </span>
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
                        {r.photoUrl && r.photoMinUrl ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewPhoto({
                                  title: `${r.locationName} — ${formatShortBR(r.date)} ${r.time?.substring(0, 5)}`,
                                  maxUrl: r.photoUrl,
                                  minUrl: r.photoMinUrl,
                                  activeTab: 'MAX',
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 hover:bg-amber-200"
                              title="Ver Foto da Máxima (MAX)"
                            >
                              MAX
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewPhoto({
                                  title: `${r.locationName} — ${formatShortBR(r.date)} ${r.time?.substring(0, 5)}`,
                                  maxUrl: r.photoUrl,
                                  minUrl: r.photoMinUrl,
                                  activeTab: 'MIN',
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800 hover:bg-sky-200"
                              title="Ver Foto da Mínima (MIN)"
                            >
                              MIN
                            </button>
                          </div>
                        ) : r.photoUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                title: `${r.locationName} — ${formatShortBR(r.date)} ${r.time?.substring(0, 5)}`,
                                maxUrl: r.photoUrl,
                                minUrl: null,
                                activeTab: 'MAX',
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-xl bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                          >
                            <Eye className="h-3.5 w-3.5 text-neutral-500" />
                            Foto Máx
                          </button>
                        ) : r.photoMinUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                title: `${r.locationName} — ${formatShortBR(r.date)} ${r.time?.substring(0, 5)}`,
                                maxUrl: null,
                                minUrl: r.photoMinUrl,
                                activeTab: 'MIN',
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-xl bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                          >
                            <Eye className="h-3.5 w-3.5 text-neutral-500" />
                            Foto Mín
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
                              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                              title="Editar medição"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(r.id, r.locationName, r.date)}
                              className="rounded-lg p-1.5 text-neutral-500 hover:bg-rose-50 hover:text-rose-600"
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
                  <td colSpan={canWrite ? 9 : 8} className="p-8">
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
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  🔥 Foto da Máxima (MAX)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPhoto({ ...previewPhoto, activeTab: 'MIN' })}
                  className={`rounded-xl px-4 py-1.5 text-xs font-bold transition-colors ${
                    previewPhoto.activeTab === 'MIN'
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  ❄️ Foto da Mínima (MIN)
                </button>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-black/5 p-2 text-center">
              <img
                src={
                  (previewPhoto.activeTab === 'MIN' && previewPhoto.minUrl)
                    ? previewPhoto.minUrl
                    : (previewPhoto.maxUrl || previewPhoto.minUrl || '')
                }
                alt={`Foto do Termômetro (${previewPhoto.activeTab})`}
                className="max-h-[70vh] w-full object-contain"
              />
              <p className="mt-2 text-xs font-medium text-neutral-600">
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

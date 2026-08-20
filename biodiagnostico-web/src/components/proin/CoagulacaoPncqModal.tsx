import { Layers, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useCreateQcReference, useDeleteQcReference, useQcExams, useQcReferences } from '../../hooks/useQcRecords'
import type { QcReferenceRequest, QcReferenceValue } from '../../types'
import { Button, Input, Modal, Select, useToast } from '../ui'
import { formatLongBR } from '../../utils/date'

interface CoagulacaoPncqModalProps {
  isOpen: boolean
  onClose: () => void
  onLotCreated?: (lotNumber: string) => void
}

interface AnalyteRefInput {
  examName: string
  label: string
  unit: string
  targetValue: string
  targetSd: string
  optional?: boolean
}

const INITIAL_ANALYTES: AnalyteRefInput[] = [
  {
    examName: 'TP - Atividade (%)',
    label: 'Tempo de Protrombina — Atividade (%)',
    unit: '%',
    targetValue: '',
    targetSd: '',
  },
  {
    examName: 'TP - INR',
    label: 'Tempo de Protrombina — INR',
    unit: 'INR',
    targetValue: '',
    targetSd: '',
  },
  {
    examName: 'TTPa - Tempo (s)',
    label: 'Tempo Parcial de Tromboplastina — TTPa (s)',
    unit: 's',
    targetValue: '',
    targetSd: '',
  },
  {
    examName: 'Fibrinogênio (g/L)',
    label: 'Fibrinogênio (g/L)',
    unit: 'g/L',
    targetValue: '',
    targetSd: '',
    optional: true,
  },
]

export function CoagulacaoPncqModal({ isOpen, onClose, onLotCreated }: CoagulacaoPncqModalProps) {
  const { toast } = useToast()
  const { data: exams = [] } = useQcExams('coagulacao')
  const { data: references = [], refetch: refetchReferences } = useQcReferences({ area: 'coagulacao' })
  const createReferenceMutation = useCreateQcReference()
  const deleteReferenceMutation = useDeleteQcReference()

  const [lotNumber, setLotNumber] = useState('')
  const [level, setLevel] = useState('Normal')
  const [manufacturer, setManufacturer] = useState('PNCQ')
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10))
  const [validUntil, setValidUntil] = useState('')
  const [analytes, setAnalytes] = useState<AnalyteRefInput[]>(INITIAL_ANALYTES)
  const [activeTab, setActiveTab] = useState<'novo' | 'existentes'>('novo')

  const handleAnalyteChange = (index: number, field: 'targetValue' | 'targetSd', val: string) => {
    setAnalytes((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: val }
      return next
    })
  }

  const handleSaveLot = async () => {
    const trimmedLot = lotNumber.trim().toUpperCase()
    if (!trimmedLot) {
      toast.error('Informe a identificação do lote PNCQ.')
      return
    }

    const payloadList: QcReferenceRequest[] = []

    for (const item of analytes) {
      const targetVal = parseFloat(item.targetValue.replace(',', '.'))
      const targetSdVal = parseFloat(item.targetSd.replace(',', '.'))

      if (isNaN(targetVal) || isNaN(targetSdVal)) {
        if (item.optional) continue
        toast.error(`Preencha a média e o desvio padrão para ${item.label}.`)
        return
      }

      const foundExam = exams.find(
        (e) => e.name.toLowerCase() === item.examName.toLowerCase() || e.name.includes(item.examName),
      )

      if (!foundExam) {
        toast.error(`Exame não cadastrado no sistema para ${item.label}.`)
        return
      }

      payloadList.push({
        examId: foundExam.id,
        name: item.examName,
        level,
        lotNumber: trimmedLot,
        targetValue: targetVal,
        targetSd: targetSdVal,
        cvMaxThreshold: 15,
        manufacturer: manufacturer.trim() || 'PNCQ',
        validFrom: validFrom || undefined,
        validUntil: validUntil || undefined,
      })
    }

    if (payloadList.length === 0) {
      toast.warning('Preencha os valores de ao menos um exame para cadastrar o lote.')
      return
    }

    try {
      for (const req of payloadList) {
        await createReferenceMutation.mutateAsync(req)
      }

      toast.success(`Lote ${trimmedLot} criado com ${payloadList.length} referências ativas.`)

      if (onLotCreated) {
        onLotCreated(trimmedLot)
      }

      await refetchReferences()
      setLotNumber('')
      setAnalytes(INITIAL_ANALYTES)
      onClose()
    } catch {
      toast.error('Ocorreu uma falha ao salvar as referências de coagulação.')
    }
  }

  const handleDeleteReference = async (ref: QcReferenceValue) => {
    if (!confirm(`Deseja excluir a referência ${ref.name}?`)) return
    try {
      await deleteReferenceMutation.mutateAsync(ref.id)
      toast.success('Referência removida com sucesso.')
      await refetchReferences()
    } catch {
      toast.error('Falha ao remover a referência.')
    }
  }

  // Agrupar referências existentes por lote
  const groupedByLot = useMemo(() => {
    const map = new Map<string, QcReferenceValue[]>()
    references.forEach((r) => {
      const lot = r.lotNumber || 'Sem Lote'
      if (!map.has(lot)) map.set(lot, [])
      map.get(lot)!.push(r)
    })
    return Array.from(map.entries())
  }, [references])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gestão de Lotes de Controle — Coagulação (PNCQ)"
      size="lg"
    >
      <div className="space-y-6">
        <div className="flex border-b border-neutral-200">
          <button
            type="button"
            className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeTab === 'novo'
                ? 'border-green-800 text-green-800'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
            onClick={() => setActiveTab('novo')}
          >
            Cadastrar Novo Lote
          </button>
          <button
            type="button"
            className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeTab === 'existentes'
                ? 'border-green-800 text-green-800'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
            onClick={() => setActiveTab('existentes')}
          >
            Lotes Cadastrados ({groupedByLot.length})
          </button>
        </div>

        {activeTab === 'novo' ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-green-200 bg-green-50/50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-green-900">
                <Layers className="h-4 w-4" />
                Ficha Oficial do PNCQ / Hemostasia
              </div>
              <p className="mt-1 text-xs text-green-700">
                Preencha os dados do plasma controle conforme a bula impressa do PNCQ. Todas as
                médias e desvios serão configurados para a rotina diária em lote.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">
                  Lote do Controle *
                </label>
                <Input
                  placeholder="Ex: COAG 03142026"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">Nível *</label>
                <Select value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option value="Normal">Normal</option>
                  <option value="Patológico 1">Patológico 1 (P1)</option>
                  <option value="Patológico 2">Patológico 2 (P2)</option>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">Fabricante</label>
                <Input
                  placeholder="PNCQ"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">Data Início</label>
                <Input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">Validade</label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>

            {/* Tabela de Analitos */}
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50 text-xs font-semibold text-neutral-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Exame / Parâmetro</th>
                    <th className="w-32 px-4 py-3 text-center">Média (Alvo)</th>
                    <th className="w-32 px-4 py-3 text-center">Desvio Padrão (DP)</th>
                    <th className="w-40 px-4 py-3 text-center">Faixa Aceitável (±2 DP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {analytes.map((item, idx) => {
                    const targetNum = parseFloat(item.targetValue.replace(',', '.'))
                    const sdNum = parseFloat(item.targetSd.replace(',', '.'))
                    const hasInterval = !isNaN(targetNum) && !isNaN(sdNum) && sdNum > 0
                    const min2Sd = hasInterval ? (targetNum - 2 * sdNum).toFixed(2) : '-'
                    const max2Sd = hasInterval ? (targetNum + 2 * sdNum).toFixed(2) : '-'

                    return (
                      <tr key={item.examName} className="hover:bg-neutral-50/70">
                        <td className="px-4 py-3">
                          <div className="font-medium text-neutral-900">{item.label}</div>
                          {item.optional && (
                            <span className="text-xs text-neutral-400">Opcional</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Input
                            type="text"
                            placeholder="Média"
                            className="text-center font-mono text-sm"
                            value={item.targetValue}
                            onChange={(e) =>
                              handleAnalyteChange(idx, 'targetValue', e.target.value)
                            }
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Input
                            type="text"
                            placeholder="DP"
                            className="text-center font-mono text-sm"
                            value={item.targetSd}
                            onChange={(e) => handleAnalyteChange(idx, 'targetSd', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs font-medium text-neutral-700">
                          {hasInterval ? (
                            <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-800">
                              {min2Sd} — {max2Sd} {item.unit}
                            </span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveLot}
                disabled={createReferenceMutation.isPending}
              >
                {createReferenceMutation.isPending ? 'Salvando...' : 'Salvar Referências do Lote'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByLot.length === 0 ? (
              <div className="p-8 text-center text-sm text-neutral-500">
                Nenhum lote de coagulação cadastrado ainda.
              </div>
            ) : (
              groupedByLot.map(([lot, refs]) => (
                <div
                  key={lot}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                    <div>
                      <div className="text-base font-bold text-neutral-900">Lote: {lot}</div>
                      <div className="text-xs text-neutral-500">
                        Nível: {refs[0]?.level || 'Normal'} · Fabricante:{' '}
                        {refs[0]?.manufacturer || 'PNCQ'} · Validade:{' '}
                        {refs[0]?.validUntil ? formatLongBR(refs[0].validUntil) : 'Não informada'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {refs.map((ref) => (
                      <div
                        key={ref.id}
                        className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-neutral-800">
                            {ref.exam?.name || ref.name}:
                          </span>{' '}
                          <span className="font-mono text-neutral-600">
                            {ref.targetValue} ± {ref.targetSd}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="text-neutral-400 transition hover:text-red-600"
                          onClick={() => handleDeleteReference(ref)}
                          title="Excluir referência"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

import { useState, useMemo, useEffect } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Package,
  Save,
  ShieldAlert,
} from 'lucide-react'
import { Card, Button, Input, Select, StatusBadge, TextArea, useToast } from '../../ui'
import { useUroStripControlSets, useCreateUroStripRun } from '../../../hooks/useUroanalise'
import { useReagentLots } from '../../../hooks/useReagents'
import { useAuth } from '../../../hooks/useAuth'
import { canWriteQc } from '../../../lib/permissions'
import { formatLongBR, todayLocal } from '../../../utils/date'
import { cn } from '../../../utils/cn'
import type { UroStripRunRequest } from '../../../types'

const QUALITATIVE_OPTIONS = ['NEGATIVO', 'TRAÇOS', '+', '++', '+++', '++++']
const UROBILINOGEN_OPTIONS = ['NORMAL', 'AUMENTADO', '0.2 mg/dL', '1.0 mg/dL', '2.0 mg/dL']
const NITRITE_OPTIONS = ['NEGATIVO', 'POSITIVO']

const QUICK_ACTIONS = [
  'Abertura de novo frasco de tiras de urina com mesmo lote',
  'Repetição do teste com fita reativa de novo lote de reagente',
  'Higienização do leitor óptico / refratômetro e checagem de calibração',
  'Descarte do frasco de tiras por suspeita de exposição à umidade',
]

export function UroStripQcTab() {
  const { toast } = useToast()
  const { user } = useAuth()
  const canManageQc = canWriteQc(user)

  const [dataMedicao, setDataMedicao] = useState(todayLocal())
  const [selectedControlId, setSelectedControlId] = useState<string>('')
  const [selectedReagentLotId, setSelectedReagentLotId] = useState<string>('')

  // Medições
  const [measuredPh, setMeasuredPh] = useState<number>(5.5)
  const [measuredDensity, setMeasuredDensity] = useState<number>(1.015)
  const [measuredProteins, setMeasuredProteins] = useState('NEGATIVO')
  const [measuredGlucose, setMeasuredGlucose] = useState('NEGATIVO')
  const [measuredKetones, setMeasuredKetones] = useState('NEGATIVO')
  const [measuredBlood, setMeasuredBlood] = useState('NEGATIVO')
  const [measuredUrobilinogen, setMeasuredUrobilinogen] = useState('NORMAL')
  const [measuredNitrite, setMeasuredNitrite] = useState('NEGATIVO')

  const [correctiveAction, setCorrectiveAction] = useState('')
  const [notes, setNotes] = useState('')

  const { data: controlSets = [] } = useUroStripControlSets({ includeInactive: false })
  // Integração completa com o módulo de Reagentes (sem restringir rigidamente categoria)
  const { data: allReagentLots = [] } = useReagentLots()
  const createStripRun = useCreateUroStripRun()

  // Seleciona automaticamente o primeiro controle ativo se nenhum estiver selecionado
  useEffect(() => {
    if (!selectedControlId && controlSets.length > 0) {
      setSelectedControlId(controlSets[0].id)
    }
  }, [controlSets, selectedControlId])

  const selectedControl = useMemo(() => {
    return controlSets.find((c) => c.id === selectedControlId) ?? null
  }, [controlSets, selectedControlId])

  // Reagentes ativos da plataforma com normalização de status case-insensitive
  const availableReagents = useMemo(() => {
    return allReagentLots.filter((r) => {
      const s = (r.status ?? '').toLowerCase()
      return s === 'em_uso' || s === 'em_estoque'
    })
  }, [allReagentLots])

  // Reagentes específicos de Uroanálise
  const uroReagents = useMemo(() => {
    return availableReagents.filter((r) => {
      const cat = (r.category ?? '').toLowerCase()
      return cat.includes('uro')
    })
  }, [availableReagents])

  // Demais reagentes do estoque do laboratório
  const otherReagents = useMemo(() => {
    return availableReagents.filter((r) => {
      const cat = (r.category ?? '').toLowerCase()
      return !cat.includes('uro')
    })
  }, [availableReagents])

  const selectedReagent = useMemo(() => {
    return availableReagents.find((r) => r.id === selectedReagentLotId) ?? null
  }, [availableReagents, selectedReagentLotId])

  // Normalização de sinônimos para conferência em tempo real
  const normalize = (val: string | null | undefined): string => {
    if (!val) return ''
    const s = val.trim().toUpperCase()
    if (s === '0' || s === 'NEG' || s === 'NEGATIVO' || s === 'AUSENTE') return 'NEGATIVO'
    if (s === 'N' || s === 'NORMAL') return 'NORMAL'
    return s
  }

  // Status em tempo real por parâmetro
  const statusPh = useMemo(() => {
    if (!selectedControl || selectedControl.expectedPhMin == null || selectedControl.expectedPhMax == null) {
      return 'APROVADO'
    }
    return measuredPh >= selectedControl.expectedPhMin && measuredPh <= selectedControl.expectedPhMax
      ? 'APROVADO'
      : 'REPROVADO'
  }, [selectedControl, measuredPh])

  const statusDensity = useMemo(() => {
    if (!selectedControl || selectedControl.expectedDensityMin == null || selectedControl.expectedDensityMax == null) {
      return 'APROVADO'
    }
    return measuredDensity >= selectedControl.expectedDensityMin && measuredDensity <= selectedControl.expectedDensityMax
      ? 'APROVADO'
      : 'REPROVADO'
  }, [selectedControl, measuredDensity])

  const statusProteins = useMemo(() => {
    if (!selectedControl) return 'APROVADO'
    return normalize(measuredProteins) === normalize(selectedControl.expectedProteins) ? 'APROVADO' : 'REPROVADO'
  }, [selectedControl, measuredProteins])

  const statusGlucose = useMemo(() => {
    if (!selectedControl) return 'APROVADO'
    return normalize(measuredGlucose) === normalize(selectedControl.expectedGlucose) ? 'APROVADO' : 'REPROVADO'
  }, [selectedControl, measuredGlucose])

  const statusKetones = useMemo(() => {
    if (!selectedControl) return 'APROVADO'
    return normalize(measuredKetones) === normalize(selectedControl.expectedKetones) ? 'APROVADO' : 'REPROVADO'
  }, [selectedControl, measuredKetones])

  const statusBlood = useMemo(() => {
    if (!selectedControl) return 'APROVADO'
    return normalize(measuredBlood) === normalize(selectedControl.expectedBlood) ? 'APROVADO' : 'REPROVADO'
  }, [selectedControl, measuredBlood])

  const statusUrobilinogen = useMemo(() => {
    if (!selectedControl) return 'APROVADO'
    return normalize(measuredUrobilinogen) === normalize(selectedControl.expectedUrobilinogen) ? 'APROVADO' : 'REPROVADO'
  }, [selectedControl, measuredUrobilinogen])

  const statusNitrite = useMemo(() => {
    if (!selectedControl) return 'APROVADO'
    return normalize(measuredNitrite) === normalize(selectedControl.expectedNitrite) ? 'APROVADO' : 'REPROVADO'
  }, [selectedControl, measuredNitrite])

  const isGlobalApproved = useMemo(() => {
    return (
      statusPh === 'APROVADO' &&
      statusDensity === 'APROVADO' &&
      statusProteins === 'APROVADO' &&
      statusGlucose === 'APROVADO' &&
      statusKetones === 'APROVADO' &&
      statusBlood === 'APROVADO' &&
      statusUrobilinogen === 'APROVADO' &&
      statusNitrite === 'APROVADO'
    )
  }, [
    statusPh,
    statusDensity,
    statusProteins,
    statusGlucose,
    statusKetones,
    statusBlood,
    statusUrobilinogen,
    statusNitrite,
  ])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (createStripRun.isPending) return

    if (!selectedControlId) {
      toast.warning('Selecione um lote de controle interno cadastrado.')
      return
    }

    if (!isGlobalApproved && !correctiveAction.trim()) {
      toast.error('Ação corretiva é obrigatória para controles de tira com parâmetros reprovados!')
      return
    }

    const payload: UroStripRunRequest = {
      controlSetId: selectedControlId,
      reagentLotId: selectedReagentLotId || undefined,
      dataMedicao,
      measuredPh,
      measuredDensity,
      measuredProteins,
      measuredGlucose,
      measuredKetones,
      measuredBlood,
      measuredUrobilinogen,
      measuredNitrite,
      correctiveAction: correctiveAction.trim() || undefined,
      notes: notes.trim() || undefined,
    }

    try {
      await createStripRun.mutateAsync(payload)
      toast[isGlobalApproved ? 'success' : 'warning'](
        isGlobalApproved
          ? 'Controle de tiras de urina aprovado e registrado com sucesso!'
          : 'Controle de tiras registrado com status REPROVADO e ação corretiva anexada.'
      )
      setCorrectiveAction('')
      setNotes('')
    } catch {
      toast.error('Erro ao salvar corrida de tiras de urina.')
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-6">
        {/* Cabeçalho da Seção */}
        <div className="border-b border-neutral-100 pb-4">
          <h2 className="text-xl font-bold text-neutral-900">Tiras de Urina (Físico-Químico)</h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Conferência do controle interno comercial com a fita reativa de rotina e rastreabilidade de lote.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seção 1: Identificação */}
          <div className="space-y-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-800">
                1. Identificação do Ensaio e Reagentes
              </div>
              <div className="mt-1 text-sm text-neutral-500">
                Selecione a data, o lote de controle interno comercial e a tira em uso na bancada.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Data da Medição *"
                type="date"
                value={dataMedicao}
                onChange={(e) => setDataMedicao(e.target.value)}
                icon={<Calendar className="h-4 w-4" />}
                required
              />

              <div>
                <Select
                  label="Controle Interno Comercial *"
                  value={selectedControlId}
                  onChange={(e) => setSelectedControlId(e.target.value)}
                  required
                >
                  {controlSets.length === 0 ? (
                    <option value="">Nenhum controle cadastrado (cadastre na aba Lotes de Controle)</option>
                  ) : (
                    controlSets.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.controlLotNumber} — {c.manufacturer} (Val: {formatLongBR(c.validUntil)})
                      </option>
                    ))
                  )}
                </Select>
                {selectedControl && (
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-neutral-500">
                    <span>Marca: <strong>{selectedControl.manufacturer}</strong></span>
                    <span>•</span>
                    <span>Validade: <strong>{formatLongBR(selectedControl.validUntil)}</strong></span>
                  </div>
                )}
              </div>

              <div>
                <Select
                  label="Tira de Urina / Reagente em Uso"
                  value={selectedReagentLotId}
                  onChange={(e) => setSelectedReagentLotId(e.target.value)}
                  icon={<Package className="h-4 w-4" />}
                >
                  <option value="">(Sem vínculo direto com estoque)</option>
                  {uroReagents.length > 0 && (
                    <optgroup label="Reagentes de Uroanálise">
                      {uroReagents.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label} — Lote: {r.lotNumber} ({r.manufacturer})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherReagents.length > 0 && (
                    <optgroup label="Demais Reagentes do Laboratório">
                      {otherReagents.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label} — Lote: {r.lotNumber} ({r.category || 'Geral'}) — {r.manufacturer}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </Select>
                {selectedReagent && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <span>Fabricante: <strong>{selectedReagent.manufacturer}</strong></span>
                    <span>•</span>
                    <span>Lote: <strong>{selectedReagent.lotNumber}</strong></span>
                    <span>•</span>
                    <span>Categoria: <strong>{selectedReagent.category || 'Geral'}</strong></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seção 2: Tabela de Parâmetros da Fita */}
          <div className="space-y-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-800">
                2. Parâmetros da Fita Reativa
              </div>
              <div className="mt-1 text-sm text-neutral-500">
                Informe os valores lidos para conferência imediata contra os valores esperados da bula.
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-xs">
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-600">
                  <tr>
                    <th className="py-3 px-4 text-left">Constituinte da Fita</th>
                    <th className="py-3 px-4 text-center">Esperado (Bula)</th>
                    <th className="py-3 px-4 text-center">Resultado Observado</th>
                    <th className="py-3 px-4 text-center">Conferência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {/* pH */}
                  <tr className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-4 font-semibold text-neutral-900">pH</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-mono font-medium text-neutral-700">
                        {selectedControl ? `${selectedControl.expectedPhMin} a ${selectedControl.expectedPhMax}` : '5.0 a 6.0'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        step="0.5"
                        className="w-28 text-center rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-1.5 font-semibold text-neutral-900 focus:border-green-800 focus:outline-none"
                        value={measuredPh}
                        onChange={(e) => setMeasuredPh(parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={statusPh} />
                    </td>
                  </tr>

                  {/* Densidade */}
                  <tr className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-4 font-semibold text-neutral-900">Densidade</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-mono font-medium text-neutral-700">
                        {selectedControl ? `${selectedControl.expectedDensityMin} a ${selectedControl.expectedDensityMax}` : '1.005 a 1.025'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        step="0.005"
                        className="w-28 text-center rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-1.5 font-semibold text-neutral-900 focus:border-green-800 focus:outline-none"
                        value={measuredDensity}
                        onChange={(e) => setMeasuredDensity(parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={statusDensity} />
                    </td>
                  </tr>

                  {/* Proteínas */}
                  <tr className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-4 font-semibold text-neutral-900">Proteínas</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                        {selectedControl?.expectedProteins || 'NEGATIVO'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5">
                        {QUALITATIVE_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setMeasuredProteins(opt)}
                            className={cn(
                              'px-3 py-1 text-xs font-medium rounded-lg transition',
                              measuredProteins === opt
                                ? 'bg-green-800 text-white font-semibold shadow-xs'
                                : 'text-neutral-600 hover:text-neutral-900'
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={statusProteins} />
                    </td>
                  </tr>

                  {/* Glicose */}
                  <tr className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-4 font-semibold text-neutral-900">Glicose</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                        {selectedControl?.expectedGlucose || 'NEGATIVO'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5">
                        {QUALITATIVE_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setMeasuredGlucose(opt)}
                            className={cn(
                              'px-3 py-1 text-xs font-medium rounded-lg transition',
                              measuredGlucose === opt
                                ? 'bg-green-800 text-white font-semibold shadow-xs'
                                : 'text-neutral-600 hover:text-neutral-900'
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={statusGlucose} />
                    </td>
                  </tr>

                  {/* Corpos Cetônicos */}
                  <tr className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-4 font-semibold text-neutral-900">Corpos Cetônicos</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                        {selectedControl?.expectedKetones || 'NEGATIVO'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5">
                        {QUALITATIVE_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setMeasuredKetones(opt)}
                            className={cn(
                              'px-3 py-1 text-xs font-medium rounded-lg transition',
                              measuredKetones === opt
                                ? 'bg-green-800 text-white font-semibold shadow-xs'
                                : 'text-neutral-600 hover:text-neutral-900'
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={statusKetones} />
                    </td>
                  </tr>

                  {/* Sangue / Hemoglobina */}
                  <tr className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-4 font-semibold text-neutral-900">Sangue / Hemoglobina</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                        {selectedControl?.expectedBlood || 'NEGATIVO'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5">
                        {QUALITATIVE_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setMeasuredBlood(opt)}
                            className={cn(
                              'px-3 py-1 text-xs font-medium rounded-lg transition',
                              measuredBlood === opt
                                ? 'bg-green-800 text-white font-semibold shadow-xs'
                                : 'text-neutral-600 hover:text-neutral-900'
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={statusBlood} />
                    </td>
                  </tr>

                  {/* Urobilinogênio */}
                  <tr className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-4 font-semibold text-neutral-900">Urobilinogênio</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                        {selectedControl?.expectedUrobilinogen || 'NORMAL'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5">
                        {UROBILINOGEN_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setMeasuredUrobilinogen(opt)}
                            className={cn(
                              'px-3 py-1 text-xs font-medium rounded-lg transition',
                              measuredUrobilinogen === opt
                                ? 'bg-green-800 text-white font-semibold shadow-xs'
                                : 'text-neutral-600 hover:text-neutral-900'
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={statusUrobilinogen} />
                    </td>
                  </tr>

                  {/* Nitrito */}
                  <tr className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-4 font-semibold text-neutral-900">Nitrito</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                        {selectedControl?.expectedNitrite || 'NEGATIVO'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5">
                        {NITRITE_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setMeasuredNitrite(opt)}
                            className={cn(
                              'px-3 py-1 text-xs font-medium rounded-lg transition',
                              measuredNitrite === opt
                                ? 'bg-green-800 text-white font-semibold shadow-xs'
                                : 'text-neutral-600 hover:text-neutral-900'
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={statusNitrite} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Banner de Avaliação Geral Instantânea do Controle */}
          <div
            className={cn(
              'rounded-2xl border p-4 flex items-center justify-between transition-all',
              isGlobalApproved
                ? 'border-green-200 bg-green-50/80 text-green-900'
                : 'border-red-200 bg-red-50/80 text-red-900'
            )}
          >
            <div className="flex items-center gap-3">
              {isGlobalApproved ? (
                <CheckCircle2 className="h-6 w-6 text-green-700 flex-shrink-0" />
              ) : (
                <ShieldAlert className="h-6 w-6 text-red-600 flex-shrink-0" />
              )}
              <div>
                <h4 className="font-bold text-base">
                  {isGlobalApproved ? 'CONTROLE APROVADO' : 'CONTROLE REPROVADO'}
                </h4>
                <p className="text-sm opacity-90">
                  {isGlobalApproved
                    ? 'Todos os parâmetros da fita reativa conferem com os valores esperados da bula comercial.'
                    : 'Um ou mais parâmetros da fita reativa divergiram dos valores esperados. Ação corretiva obrigatória.'}
                </p>
              </div>
            </div>
            <StatusBadge status={isGlobalApproved ? 'APROVADO' : 'REPROVADO'} />
          </div>

          {/* Campo de Ação Corretiva se Reprovado */}
          {!isGlobalApproved && (
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="h-5 w-5" />
                <h4 className="font-bold text-sm">Ação Corretiva Obrigatória (Controle Reprovado)</h4>
              </div>
              <p className="text-xs text-red-700">
                Um ou mais constituintes divergiram do padrão esperado da bula. Descreva a conduta tomada antes de liberar a rotina.
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => setCorrectiveAction(action)}
                    className="text-xs bg-white border border-red-200 text-neutral-700 px-3 py-1.5 rounded-lg hover:bg-red-100/50 transition"
                  >
                    + {action}
                  </button>
                ))}
              </div>
              <TextArea
                placeholder="Descreva a ação corretiva executada pelo operador..."
                value={correctiveAction}
                onChange={(e) => setCorrectiveAction(e.target.value)}
                rows={2}
                required
              />
            </div>
          )}

          {/* Rodapé e Botão de Gravação */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-neutral-100">
            <Button
              type="submit"
              disabled={createStripRun.isPending || !canManageQc}
              className="w-full sm:w-auto h-11 rounded-xl bg-green-800 hover:bg-green-900 text-white font-semibold min-w-48 shadow-sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {createStripRun.isPending ? 'Gravando...' : 'Salvar Corrida da Fita'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

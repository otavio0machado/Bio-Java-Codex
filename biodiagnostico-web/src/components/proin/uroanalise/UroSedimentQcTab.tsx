import { useState, useMemo } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Save,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { Card, Button, Input, Select, StatusBadge, TextArea, useToast } from '../../ui'
import { useCreateUroSedimentRun } from '../../../hooks/useUroanalise'
import { useResponsibles } from '../../../hooks/useReagents'
import { useAuth } from '../../../hooks/useAuth'
import { canWriteQc } from '../../../lib/permissions'
import { todayLocal } from '../../../utils/date'
import { cn } from '../../../utils/cn'
import type { UroSedimentRunRequest } from '../../../types'

const BACTERIA_OPTIONS = ['ESCASSA', 'DISCRETA', 'MODERADA', 'INTENSA']
const BINARY_OPTIONS = ['AUSENTE', 'PRESENTE']

const QUICK_SEDIMENT_ACTIONS = [
  'Revisão conjunta das lâminas no microscópio para alinhamento de campos',
  'Padronização de critérios com o supervisor técnico da uroanálise',
  'Ajuste do diafragma e iluminação de campo do microscópio óptico',
  'Realizada leitura por terceiro analista para desempate',
]

export function UroSedimentQcTab() {
  const { toast } = useToast()
  const { user } = useAuth()
  const canManageQc = canWriteQc(user)

  const [dataMedicao, setDataMedicao] = useState(todayLocal())
  const [patientCode, setPatientCode] = useState('11111111')
  const [analyst1Id, setAnalyst1Id] = useState('')
  const [analyst1Name, setAnalyst1Name] = useState('')
  const [analyst2Id, setAnalyst2Id] = useState('')
  const [analyst2Name, setAnalyst2Name] = useState('')

  // Leucócitos e Hemácias (CV 20%)
  const [leukocytesA1, setLeukocytesA1] = useState<number>(4)
  const [leukocytesA2, setLeukocytesA2] = useState<number>(3)
  const [erythrocytesA1, setErythrocytesA1] = useState<number>(2)
  const [erythrocytesA2, setErythrocytesA2] = useState<number>(2)

  // Categóricos
  const [bacteriaA1, setBacteriaA1] = useState('DISCRETA')
  const [bacteriaA2, setBacteriaA2] = useState('MODERADA')

  const [epithelialCellsA1, setEpithelialCellsA1] = useState('PRESENTE')
  const [epithelialCellsA2, setEpithelialCellsA2] = useState('AUSENTE')

  const [mucusThreadsA1, setMucusThreadsA1] = useState('PRESENTE')
  const [mucusThreadsA2, setMucusThreadsA2] = useState('PRESENTE')

  const [crystalsA1, setCrystalsA1] = useState('AUSENTE')
  const [crystalsA2, setCrystalsA2] = useState('AUSENTE')

  const [othersA1, setOthersA1] = useState('AUSENTE')
  const [othersA2, setOthersA2] = useState('AUSENTE')

  const [correctiveAction, setCorrectiveAction] = useState('')
  const [notes, setNotes] = useState('')

  const { data: responsibles = [] } = useResponsibles()
  const createSedimentRun = useCreateUroSedimentRun()

  // Cálculo de CV em tempo real
  const calcCv = (a1: number, a2: number) => {
    const mean = (a1 + a2) / 2
    if (mean === 0) return 0
    const sd = Math.abs(a1 - a2) / Math.sqrt(2)
    return Math.round((sd / mean) * 100 * 100) / 100
  }

  const leukocytesCv = useMemo(() => calcCv(leukocytesA1, leukocytesA2), [leukocytesA1, leukocytesA2])
  const statusLeukocytes = useMemo(() => (leukocytesCv <= 20.0 ? 'APROVADO' : 'REPROVADO'), [leukocytesCv])

  const erythrocytesCv = useMemo(() => calcCv(erythrocytesA1, erythrocytesA2), [erythrocytesA1, erythrocytesA2])
  const statusErythrocytes = useMemo(() => (erythrocytesCv <= 20.0 ? 'APROVADO' : 'REPROVADO'), [erythrocytesCv])

  const statusBacteria = useMemo(
    () => (bacteriaA1.toUpperCase() === bacteriaA2.toUpperCase() ? 'APROVADO' : 'REPROVADO'),
    [bacteriaA1, bacteriaA2]
  )

  const statusEpithelialCells = useMemo(
    () => (epithelialCellsA1.toUpperCase() === epithelialCellsA2.toUpperCase() ? 'APROVADO' : 'REPROVADO'),
    [epithelialCellsA1, epithelialCellsA2]
  )

  const statusMucusThreads = useMemo(
    () => (mucusThreadsA1.toUpperCase() === mucusThreadsA2.toUpperCase() ? 'APROVADO' : 'REPROVADO'),
    [mucusThreadsA1, mucusThreadsA2]
  )

  const statusCrystals = useMemo(
    () => (crystalsA1.toUpperCase() === crystalsA2.toUpperCase() ? 'APROVADO' : 'REPROVADO'),
    [crystalsA1, crystalsA2]
  )

  const statusOthers = useMemo(
    () => (othersA1.toUpperCase() === othersA2.toUpperCase() ? 'APROVADO' : 'REPROVADO'),
    [othersA1, othersA2]
  )

  const isGlobalApproved = useMemo(() => {
    return (
      statusLeukocytes === 'APROVADO' &&
      statusErythrocytes === 'APROVADO' &&
      statusBacteria === 'APROVADO' &&
      statusEpithelialCells === 'APROVADO' &&
      statusMucusThreads === 'APROVADO' &&
      statusCrystals === 'APROVADO' &&
      statusOthers === 'APROVADO'
    )
  }, [
    statusLeukocytes,
    statusErythrocytes,
    statusBacteria,
    statusEpithelialCells,
    statusMucusThreads,
    statusCrystals,
    statusOthers,
  ])

  const handleAnalyst1Change = (id: string) => {
    setAnalyst1Id(id)
    const found = responsibles.find((r) => r.id === id)
    if (found) setAnalyst1Name(found.name)
  }

  const handleAnalyst2Change = (id: string) => {
    setAnalyst2Id(id)
    const found = responsibles.find((r) => r.id === id)
    if (found) setAnalyst2Name(found.name)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (createSedimentRun.isPending) return

    const a1Name = analyst1Name.trim() || responsibles.find((r) => r.id === analyst1Id)?.name
    const a2Name = analyst2Name.trim() || responsibles.find((r) => r.id === analyst2Id)?.name

    if (!patientCode.trim()) {
      toast.warning('Informe o código do paciente / amostra.')
      return
    }

    if (!a1Name || !a2Name) {
      toast.warning('Selecione ou informe os dois analistas participantes da dupla leitura.')
      return
    }

    if (!isGlobalApproved && !correctiveAction.trim()) {
      toast.error('Ação corretiva é obrigatória para ensaios inter-observador com divergência!')
      return
    }

    const payload: UroSedimentRunRequest = {
      dataMedicao,
      patientCode: patientCode.trim(),
      analyst1Id: analyst1Id || undefined,
      analyst1Name: a1Name,
      analyst2Id: analyst2Id || undefined,
      analyst2Name: a2Name,
      leukocytesA1,
      leukocytesA2,
      erythrocytesA1,
      erythrocytesA2,
      bacteriaA1,
      bacteriaA2,
      epithelialCellsA1,
      epithelialCellsA2,
      mucusThreadsA1,
      mucusThreadsA2,
      crystalsA1,
      crystalsA2,
      othersA1,
      othersA2,
      correctiveAction: correctiveAction.trim() || undefined,
      notes: notes.trim() || undefined,
    }

    try {
      await createSedimentRun.mutateAsync(payload)
      toast[isGlobalApproved ? 'success' : 'warning'](
        isGlobalApproved
          ? 'Controle inter-observador aprovado e registrado com sucesso!'
          : 'Controle inter-observador registrado com status REPROVADO e ação corretiva anexada.'
      )
      setCorrectiveAction('')
      setNotes('')
    } catch {
      toast.error('Erro ao salvar controle do sedimento.')
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Sedimento Urinário (Controle Inter-Observador)</h2>
            <p className="text-sm text-neutral-500 mt-0.5">
              Avaliação de concordância e proficiência interna entre dois analistas na mesma amostra de microscopia (dupla leitura).
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seção 1: Identificação */}
          <div className="space-y-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-800">
                1. Identificação da Amostra e Analistas
              </div>
              <div className="mt-1 text-sm text-neutral-500">
                Informe o código do paciente/amostra e os dois analistas participantes da leitura cruzada.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Input
                  label="Data da Leitura *"
                  type="date"
                  value={dataMedicao}
                  onChange={(e) => setDataMedicao(e.target.value)}
                  icon={<Calendar className="h-4 w-4" />}
                  required
                />
              </div>

              <div>
                <Input
                  label="Código do Paciente / Amostra *"
                  placeholder="Ex: 11111111"
                  value={patientCode}
                  onChange={(e) => setPatientCode(e.target.value)}
                  required
                />
              </div>

              <div>
                <Select
                  label="Analista 1 *"
                  value={analyst1Id}
                  onChange={(e) => handleAnalyst1Change(e.target.value)}
                  icon={<Users className="h-4 w-4" />}
                >
                  <option value="">Selecione o Analista 1</option>
                  {responsibles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
                {!analyst1Id && (
                  <input
                    type="text"
                    placeholder="Ou digite o nome..."
                    className="mt-1.5 w-full text-xs rounded-lg border border-neutral-200 px-2 py-1"
                    value={analyst1Name}
                    onChange={(e) => setAnalyst1Name(e.target.value)}
                  />
                )}
              </div>

              <div>
                <Select
                  label="Analista 2 *"
                  value={analyst2Id}
                  onChange={(e) => handleAnalyst2Change(e.target.value)}
                  icon={<Users className="h-4 w-4" />}
                >
                  <option value="">Selecione o Analista 2</option>
                  {responsibles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
                {!analyst2Id && (
                  <input
                    type="text"
                    placeholder="Ou digite o nome..."
                    className="mt-1.5 w-full text-xs rounded-lg border border-neutral-200 px-2 py-1"
                    value={analyst2Name}
                    onChange={(e) => setAnalyst2Name(e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Seção 2: Tabela de Comparação Lado a Lado */}
          <div className="space-y-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-800">
                2. Comparação de Leituras Microscópicas
              </div>
              <div className="mt-1 text-sm text-neutral-500">
                Leucócitos e hemácias toleram variação de CV ≤ 20%. Elementos qualitativos exigem concordância plena.
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-xs">
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-600">
                  <tr>
                    <th className="py-3 px-4 text-left">Parâmetro Microscópico</th>
                    <th className="py-3 px-4 text-center">Analista 1</th>
                    <th className="py-3 px-4 text-center">Analista 2</th>
                    <th className="py-3 px-4 text-center">Concordância / CV</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {/* Leucócitos */}
                  <tr className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-neutral-900">Leucócitos</span>
                      <span className="ml-2 text-xs text-neutral-500 font-mono">(Tolerância: CV ≤ 20%)</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        className="w-24 text-center rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-1.5 font-semibold text-neutral-900 focus:border-green-800 focus:outline-none"
                        value={leukocytesA1}
                        onChange={(e) => setLeukocytesA1(parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        className="w-24 text-center rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-1.5 font-semibold text-neutral-900 focus:border-green-800 focus:outline-none"
                        value={leukocytesA2}
                        onChange={(e) => setLeukocytesA2(parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-neutral-700">
                      CV: {leukocytesCv.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={statusLeukocytes} />
                    </td>
                  </tr>

                  {/* Hemácias */}
                  <tr className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-neutral-900">Hemácias</span>
                      <span className="ml-2 text-xs text-neutral-500 font-mono">(Tolerância: CV ≤ 20%)</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        className="w-24 text-center rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-1.5 font-semibold text-neutral-900 focus:border-green-800 focus:outline-none"
                        value={erythrocytesA1}
                        onChange={(e) => setErythrocytesA1(parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        className="w-24 text-center rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-1.5 font-semibold text-neutral-900 focus:border-green-800 focus:outline-none"
                        value={erythrocytesA2}
                        onChange={(e) => setErythrocytesA2(parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-neutral-700">
                      CV: {erythrocytesCv.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={statusErythrocytes} />
                    </td>
                  </tr>

                  {/* Bactérias */}
                  <tr className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-4 font-semibold text-neutral-900">Bactérias</td>
                    <td className="py-3 px-4 text-center">
                      <select
                        className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-1.5 text-xs font-semibold text-neutral-900 focus:border-green-800 focus:outline-none"
                        value={bacteriaA1}
                        onChange={(e) => setBacteriaA1(e.target.value)}
                      >
                        {BACTERIA_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <select
                        className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-1.5 text-xs font-semibold text-neutral-900 focus:border-green-800 focus:outline-none"
                        value={bacteriaA2}
                        onChange={(e) => setBacteriaA2(e.target.value)}
                      >
                        {BACTERIA_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-center text-xs font-medium text-neutral-600">
                      {statusBacteria === 'APROVADO' ? 'Idêntico' : 'Divergente'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={statusBacteria} />
                    </td>
                  </tr>

                  {/* Células Epiteliais */}
                  <tr className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-4 font-semibold text-neutral-900">Células Epiteliais</td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5">
                        {BINARY_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setEpithelialCellsA1(opt)}
                            className={cn(
                              'px-3 py-1 text-xs font-medium rounded-lg transition',
                              epithelialCellsA1 === opt
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
                      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5">
                        {BINARY_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setEpithelialCellsA2(opt)}
                            className={cn(
                              'px-3 py-1 text-xs font-medium rounded-lg transition',
                              epithelialCellsA2 === opt
                                ? 'bg-green-800 text-white font-semibold shadow-xs'
                                : 'text-neutral-600 hover:text-neutral-900'
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-xs font-medium text-neutral-600">
                      {statusEpithelialCells === 'APROVADO' ? 'Idêntico' : 'Divergente'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={statusEpithelialCells} />
                    </td>
                  </tr>

                  {/* Filamento de Muco */}
                  <tr className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-4 font-semibold text-neutral-900">Filamento de Muco</td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5">
                        {BINARY_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setMucusThreadsA1(opt)}
                            className={cn(
                              'px-3 py-1 text-xs font-medium rounded-lg transition',
                              mucusThreadsA1 === opt
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
                      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5">
                        {BINARY_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setMucusThreadsA2(opt)}
                            className={cn(
                              'px-3 py-1 text-xs font-medium rounded-lg transition',
                              mucusThreadsA2 === opt
                                ? 'bg-green-800 text-white font-semibold shadow-xs'
                                : 'text-neutral-600 hover:text-neutral-900'
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-xs font-medium text-neutral-600">
                      {statusMucusThreads === 'APROVADO' ? 'Idêntico' : 'Divergente'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={statusMucusThreads} />
                    </td>
                  </tr>

                  {/* Cristais */}
                  <tr className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-4 font-semibold text-neutral-900">Cristais</td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5">
                        {BINARY_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setCrystalsA1(opt)}
                            className={cn(
                              'px-3 py-1 text-xs font-medium rounded-lg transition',
                              crystalsA1 === opt
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
                      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5">
                        {BINARY_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setCrystalsA2(opt)}
                            className={cn(
                              'px-3 py-1 text-xs font-medium rounded-lg transition',
                              crystalsA2 === opt
                                ? 'bg-green-800 text-white font-semibold shadow-xs'
                                : 'text-neutral-600 hover:text-neutral-900'
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-xs font-medium text-neutral-600">
                      {statusCrystals === 'APROVADO' ? 'Idêntico' : 'Divergente'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={statusCrystals} />
                    </td>
                  </tr>

                  {/* Outros */}
                  <tr className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-4 font-semibold text-neutral-900">Outros (Cilindros / Leveduras)</td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5">
                        {BINARY_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setOthersA1(opt)}
                            className={cn(
                              'px-3 py-1 text-xs font-medium rounded-lg transition',
                              othersA1 === opt
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
                      <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5">
                        {BINARY_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setOthersA2(opt)}
                            className={cn(
                              'px-3 py-1 text-xs font-medium rounded-lg transition',
                              othersA2 === opt
                                ? 'bg-green-800 text-white font-semibold shadow-xs'
                                : 'text-neutral-600 hover:text-neutral-900'
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-xs font-medium text-neutral-600">
                      {statusOthers === 'APROVADO' ? 'Idêntico' : 'Divergente'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={statusOthers} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Banner de Avaliação Geral Instantânea do Sedimento */}
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
                  {isGlobalApproved ? 'SEDIMENTO APROVADO' : 'SEDIMENTO COM DIVERGÊNCIA (REPROVADO)'}
                </h4>
                <p className="text-sm opacity-90">
                  {isGlobalApproved
                    ? 'Todas as contagens apresentaram CV ≤ 20% e os elementos microscópicos coincidiram entre os dois analistas.'
                    : 'Houve divergência nas leituras microscópicas ou o CV ultrapassou o limite aceitável de 20%. Exige ação corretiva.'}
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
                <h4 className="font-bold text-sm">Ação Corretiva Obrigatória (Sedimento com Divergência)</h4>
              </div>
              <p className="text-xs text-red-700">
                Houve divergência entre os analistas ou a contagem excedeu 20% de variação. Registre a conduta corretiva realizada.
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_SEDIMENT_ACTIONS.map((action) => (
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
                placeholder="Descreva a ação tomada pelos analistas para harmonização dos resultados..."
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
              disabled={createSedimentRun.isPending || !canManageQc}
              className="w-full sm:w-auto h-11 rounded-xl bg-green-800 hover:bg-green-900 text-white font-semibold min-w-48 shadow-sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {createSedimentRun.isPending ? 'Gravando...' : 'Salvar Dupla Leitura'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

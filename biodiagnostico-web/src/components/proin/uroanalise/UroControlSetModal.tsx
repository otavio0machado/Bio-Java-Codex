import { useState, useEffect } from 'react'
import { Modal, Button, Input, Select, useToast } from '../../ui'
import { useCreateUroStripControlSet, useUpdateUroStripControlSet } from '../../../hooks/useUroanalise'
import type { UroStripControlSet, UroStripControlSetRequest } from '../../../types'

const QUALITATIVE_OPTIONS = ['NEGATIVO', 'TRAÇOS', '+', '++', '+++', '++++']
const UROBILINOGEN_OPTIONS = ['NEGATIVO', 'AUMENTADO']

interface UroControlSetModalProps {
  isOpen: boolean
  onClose: () => void
  editingControlSet?: UroStripControlSet | null
}

const normalizeLegacyUro = (val?: string | null): string => {
  if (!val) return 'NEGATIVO'
  const s = val.trim().toUpperCase()
  if (s === 'NORMAL' || s === '0.2 MG/DL' || s === '0' || s === 'NEG' || s === 'NEGATIVO' || s === 'AUSENTE') {
    return 'NEGATIVO'
  }
  if (s.includes('AUMENTADO') || s.includes('1.0') || s.includes('2.0')) {
    return 'AUMENTADO'
  }
  return val
}

export function UroControlSetModal({ isOpen, onClose, editingControlSet }: UroControlSetModalProps) {
  const { toast } = useToast()
  const createControlSet = useCreateUroStripControlSet()
  const updateControlSet = useUpdateUroStripControlSet()

  const [controlLotNumber, setControlLotNumber] = useState('URiE 02382024')
  const [manufacturer, setManufacturer] = useState('Uro-Trol')
  const [validUntil, setValidUntil] = useState('2026-04-23')

  const [expectedPhMin, setExpectedPhMin] = useState<number>(5.0)
  const [expectedPhMax, setExpectedPhMax] = useState<number>(6.0)
  const [expectedDensityMin, setExpectedDensityMin] = useState<number>(1.005)
  const [expectedDensityMax, setExpectedDensityMax] = useState<number>(1.025)

  const [expectedProteins, setExpectedProteins] = useState('NEGATIVO')
  const [expectedGlucose, setExpectedGlucose] = useState('NEGATIVO')
  const [expectedKetones, setExpectedKetones] = useState('NEGATIVO')
  const [expectedBlood, setExpectedBlood] = useState('NEGATIVO')
  const [expectedUrobilinogen, setExpectedUrobilinogen] = useState('NEGATIVO')
  const [expectedNitrite, setExpectedNitrite] = useState('NEGATIVO')
  const [expectedBilirubin, setExpectedBilirubin] = useState('NEGATIVO')
  const [expectedLeukocytes, setExpectedLeukocytes] = useState('NEGATIVO')

  useEffect(() => {
    if (editingControlSet) {
      setControlLotNumber(editingControlSet.controlLotNumber)
      setManufacturer(editingControlSet.manufacturer)
      setValidUntil(editingControlSet.validUntil)
      setExpectedPhMin(editingControlSet.expectedPhMin ?? 5.0)
      setExpectedPhMax(editingControlSet.expectedPhMax ?? 6.0)
      setExpectedDensityMin(editingControlSet.expectedDensityMin ?? 1.005)
      setExpectedDensityMax(editingControlSet.expectedDensityMax ?? 1.025)
      setExpectedProteins(editingControlSet.expectedProteins)
      setExpectedGlucose(editingControlSet.expectedGlucose)
      setExpectedKetones(editingControlSet.expectedKetones)
      setExpectedBlood(editingControlSet.expectedBlood)
      setExpectedUrobilinogen(normalizeLegacyUro(editingControlSet.expectedUrobilinogen))
      setExpectedNitrite(editingControlSet.expectedNitrite)
      setExpectedBilirubin(editingControlSet.expectedBilirubin)
      setExpectedLeukocytes(editingControlSet.expectedLeukocytes)
    } else {
      setControlLotNumber('URiE 02382024')
      setManufacturer('Uro-Trol')
      setValidUntil('2026-04-23')
      setExpectedPhMin(5.0)
      setExpectedPhMax(6.0)
      setExpectedDensityMin(1.005)
      setExpectedDensityMax(1.025)
      setExpectedProteins('NEGATIVO')
      setExpectedGlucose('NEGATIVO')
      setExpectedKetones('NEGATIVO')
      setExpectedBlood('NEGATIVO')
      setExpectedUrobilinogen('NEGATIVO')
      setExpectedNitrite('NEGATIVO')
      setExpectedBilirubin('NEGATIVO')
      setExpectedLeukocytes('NEGATIVO')
    }
  }, [editingControlSet, isOpen])

  const isSaving = createControlSet.isPending || updateControlSet.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!controlLotNumber.trim() || !manufacturer.trim() || !validUntil) {
      toast.warning('Preencha os campos obrigatórios do lote de controle.')
      return
    }

    const payload: UroStripControlSetRequest = {
      controlLotNumber: controlLotNumber.trim(),
      manufacturer: manufacturer.trim(),
      validUntil,
      expectedPhMin,
      expectedPhMax,
      expectedDensityMin,
      expectedDensityMax,
      expectedProteins,
      expectedGlucose,
      expectedKetones,
      expectedBlood,
      expectedUrobilinogen,
      expectedNitrite,
      expectedBilirubin,
      expectedLeukocytes,
    }

    try {
      if (editingControlSet) {
        await updateControlSet.mutateAsync({ id: editingControlSet.id, request: payload })
        toast.success('Lote de controle de urina atualizado com sucesso!')
      } else {
        await createControlSet.mutateAsync(payload)
        toast.success('Lote de controle de urina cadastrado com sucesso!')
      }
      onClose()
    } catch {
      toast.error('Erro ao salvar lote de controle.')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingControlSet ? 'Editar Lote de Controle de Urina' : 'Novo Lote de Controle de Urina'}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={isSaving}>
            {editingControlSet ? 'Atualizar Lote' : 'Cadastrar Lote'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificação Geral */}
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-800">
            1. Identificação do Controle Comercial
          </div>
          <div className="mt-1 text-sm text-neutral-500">
            Dados da bula do controle interno comercial (ex: Urina Controle / Uro-Trol).
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Número do Lote *"
            placeholder="Ex: URiE 02382024"
            value={controlLotNumber}
            onChange={(e) => setControlLotNumber(e.target.value)}
            required
          />
          <Input
            label="Fabricante / Marca *"
            placeholder="Ex: Uro-Trol / Biodiagnóstico"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            required
          />
          <Input
            label="Data de Validade *"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            required
          />
        </div>

        {/* Parâmetros Quantitativos / Faixas */}
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-800">
            2. Faixas Numéricas Aceitáveis da Bula
          </div>
          <div className="mt-1 text-sm text-neutral-500">
            Intervalos numéricos esperados para pH e densidade urinária.
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Input
            label="pH Mínimo"
            type="number"
            step="0.5"
            value={expectedPhMin}
            onChange={(e) => setExpectedPhMin(parseFloat(e.target.value) || 0)}
          />
          <Input
            label="pH Máximo"
            type="number"
            step="0.5"
            value={expectedPhMax}
            onChange={(e) => setExpectedPhMax(parseFloat(e.target.value) || 0)}
          />
          <Input
            label="Densidade Mín."
            type="number"
            step="0.001"
            value={expectedDensityMin}
            onChange={(e) => setExpectedDensityMin(parseFloat(e.target.value) || 0)}
          />
          <Input
            label="Densidade Máx."
            type="number"
            step="0.001"
            value={expectedDensityMax}
            onChange={(e) => setExpectedDensityMax(parseFloat(e.target.value) || 0)}
          />
        </div>

        {/* Parâmetros Qualitativos */}
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-800">
            3. Valores Esperados Qualitativos
          </div>
          <div className="mt-1 text-sm text-neutral-500">
            Constituintes da fita reagente especificados na bula do controle.
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Select label="Proteínas" value={expectedProteins} onChange={(e) => setExpectedProteins(e.target.value)}>
            {QUALITATIVE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>

          <Select label="Glicose" value={expectedGlucose} onChange={(e) => setExpectedGlucose(e.target.value)}>
            {QUALITATIVE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>

          <Select label="Corpos Cetônicos" value={expectedKetones} onChange={(e) => setExpectedKetones(e.target.value)}>
            {QUALITATIVE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>

          <Select label="Sangue / Hb" value={expectedBlood} onChange={(e) => setExpectedBlood(e.target.value)}>
            {QUALITATIVE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>

          <Select label="Urobilinogênio" value={expectedUrobilinogen} onChange={(e) => setExpectedUrobilinogen(e.target.value)}>
            {UROBILINOGEN_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>

          <Select label="Nitrito" value={expectedNitrite} onChange={(e) => setExpectedNitrite(e.target.value)}>
            <option value="NEGATIVO">NEGATIVO</option>
            <option value="POSITIVO">POSITIVO</option>
          </Select>

          <Select label="Bilirrubina" value={expectedBilirubin} onChange={(e) => setExpectedBilirubin(e.target.value)}>
            {QUALITATIVE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>

          <Select label="Leucócitos" value={expectedLeukocytes} onChange={(e) => setExpectedLeukocytes(e.target.value)}>
            {QUALITATIVE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        </div>
      </form>
    </Modal>
  )
}

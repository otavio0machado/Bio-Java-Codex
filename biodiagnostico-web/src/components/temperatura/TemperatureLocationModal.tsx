import { useEffect, useState } from 'react'
import {
  useCreateTemperatureLocation,
  useUpdateTemperatureLocation,
} from '../../hooks/useTemperature'
import type {
  LocationCategory,
  TemperatureLocation,
  TemperatureLocationRequest,
} from '../../types/temperature'
import { Button, Input, Modal, Select, TextArea, useToast } from '../ui'

interface TemperatureLocationModalProps {
  isOpen: boolean
  onClose: () => void
  locationToEdit?: TemperatureLocation | null
}

const CATEGORY_OPTIONS = [
  { value: 'GELADEIRA', label: 'Geladeira (Reagentes / Amostras)' },
  { value: 'FREEZER', label: 'Freezer (-20°C / -80°C)' },
  { value: 'ESTUFA', label: 'Estufa Bacteriológica / Cultura' },
  { value: 'BANHO_MARIA', label: 'Banho-Maria' },
  { value: 'AMBIENTE', label: 'Sala Técnica / Ambiente' },
  { value: 'OUTRO', label: 'Outro Equipamento' },
]

const AREA_OPTIONS = [
  { value: 'GERAL', label: 'Geral / Compartilhado' },
  { value: 'BIOQUIMICA', label: 'Bioquímica' },
  { value: 'HEMATOLOGIA', label: 'Hematologia' },
  { value: 'IMUNOLOGIA', label: 'Imunologia' },
  { value: 'MICROBIOLOGIA', label: 'Microbiologia' },
  { value: 'COAGULACAO', label: 'Coagulação' },
  { value: 'URINALISE', label: 'Uroanálise' },
]

export function TemperatureLocationModal({
  isOpen,
  onClose,
  locationToEdit,
}: TemperatureLocationModalProps) {
  const { toast } = useToast()
  const createLocation = useCreateTemperatureLocation()
  const updateLocation = useUpdateTemperatureLocation()

  const [name, setName] = useState<string>('')
  const [code, setCode] = useState<string>('')
  const [category, setCategory] = useState<LocationCategory | string>('GELADEIRA')
  const [area, setArea] = useState<string>('GERAL')
  const [minTempTarget, setMinTempTarget] = useState<string>('2.0')
  const [maxTempTarget, setMaxTempTarget] = useState<string>('8.0')
  const [minHumidityTarget, setMinHumidityTarget] = useState<string>('')
  const [maxHumidityTarget, setMaxHumidityTarget] = useState<string>('')
  const [thermometerCode, setThermometerCode] = useState<string>('')
  const [calibrationCertNumber, setCalibrationCertNumber] = useState<string>('')
  const [calibrationDueDate, setCalibrationDueDate] = useState<string>('')
  const [frequency, setFrequency] = useState<string>('DIARIO_1X')
  const [active, setActive] = useState<boolean>(true)
  const [notes, setNotes] = useState<string>('')

  useEffect(() => {
    if (locationToEdit) {
      setName(locationToEdit.name)
      setCode(locationToEdit.code)
      setCategory(locationToEdit.category)
      setArea(locationToEdit.area || 'GERAL')
      setMinTempTarget(String(locationToEdit.minTempTarget))
      setMaxTempTarget(String(locationToEdit.maxTempTarget))
      setMinHumidityTarget(
        locationToEdit.minHumidityTarget !== null && locationToEdit.minHumidityTarget !== undefined
          ? String(locationToEdit.minHumidityTarget)
          : ''
      )
      setMaxHumidityTarget(
        locationToEdit.maxHumidityTarget !== null && locationToEdit.maxHumidityTarget !== undefined
          ? String(locationToEdit.maxHumidityTarget)
          : ''
      )
      setThermometerCode(locationToEdit.thermometerCode || '')
      setCalibrationCertNumber(locationToEdit.calibrationCertNumber || '')
      setCalibrationDueDate(locationToEdit.calibrationDueDate || '')
      setFrequency(locationToEdit.frequency || 'DIARIO_1X')
      setActive(locationToEdit.active ?? true)
      setNotes(locationToEdit.notes || '')
    } else {
      setName('')
      setCode('')
      setCategory('GELADEIRA')
      setArea('GERAL')
      setMinTempTarget('2.0')
      setMaxTempTarget('8.0')
      setMinHumidityTarget('')
      setMaxHumidityTarget('')
      setThermometerCode('')
      setCalibrationCertNumber('')
      setCalibrationDueDate('')
      setFrequency('DIARIO_1X')
      setActive(true)
      setNotes('')
    }
  }, [locationToEdit, isOpen])

  const handleCategoryChange = (val: string) => {
    setCategory(val)
    if (val === 'GELADEIRA') {
      setMinTempTarget('2.0')
      setMaxTempTarget('8.0')
    } else if (val === 'FREEZER') {
      setMinTempTarget('-25.0')
      setMaxTempTarget('-15.0')
    } else if (val === 'ESTUFA') {
      setMinTempTarget('35.0')
      setMaxTempTarget('37.0')
    } else if (val === 'BANHO_MARIA') {
      setMinTempTarget('36.0')
      setMaxTempTarget('38.0')
    } else if (val === 'AMBIENTE') {
      setMinTempTarget('15.0')
      setMaxTempTarget('25.0')
      setMinHumidityTarget('30.0')
      setMaxHumidityTarget('70.0')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const numMin = parseFloat(minTempTarget.replace(',', '.'))
    const numMax = parseFloat(maxTempTarget.replace(',', '.'))
    const numMinHum = minHumidityTarget ? parseFloat(minHumidityTarget.replace(',', '.')) : null
    const numMaxHum = maxHumidityTarget ? parseFloat(maxHumidityTarget.replace(',', '.')) : null

    if (!name.trim() || !code.trim()) {
      toast.error('Informe o nome e o código do equipamento.')
      return
    }
    if (isNaN(numMin) || isNaN(numMax)) {
      toast.error('Informe as temperaturas mínima e máxima aceitáveis.')
      return
    }
    if (numMin > numMax) {
      toast.error('A temperatura mínima não pode ser superior à máxima.')
      return
    }

    const payload: TemperatureLocationRequest = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      category,
      area,
      minTempTarget: numMin,
      maxTempTarget: numMax,
      minHumidityTarget: numMinHum,
      maxHumidityTarget: numMaxHum,
      thermometerCode: thermometerCode.trim() || null,
      calibrationCertNumber: calibrationCertNumber.trim() || null,
      calibrationDueDate: calibrationDueDate || null,
      frequency,
      active,
      notes: notes.trim() || null,
    }

    if (locationToEdit) {
      updateLocation.mutate(
        { id: locationToEdit.id, request: payload },
        {
          onSuccess: () => {
            toast.success('Equipamento atualizado com sucesso!')
            onClose()
          },
          onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Falha ao atualizar equipamento.')
          },
        }
      )
    } else {
      createLocation.mutate(payload, {
        onSuccess: () => {
          toast.success('Equipamento cadastrado com sucesso!')
          onClose()
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || 'Falha ao cadastrar equipamento.')
        },
      })
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={locationToEdit ? 'Editar Ponto de Monitoramento' : 'Novo Ponto de Monitoramento'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-neutral-700">Nome do Ponto / Equipamento *</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Geladeira 1 - Reagentes"
              className="mt-1"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700">Código / Tag *</label>
            <Input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex: GEL-01"
              className="mt-1 font-mono uppercase"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-neutral-700">Tipo de Ponto *</label>
            <Select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="mt-1"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700">Setor / Área Técnica</label>
            <Select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="mt-1"
            >
              {AREA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
            Faixas de Tolerância Aceitáveis
          </h4>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs text-neutral-600">Temp. Mín (°C) *</label>
              <Input
                type="text"
                value={minTempTarget}
                onChange={(e) => setMinTempTarget(e.target.value)}
                className="mt-1 font-semibold"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-600">Temp. Máx (°C) *</label>
              <Input
                type="text"
                value={maxTempTarget}
                onChange={(e) => setMaxTempTarget(e.target.value)}
                className="mt-1 font-semibold"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-600">Umidade Mín (%)</label>
              <Input
                type="text"
                value={minHumidityTarget}
                onChange={(e) => setMinHumidityTarget(e.target.value)}
                placeholder="Opcional"
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-600">Umidade Máx (%)</label>
              <Input
                type="text"
                value={maxHumidityTarget}
                onChange={(e) => setMaxHumidityTarget(e.target.value)}
                placeholder="Opcional"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
            Termômetro Vinculado & Calibração RBC
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-neutral-600">Identificação do Termômetro</label>
              <Input
                type="text"
                value={thermometerCode}
                onChange={(e) => setThermometerCode(e.target.value)}
                placeholder="Ex: TERM-01 (Incoterm)"
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-600">Certificado de Calibração</label>
              <Input
                type="text"
                value={calibrationCertNumber}
                onChange={(e) => setCalibrationCertNumber(e.target.value)}
                placeholder="Ex: CAL-2026/012"
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-600">Validade da Calibração</label>
              <Input
                type="date"
                value={calibrationDueDate}
                onChange={(e) => setCalibrationDueDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700">Observações</label>
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Localização específica, detalhes do sensor, etc."
            rows={2}
            className="mt-1"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={createLocation.isPending || updateLocation.isPending}
          >
            {locationToEdit ? 'Atualizar Ponto' : 'Cadastrar Ponto'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

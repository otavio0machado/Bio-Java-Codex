import {
  Building2,
  Check,
  Flame,
  Layers,
  ShieldCheck,
  Snowflake,
  Thermometer,
} from 'lucide-react'
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
  onSuccessCreated?: (createdLocation: TemperatureLocation) => void
}

interface PresetOption {
  category: LocationCategory
  title: string
  subtitle: string
  icon: any
  defaultMin: string
  defaultMax: string
  defaultMinHum?: string
  defaultMaxHum?: string
  codePrefix: string
  color: string
  borderActive: string
  badgeColor: string
}

const PRESETS: PresetOption[] = [
  {
    category: 'GELADEIRA',
    title: 'Geladeira',
    subtitle: 'Reagentes, Amostras e Vacinas',
    icon: Snowflake,
    defaultMin: '2.0',
    defaultMax: '8.0',
    codePrefix: 'GEL',
    color: 'text-sky-600 bg-sky-50',
    borderActive: 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/40',
    badgeColor: 'bg-sky-100 text-sky-800',
  },
  {
    category: 'FREEZER',
    title: 'Freezer',
    subtitle: 'Soros, Controles e Placas',
    icon: Snowflake,
    defaultMin: '-25.0',
    defaultMax: '-15.0',
    codePrefix: 'FRZ',
    color: 'text-indigo-600 bg-indigo-50',
    borderActive: 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/40',
    badgeColor: 'bg-indigo-100 text-indigo-800',
  },
  {
    category: 'AMBIENTE',
    title: 'Ambiente / Sala',
    subtitle: 'Sala Técnica & Termohigrometria',
    icon: Building2,
    defaultMin: '15.0',
    defaultMax: '25.0',
    defaultMinHum: '30.0',
    defaultMaxHum: '70.0',
    codePrefix: 'AMB',
    color: 'text-emerald-600 bg-emerald-50',
    borderActive: 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40',
    badgeColor: 'bg-emerald-100 text-emerald-800',
  },
  {
    category: 'ESTUFA',
    title: 'Estufa Bacteriológica',
    subtitle: 'Incubação e Cultura',
    icon: Flame,
    defaultMin: '35.0',
    defaultMax: '37.0',
    codePrefix: 'EST',
    color: 'text-amber-600 bg-amber-50',
    borderActive: 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/40',
    badgeColor: 'bg-amber-100 text-amber-800',
  },
  {
    category: 'BANHO_MARIA',
    title: 'Banho-Maria',
    subtitle: 'Reações e Aquecimento',
    icon: Flame,
    defaultMin: '36.0',
    defaultMax: '38.0',
    codePrefix: 'BM',
    color: 'text-rose-600 bg-rose-50',
    borderActive: 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/40',
    badgeColor: 'bg-rose-100 text-rose-800',
  },
  {
    category: 'OUTRO',
    title: 'Personalizado',
    subtitle: 'Outros Equipamentos',
    icon: Layers,
    defaultMin: '0.0',
    defaultMax: '10.0',
    codePrefix: 'EQP',
    color: 'text-neutral-600 bg-neutral-100',
    borderActive: 'border-neutral-700 ring-2 ring-neutral-700/20 bg-neutral-50',
    badgeColor: 'bg-neutral-200 text-neutral-800',
  },
]

const AREA_OPTIONS = [
  { value: 'GERAL', label: 'Geral / Compartilhado' },
  { value: 'BIOQUIMICA', label: 'Bioquímica' },
  { value: 'HEMATOLOGIA', label: 'Hematologia' },
  { value: 'IMUNOLOGIA', label: 'Imunologia' },
  { value: 'MICROBIOLOGIA', label: 'Microbiologia' },
  { value: 'COAGULACAO', label: 'Coagulação' },
  { value: 'URINALISE', label: 'Uroanálise' },
  { value: 'TRIAGEM', label: 'Triagem / Recepção' },
]

export function TemperatureLocationModal({
  isOpen,
  onClose,
  locationToEdit,
  onSuccessCreated,
}: TemperatureLocationModalProps) {
  const { toast } = useToast()
  const createLocation = useCreateTemperatureLocation()
  const updateLocation = useUpdateTemperatureLocation()

  const [selectedPreset, setSelectedPreset] = useState<LocationCategory>('GELADEIRA')
  const [name, setName] = useState<string>('')
  const [code, setCode] = useState<string>('')
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

  // Estado para controlar se o usuário customizou manualmente o código
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState<boolean>(false)

  useEffect(() => {
    if (locationToEdit) {
      setSelectedPreset((locationToEdit.category as LocationCategory) || 'GELADEIRA')
      setName(locationToEdit.name)
      setCode(locationToEdit.code)
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
      setIsCodeManuallyEdited(true)
    } else {
      applyPreset('GELADEIRA', false)
      setName('')
      setArea('GERAL')
      setThermometerCode('')
      setCalibrationCertNumber('')
      setCalibrationDueDate('')
      setFrequency('DIARIO_1X')
      setActive(true)
      setNotes('')
      setIsCodeManuallyEdited(false)
    }
  }, [locationToEdit, isOpen])

  const applyPreset = (category: LocationCategory, updateCode = true) => {
    setSelectedPreset(category)
    const preset = PRESETS.find((p) => p.category === category)
    if (!preset) return

    setMinTempTarget(preset.defaultMin)
    setMaxTempTarget(preset.defaultMax)
    setMinHumidityTarget(preset.defaultMinHum || '')
    setMaxHumidityTarget(preset.defaultMaxHum || '')

    if (updateCode && !isCodeManuallyEdited) {
      setCode(`${preset.codePrefix}-01`)
    }
  }

  const handleNameChange = (val: string) => {
    setName(val)
    if (!isCodeManuallyEdited && !locationToEdit) {
      const preset = PRESETS.find((p) => p.category === selectedPreset)
      const prefix = preset ? preset.codePrefix : 'EQP'
      // Tenta extrair número do nome digitado (ex: "Geladeira 2" -> "GEL-02")
      const numMatch = val.match(/\d+/)
      const numStr = numMatch ? String(numMatch[0]).padStart(2, '0') : '01'
      setCode(`${prefix}-${numStr}`)
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
      toast.error('Informe as temperaturas mínima e máxima da faixa aceitável.')
      return
    }
    if (numMin > numMax) {
      toast.error('A temperatura mínima não pode ser superior à máxima.')
      return
    }

    const payload: TemperatureLocationRequest = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      category: selectedPreset,
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
          onSuccess: (updated) => {
            toast.success('Ponto de monitoramento atualizado com sucesso!')
            if (onSuccessCreated) onSuccessCreated(updated)
            onClose()
          },
          onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Falha ao atualizar ponto.')
          },
        }
      )
    } else {
      createLocation.mutate(payload, {
        onSuccess: (created) => {
          toast.success(`Ponto "${created.name}" cadastrado com sucesso!`)
          if (onSuccessCreated) onSuccessCreated(created)
          onClose()
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || 'Falha ao cadastrar ponto.')
        },
      })
    }
  }

  const currentPresetInfo = PRESETS.find((p) => p.category === selectedPreset)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={locationToEdit ? 'Editar Ponto de Monitoramento' : 'Novo Ponto de Monitoramento'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Seleção Rápida de Preset com 1 Clique */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
            1. Tipo de Equipamento / Ambiente (Preset Rápido)
          </label>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {PRESETS.map((p) => {
              const Icon = p.icon
              const isSelected = selectedPreset === p.category
              return (
                <button
                  key={p.category}
                  type="button"
                  onClick={() => applyPreset(p.category, true)}
                  className={`relative flex flex-col items-start rounded-2xl border p-3 text-left transition-all ${
                    isSelected
                      ? p.borderActive
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/80'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </div>
                  )}
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${p.color} mb-2`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="font-semibold text-xs text-neutral-900 leading-tight">
                    {p.title}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 line-clamp-1">
                    {p.subtitle}
                  </div>
                  <div className="mt-2 text-[10px] font-mono font-medium text-emerald-700 bg-emerald-50/80 px-1.5 py-0.5 rounded-md border border-emerald-200/50">
                    {p.defaultMin}°C a {p.defaultMax}°C
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. Identificação e Setor */}
        <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              2. Identificação & Setor Técnico
            </span>
            <span className="text-[11px] text-neutral-400 font-normal">
              Aparecerá nos relatórios ANVISA e no lançamento diário
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-700">
                Nome do Ponto / Equipamento *
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Geladeira 1 - Reagentes Bioquímica"
                className="mt-1 font-medium text-neutral-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700">
                Tag / Código *
              </label>
              <Input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  setIsCodeManuallyEdited(true)
                }}
                placeholder="Ex: GEL-01"
                className="mt-1 font-mono uppercase font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-neutral-700">
                Setor / Área Técnica
              </label>
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

            <div>
              <label className="block text-xs font-semibold text-neutral-700">
                Frequência de Monitoramento
              </label>
              <Select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="mt-1"
              >
                <option value="DIARIO_1X">1x ao dia (Diário Único)</option>
                <option value="DIARIO_2X">2x ao dia (Manhã e Tarde)</option>
                <option value="DIARIO_3X">3x ao dia (Turnos M / T / N)</option>
              </Select>
            </div>
          </div>
        </div>

        {/* 3. Faixas Críticas de Tolerância */}
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Thermometer className="h-4 w-4 text-emerald-700" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                3. Faixas Aceitáveis (Critério de Conformidade)
              </span>
            </div>
            <span className="text-[11px] text-emerald-700">
              Valores fora desta faixa gerarão alerta de não-conformidade
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-rose-700">
                Temp. Mín (°C) *
              </label>
              <Input
                type="text"
                value={minTempTarget}
                onChange={(e) => setMinTempTarget(e.target.value)}
                placeholder="Ex: 2.0"
                className="mt-1 font-bold text-neutral-900 border-rose-200 focus-within:border-rose-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-rose-700">
                Temp. Máx (°C) *
              </label>
              <Input
                type="text"
                value={maxTempTarget}
                onChange={(e) => setMaxTempTarget(e.target.value)}
                placeholder="Ex: 8.0"
                className="mt-1 font-bold text-neutral-900 border-rose-200 focus-within:border-rose-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-600">
                UR Mín (%) <span className="text-neutral-400 font-normal">opcional</span>
              </label>
              <Input
                type="text"
                value={minHumidityTarget}
                onChange={(e) => setMinHumidityTarget(e.target.value)}
                placeholder="Ex: 30"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-600">
                UR Máx (%) <span className="text-neutral-400 font-normal">opcional</span>
              </label>
              <Input
                type="text"
                value={maxHumidityTarget}
                onChange={(e) => setMaxHumidityTarget(e.target.value)}
                placeholder="Ex: 70"
                className="mt-1 text-xs"
              />
            </div>
          </div>
        </div>

        {/* 4. Rastreabilidade ANVISA e Calibração RBC */}
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-neutral-700" />
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              4. Termômetro Vinculado & Calibração RBC (Auditoria)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-neutral-600">Identificação do Termômetro</label>
              <Input
                type="text"
                value={thermometerCode}
                onChange={(e) => setThermometerCode(e.target.value)}
                placeholder="Ex: TERM-01 (Incoterm)"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-600">Certificado RBC</label>
              <Input
                type="text"
                value={calibrationCertNumber}
                onChange={(e) => setCalibrationCertNumber(e.target.value)}
                placeholder="Ex: CAL-2026/044"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-600">Validade da Calibração</label>
              <Input
                type="date"
                value={calibrationDueDate}
                onChange={(e) => setCalibrationDueDate(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>
          </div>
        </div>

        {/* 5. Pré-visualização Operacional */}
        {name && (
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-3.5 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${currentPresetInfo?.color || 'bg-neutral-100 text-neutral-600'}`}>
                {currentPresetInfo ? <currentPresetInfo.icon className="h-4 w-4" /> : <Thermometer className="h-4 w-4" />}
              </div>
              <div>
                <div className="text-xs font-bold text-neutral-900">
                  {name} <span className="font-mono text-neutral-500 font-normal">({code || 'TAG'})</span>
                </div>
                <div className="text-[11px] text-neutral-500">
                  Setor {area} • Faixa de conformidade: <strong className="text-emerald-700 font-semibold">{minTempTarget}°C a {maxTempTarget}°C</strong>
                </div>
              </div>
            </div>
            <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              Pronto para Lançamento
            </span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-neutral-700">Observações Gerais (Opcional)</label>
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Localização específica na bancada, detalhes do sensor, etc."
            rows={2}
            className="mt-1"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={createLocation.isPending || updateLocation.isPending}
          >
            {locationToEdit ? 'Atualizar Ponto' : 'Cadastrar Ponto de Monitoramento'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

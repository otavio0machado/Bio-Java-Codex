import {
  Check,
  Flame,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Thermometer,
  Wand2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  useCreateTemperatureLocation,
  useTemperatureLocations,
  useUpdateTemperatureLocation,
} from '../../hooks/useTemperature'
import { aiService } from '../../services/aiService'
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
  initialName?: string
  onSuccessCreated?: (createdLocation: TemperatureLocation) => void
}

interface PresetOption {
  category: LocationCategory
  title: string
  subtitle: string
  icon: any
  codePrefix: string
  color: string
  borderActive: string
}

const PRESETS: PresetOption[] = [
  {
    category: 'GELADEIRA',
    title: 'Geladeira',
    subtitle: 'Reagentes, Amostras e Vacinas',
    icon: Snowflake,
    codePrefix: 'GEL',
    color: 'text-sky-600 bg-sky-50',
    borderActive: 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/40',
  },
  {
    category: 'ESTUFA',
    title: 'Estufa Bacteriológica',
    subtitle: 'Incubação e Culturas (37°C)',
    icon: Flame,
    codePrefix: 'EST',
    color: 'text-amber-600 bg-amber-50',
    borderActive: 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/40',
  },
  {
    category: 'BANHO_MARIA',
    title: 'Banho-Maria',
    subtitle: 'Reações e Hemostasia (37°C)',
    icon: Flame,
    codePrefix: 'BM',
    color: 'text-rose-600 bg-rose-50',
    borderActive: 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/40',
  },
]

const AREA_OPTIONS = [
  { value: 'GERAL', label: 'Geral / Compartilhado' },
  { value: 'BIOQUIMICA', label: 'Bioquímica Clínica' },
  { value: 'HEMATOLOGIA', label: 'Hematologia & Hemostasia' },
  { value: 'IMUNOLOGIA', label: 'Imunologia & Hormônios' },
  { value: 'MICROBIOLOGIA', label: 'Microbiologia & Culturas' },
  { value: 'COAGULACAO', label: 'Coagulação' },
  { value: 'URINALISE', label: 'Uroanálise & Parasitologia' },
  { value: 'BIOMOL', label: 'Biologia Molecular / Genética' },
  { value: 'TRIAGEM', label: 'Triagem & Recepção de Amostras' },
  { value: 'SALA_COLETA', label: 'Sala de Coleta de Pacientes' },
  { value: 'ALMOXARIFADO', label: 'Almoxarifado & Estoque de Reagentes' },
  { value: 'SALA_TECNICA', label: 'Sala Técnica Principal' },
  { value: 'OUTRO', label: 'Outro Setor (Personalizado)' },
]

export function TemperatureLocationModal({
  isOpen,
  onClose,
  locationToEdit,
  initialName,
  onSuccessCreated,
}: TemperatureLocationModalProps) {
  const { toast } = useToast()
  const { data: existingLocations } = useTemperatureLocations()
  const createLocation = useCreateTemperatureLocation()
  const updateLocation = useUpdateTemperatureLocation()

  const [selectedPreset, setSelectedPreset] = useState<LocationCategory>('GELADEIRA')
  const [name, setName] = useState<string>('')
  const [code, setCode] = useState<string>('')
  const [area, setArea] = useState<string>('GERAL')
  const [customArea, setCustomArea] = useState<string>('')
  const [minTempTarget, setMinTempTarget] = useState<string>('')
  const [maxTempTarget, setMaxTempTarget] = useState<string>('')
  const [minHumidityTarget, setMinHumidityTarget] = useState<string>('')
  const [maxHumidityTarget, setMaxHumidityTarget] = useState<string>('')
  const [thermometerCode, setThermometerCode] = useState<string>('')
  const [calibrationCertNumber, setCalibrationCertNumber] = useState<string>('')
  const [calibrationDueDate, setCalibrationDueDate] = useState<string>('')
  const [frequency, setFrequency] = useState<string>('DIARIO_1X')
  const [active, setActive] = useState<boolean>(true)
  const [notes, setNotes] = useState<string>('')
  const [isGeneratingNotes, setIsGeneratingNotes] = useState<boolean>(false)

  // Estado para controlar se o usuário editou manualmente o código
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState<boolean>(false)

  // Função para calcular o próximo código automaticamente
  const calculateNextCode = (category: string, nameHint: string): string => {
    const preset = PRESETS.find((p) => p.category === category)
    const prefix = preset ? preset.codePrefix : 'EQP'

    // Se o usuário digitou um número no nome (ex: "Geladeira 3" -> "GEL-03")
    const numMatch = nameHint.match(/\d+/)
    if (numMatch) {
      return `${prefix}-${String(numMatch[0]).padStart(2, '0')}`
    }

    if (!existingLocations || existingLocations.length === 0) {
      return `${prefix}-01`
    }

    // Busca todos os números usados com o mesmo prefixo
    const usedNumbers: number[] = existingLocations
      .filter((loc) => loc.id !== locationToEdit?.id)
      .map((loc) => {
        const codeUpper = (loc.code || '').toUpperCase()
        if (codeUpper.startsWith(prefix)) {
          const match = codeUpper.match(/(\d+)$/)
          return match ? parseInt(match[1], 10) : 0
        }
        return 0
      })
      .filter((n) => n > 0)

    const maxNum = usedNumbers.length > 0 ? Math.max(...usedNumbers) : 0
    const nextNum = (maxNum + 1).toString().padStart(2, '0')
    return `${prefix}-${nextNum}`
  }

  useEffect(() => {
    if (locationToEdit) {
      setSelectedPreset((locationToEdit.category as LocationCategory) || 'GELADEIRA')
      setName(locationToEdit.name)
      setCode(locationToEdit.code)

      const knownArea = AREA_OPTIONS.some((o) => o.value === locationToEdit.area)
      if (knownArea) {
        setArea(locationToEdit.area)
        setCustomArea('')
      } else if (locationToEdit.area) {
        setArea('OUTRO')
        setCustomArea(locationToEdit.area)
      } else {
        setArea('GERAL')
        setCustomArea('')
      }

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
      const defaultName = initialName || ''
      setName(defaultName)
      setSelectedPreset('GELADEIRA')
      setMinTempTarget('')
      setMaxTempTarget('')
      setMinHumidityTarget('')
      setMaxHumidityTarget('')
      setArea('GERAL')
      setCustomArea('')
      setThermometerCode('')
      setCalibrationCertNumber('')
      setCalibrationDueDate('')
      setFrequency('DIARIO_1X')
      setActive(true)
      setNotes('')
      setIsCodeManuallyEdited(false)
      setCode(calculateNextCode('GELADEIRA', defaultName))
    }
  }, [locationToEdit, initialName, isOpen])

  const applyPreset = (category: LocationCategory, updateCode = true) => {
    setSelectedPreset(category)
    if (updateCode && !isCodeManuallyEdited) {
      setCode(calculateNextCode(category, name))
    }
  }

  const handleNameChange = (val: string) => {
    setName(val)
    if (!isCodeManuallyEdited && !locationToEdit) {
      setCode(calculateNextCode(selectedPreset, val))
    }
  }

  const handleRegenerateCode = () => {
    const next = calculateNextCode(selectedPreset, name)
    setCode(next)
    setIsCodeManuallyEdited(false)
    toast.info(`Código sugerido: ${next}`)
  }

  // Gerador de Observações com IA (RDC 978/2025)
  const handleGenerateAiNotes = async () => {
    try {
      setIsGeneratingNotes(true)
      const sectorLabel = area === 'OUTRO' ? customArea || 'Laboratório Clínico' : (AREA_OPTIONS.find((o) => o.value === area)?.label || area)
      const equipTitle = PRESETS.find((p) => p.category === selectedPreset)?.title || selectedPreset

      const prompt = `Gere uma observação técnica operacional sucinta (máximo 2 a 3 frases) para a ficha de qualificação e cadastro do seguinte ponto térmico em laboratório de análises clínicas:
Equipamento: ${name || equipTitle} (${code || 'TAG'})
Tipo: ${equipTitle}
Setor: ${sectorLabel}
Faixa Aceitável: ${minTempTarget}°C a ${maxTempTarget}°C
Frequência: ${frequency}
Termômetro: ${thermometerCode || 'Sensor Digital Calibrado'}
Certificado Calibração: ${calibrationCertNumber || 'Conforme plano de calibração RBC'}
Rascunho/Ideia do Operador: ${notes.trim() || 'Nenhum, gere do zero com foco em boas práticas e RDC 978/2025'}

Instruções:
- Seja formal, direto e profissional (padrão POP/ANVISA RDC 978/2025).
- Responda apenas com o texto da observação sem aspas, títulos ou introduções.`

      const responseText = await aiService.analyze({
        prompt,
        context: `Contexto: Cadastro de Equipamento Térmico no Sistema Laboratorial Biodiagnóstico conforme RDC 978/2025 e RDC 786/2023.`,
      })

      if (responseText && responseText.trim().length > 10) {
        setNotes(responseText.trim())
        toast.success('Observação gerada com sucesso pela IA!')
      } else {
        throw new Error('Resposta vazia da IA')
      }
    } catch {
      // Fallback determinístico elegante e instantâneo
      const sectorLabel = area === 'OUTRO' ? customArea || 'Laboratório Clínico' : (AREA_OPTIONS.find((o) => o.value === area)?.label || area)

      let fallback = `Ponto de monitoramento térmico destinado ao setor de ${sectorLabel}. Faixa operacional controlada de ${minTempTarget}°C a ${maxTempTarget}°C em conformidade com as Boas Práticas Laboratoriais e RDC 978/2025.`
      if (notes.trim()) {
        fallback += ` Observação do operador: ${notes.trim()}.`
      }
      if (thermometerCode) {
        fallback += ` Monitorado via ${thermometerCode} com calibração RBC vigente.`
      }

      setNotes(fallback)
      toast.success('Observação técnica padronizada gerada com sucesso!')
    } finally {
      setIsGeneratingNotes(false)
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

    const finalArea = area === 'OUTRO' ? (customArea.trim() || 'GERAL') : area

    const payload: TemperatureLocationRequest = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      category: selectedPreset,
      area: finalArea,
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
      title={locationToEdit ? 'Editar Ponto de Monitoramento' : 'Novo Ponto de Monitoramento (RDC 978/2025)'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Seleção de Tipo de Equipamento */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wider">
              1. Tipo de Equipamento
            </label>
            <span className="text-[11px] text-neutral-500">
              Selecione o tipo para gerar o prefixo do código
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {PRESETS.map((p) => {
              const Icon = p.icon
              const isSelected = selectedPreset === p.category
              return (
                <button
                  key={p.category}
                  type="button"
                  onClick={() => applyPreset(p.category, true)}
                  className={`relative flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all ${
                    isSelected
                      ? p.borderActive
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/80'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </div>
                  )}
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${p.color} mb-2`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="font-semibold text-xs text-neutral-900 leading-tight">
                    {p.title}
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">
                    {p.subtitle}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. Identificação, Código Automático e Setor */}
        <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">
              2. Identificação, Código & Setor Técnico
            </span>
            <span className="text-[11px] text-neutral-400 font-normal">
              Conformidade RDC 978/2025
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-12">
            <div className="sm:col-span-7">
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

            <div className="sm:col-span-5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-neutral-700">
                  Código / Tag *
                </label>
                <button
                  type="button"
                  onClick={handleRegenerateCode}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                  title="Gerar próximo código automático livre"
                >
                  <Wand2 className="h-3 w-3" />
                  Auto-Gerar
                </button>
              </div>
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
              {area === 'OUTRO' && (
                <Input
                  type="text"
                  value={customArea}
                  onChange={(e) => setCustomArea(e.target.value)}
                  placeholder="Digite o nome do setor técnico..."
                  className="mt-2 text-xs"
                  required
                />
              )}
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
                <option value="CONTINUO">Contínuo (Sensor / Datalogger)</option>
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
                3. Faixas Aceitáveis de Operação
              </span>
            </div>
            <span className="text-[11px] text-emerald-700 font-medium">
              Desvios fora desta faixa alertam Não-Conformidade
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-bold text-rose-700">
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
              <label className="block text-xs font-bold text-rose-700">
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
              <label className="block text-xs text-neutral-600 font-medium">
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
              <label className="block text-xs text-neutral-600 font-medium">
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

        {/* 4. Termômetro Vinculado & Calibração RBC */}
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-neutral-700" />
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              4. Termômetro Vinculado & Calibração RBC (Auditoria)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-neutral-600 font-medium">Identificação do Termômetro</label>
              <Input
                type="text"
                value={thermometerCode}
                onChange={(e) => setThermometerCode(e.target.value)}
                placeholder="Ex: TERM-01 (Incoterm)"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-600 font-medium">Certificado RBC</label>
              <Input
                type="text"
                value={calibrationCertNumber}
                onChange={(e) => setCalibrationCertNumber(e.target.value)}
                placeholder="Ex: CAL-2026/044"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-600 font-medium">Validade da Calibração</label>
              <Input
                type="date"
                value={calibrationDueDate}
                onChange={(e) => setCalibrationDueDate(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>
          </div>
        </div>

        {/* 5. Observações Gerais & Assistência com IA */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-neutral-700">
              Observações Gerais & POP (Opcional)
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleGenerateAiNotes}
              loading={isGeneratingNotes}
              className="text-xs h-7 px-2.5 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-200/80"
            >
              <Sparkles className="mr-1 h-3 w-3 text-emerald-600" />
              {notes.trim() ? 'Aprimorar com IA' : 'Gerar Observação com IA'}
            </Button>
          </div>
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Ponto de monitoramento exclusivo para armazenamento de reagentes de rotina. Termostato com alarme de temperatura..."
            rows={2}
            className="mt-1 text-xs"
          />
        </div>

        {/* 6. Pré-visualização do Ponto */}
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
                  Setor: {area === 'OUTRO' ? customArea || 'Geral' : (AREA_OPTIONS.find((o) => o.value === area)?.label || area)} • Faixa: <strong className="text-emerald-700 font-semibold">{minTempTarget}°C a {maxTempTarget}°C</strong>
                </div>
              </div>
            </div>
            <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              RDC 978/2025
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={createLocation.isPending || updateLocation.isPending}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-xs"
          >
            {locationToEdit ? 'Atualizar Ponto' : 'Cadastrar Ponto de Monitoramento'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

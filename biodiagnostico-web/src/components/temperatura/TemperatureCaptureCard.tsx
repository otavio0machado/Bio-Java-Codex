import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronDown,
  FolderOpen,
  Loader2,
  RefreshCw,
  Thermometer,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  useCreateTemperatureRecord,
  useProcessTemperaturePhoto,
  useTemperatureLocations,
} from '../../hooks/useTemperature'
import type { TemperatureRecordRequest } from '../../types/temperature'
import { Button, Card, Combobox, type ComboboxOption, Input, Select, StatusBadge, TextArea, useToast } from '../ui'
import { todayLocal } from '../../utils/date'
import { TemperatureLocationModal } from './TemperatureLocationModal'

export function TemperatureCaptureCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: locations, isLoading: loadingLocations } = useTemperatureLocations()
  const processPhoto = useProcessTemperaturePhoto()
  const createRecord = useCreateTemperatureRecord()

  // Inputs ocultos para Foto 1 (Máxima) - Câmera Direta e Galeria
  const cameraInputMaxRef = useRef<HTMLInputElement>(null)
  const fileInputMaxRef = useRef<HTMLInputElement>(null)

  // Inputs ocultos para Foto 2 (Mínima) - Câmera Direta e Galeria
  const cameraInputMinRef = useRef<HTMLInputElement>(null)
  const fileInputMinRef = useRef<HTMLInputElement>(null)

  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [isNewLocationModalOpen, setIsNewLocationModalOpen] = useState<boolean>(false)
  const [initialLocationName, setInitialLocationName] = useState<string>('')

  const [date, setDate] = useState<string>(todayLocal())
  const [time, setTime] = useState<string>(
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
  const [period, setPeriod] = useState<string>('UNICO')

  // Medições OUT (Sonda / Equipamento)
  const [tempMax, setTempMax] = useState<string>('')
  const [tempMin, setTempMin] = useState<string>('')

  // Medições IN (Sensor Interno / Ambiente da Sala)
  const [tempMaxIn, setTempMaxIn] = useState<string>('')
  const [tempMinIn, setTempMinIn] = useState<string>('')

  // Temperatura Ambiente (Calculada como média (Max IN + Min IN)/2 ou editável)
  const [tempCurrent, setTempCurrent] = useState<string>('')

  const [humidity, setHumidity] = useState<string>('')
  const [responsible, setResponsible] = useState<string>(user?.name || '')
  const [actionTaken, setActionTaken] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  // Efeito para recalcular Temp. Ambiente automaticamente quando Max IN e Min IN forem informados
  const handleMaxInChange = (val: string) => {
    setTempMaxIn(val)
    const nMaxIn = parseFloat(val.replace(',', '.'))
    const nMinIn = parseFloat(tempMinIn.replace(',', '.'))
    if (!isNaN(nMaxIn) && !isNaN(nMinIn)) {
      setTempCurrent(((nMaxIn + nMinIn) / 2).toFixed(1))
    }
  }

  const handleMinInChange = (val: string) => {
    setTempMinIn(val)
    const nMaxIn = parseFloat(tempMaxIn.replace(',', '.'))
    const nMinIn = parseFloat(val.replace(',', '.'))
    if (!isNaN(nMaxIn) && !isNaN(nMinIn)) {
      setTempCurrent(((nMaxIn + nMinIn) / 2).toFixed(1))
    }
  }

  // Estados de Imagem: Foto Máxima (Slot 1)
  const [maxImage, setMaxImage] = useState<string | null>(null)
  const [maxMimeType, setMaxMimeType] = useState<string>('image/jpeg')
  const [maxFilename, setMaxFilename] = useState<string>('')

  // Estados de Imagem: Foto Mínima (Slot 2)
  const [minImage, setMinImage] = useState<string | null>(null)
  const [minMimeType, setMinMimeType] = useState<string>('image/jpeg')
  const [minFilename, setMinFilename] = useState<string>('')

  // Estados de OCR
  const [ocrApplied, setOcrApplied] = useState<boolean>(false)
  const [ocrMessage, setOcrMessage] = useState<string | null>(null)

  // Seleciona primeiro ponto ativo por padrão se vazio
  useEffect(() => {
    if (!selectedLocationId && locations && locations.length > 0) {
      setSelectedLocationId(locations[0].id)
    }
  }, [locations, selectedLocationId])

  useEffect(() => {
    if (user?.name && !responsible) {
      setResponsible(user.name)
    }
  }, [user, responsible])

  // Opções para o Combobox
  const locationOptions = useMemo<ComboboxOption[]>(() => {
    if (!locations) return []
    return locations.map((loc) => ({
      value: loc.id,
      label: `${loc.name} (${loc.code})`,
      description: `Faixa Aceitável: ${loc.minTempTarget}°C a ${loc.maxTempTarget}°C · Setor ${loc.area || 'Geral'}`,
    }))
  }, [locations])

  const selectedLocation = locations?.find((l) => l.id === selectedLocationId)

  // Handler de seleção no Combobox (suporta escolher existente ou criar novo elemento na caixa)
  const handleLocationComboboxChange = (val: string) => {
    const found = locations?.find(
      (l) => l.id === val || l.name.toLowerCase() === val.toLowerCase() || l.code.toLowerCase() === val.toLowerCase()
    )
    if (found) {
      setSelectedLocationId(found.id)
    } else if (val.trim()) {
      // Criar novo elemento a partir do texto digitado no Combobox
      setInitialLocationName(val.trim())
      setIsNewLocationModalOpen(true)
    }
  }

  // Avaliação de conformidade em tempo real (baseado no sensor do equipamento OUT)
  const numMin = parseFloat(tempMin.replace(',', '.'))
  const numMax = parseFloat(tempMax.replace(',', '.'))
  const numMinIn = tempMinIn ? parseFloat(tempMinIn.replace(',', '.')) : null
  const numMaxIn = tempMaxIn ? parseFloat(tempMaxIn.replace(',', '.')) : null
  const numCurrent = tempCurrent ? parseFloat(tempCurrent.replace(',', '.')) : null
  const numHum = humidity ? parseFloat(humidity.replace(',', '.')) : null

  let derivedStatus: 'CONFORME' | 'NAO_CONFORME' | 'INDEFINIDO' = 'INDEFINIDO'
  if (selectedLocation && !isNaN(numMin) && !isNaN(numMax)) {
    const tempOk =
      numMin >= selectedLocation.minTempTarget && numMax <= selectedLocation.maxTempTarget
    let humOk = true
    if (numHum !== null && !isNaN(numHum)) {
      if (
        selectedLocation.minHumidityTarget !== null &&
        selectedLocation.minHumidityTarget !== undefined &&
        numHum < selectedLocation.minHumidityTarget
      ) {
        humOk = false
      }
      if (
        selectedLocation.maxHumidityTarget !== null &&
        selectedLocation.maxHumidityTarget !== undefined &&
        numHum > selectedLocation.maxHumidityTarget
      ) {
        humOk = false
      }
    }
    derivedStatus = tempOk && humOk ? 'CONFORME' : 'NAO_CONFORME'
  }

  // Handler de foto Máxima (Slot 1)
  const handleMaxFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setMaxFilename(file.name)
    setMaxMimeType(file.type || 'image/jpeg')
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setMaxImage(base64)
      triggerAiOcr(base64, file.type || 'image/jpeg', minImage, minMimeType)
    }
    reader.readAsDataURL(file)
    // Limpa valor para permitir selecionar o mesmo arquivo novamente
    e.target.value = ''
  }

  // Handler de foto Mínima (Slot 2)
  const handleMinFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setMinFilename(file.name)
    setMinMimeType(file.type || 'image/jpeg')
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setMinImage(base64)
      triggerAiOcr(maxImage, maxMimeType, base64, file.type || 'image/jpeg')
    }
    reader.readAsDataURL(file)
    // Limpa valor para permitir selecionar o mesmo arquivo novamente
    e.target.value = ''
  }

  const triggerAiOcr = (
    imgMax: string | null,
    mimeMax: string,
    imgMin: string | null,
    mimeMin: string
  ) => {
    const primaryImg = imgMax || imgMin
    if (!primaryImg) return

    processPhoto.mutate(
      {
        imageBase64: imgMax || undefined,
        mimeType: mimeMax || 'image/jpeg',
        imageMinBase64: imgMin || undefined,
        mimeTypeMin: mimeMin || 'image/jpeg',
        locationId: selectedLocationId || undefined,
      },
      {
        onSuccess: (data) => {
          setOcrApplied(true)
          if (data.time) {
            const cleanTime = data.time.trim().substring(0, 5)
            setTime(cleanTime)
          }
          if (data.tempMax !== null && data.tempMax !== undefined) setTempMax(String(data.tempMax))
          if (data.tempMin !== null && data.tempMin !== undefined) setTempMin(String(data.tempMin))
          if (data.tempMaxIn !== null && data.tempMaxIn !== undefined) setTempMaxIn(String(data.tempMaxIn))
          if (data.tempMinIn !== null && data.tempMinIn !== undefined) setTempMinIn(String(data.tempMinIn))

          // Calcula Temperatura Ambiente = (Max IN + Min IN) / 2
          if (data.tempMaxIn !== null && data.tempMaxIn !== undefined && data.tempMinIn !== null && data.tempMinIn !== undefined) {
            setTempCurrent(((data.tempMaxIn + data.tempMinIn) / 2).toFixed(1))
          } else if (data.tempCurrent !== null && data.tempCurrent !== undefined) {
            setTempCurrent(String(data.tempCurrent))
          }

          if (data.humidity !== null && data.humidity !== undefined) setHumidity(String(data.humidity))
          setOcrMessage(data.statusMessage || 'Valores lidos automaticamente do display')

          toast.success('Leitura concluída! Campos preenchidos automaticamente.')
        },
        onError: () => {
          setOcrMessage('Leitura automática não concluída. Digite os valores nos campos.')
          toast.info('Não foi possível ler todos os dígitos. Digite os valores manualmente.')
        },
      }
    )
  }

  const handleReset = () => {
    setMaxImage(null)
    setMaxFilename('')
    setMinImage(null)
    setMinFilename('')
    setTempMax('')
    setTempMin('')
    setTempMaxIn('')
    setTempMinIn('')
    setTempCurrent('')
    setHumidity('')
    setActionTaken('')
    setNotes('')
    setOcrApplied(false)
    setOcrMessage(null)
    setTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedLocationId) {
      toast.error('Selecione um ponto de monitoramento.')
      return
    }
    if (isNaN(numMin) || isNaN(numMax)) {
      toast.error('Informe as temperaturas máxima e mínima registradas (OUT).')
      return
    }
    if (derivedStatus === 'NAO_CONFORME' && !actionTaken.trim()) {
      toast.error('A temperatura está fora da faixa. Descreva a ação corretiva imediata tomada.')
      return
    }

    const payload: TemperatureRecordRequest = {
      locationId: selectedLocationId,
      date,
      time,
      period,
      tempMax: numMax,
      tempMin: numMin,
      tempCurrent: numCurrent !== null && !isNaN(numCurrent) ? numCurrent : null,
      tempMaxIn: numMaxIn !== null && !isNaN(numMaxIn) ? numMaxIn : null,
      tempMinIn: numMinIn !== null && !isNaN(numMinIn) ? numMinIn : null,
      humidity: numHum,
      responsible: responsible.trim() || 'Operador',
      actionTaken: actionTaken.trim() || null,
      notes: notes.trim() || null,
      photoUrl: maxImage || null,
      photoFilename: maxFilename || null,
      photoMinUrl: minImage || null,
      photoMinFilename: minFilename || null,
      ocrApplied,
    }

    createRecord.mutate(payload, {
      onSuccess: () => {
        toast.success(`Medição de ${selectedLocation?.name} registrada com sucesso!`)
        handleReset()
      },
      onError: () => {
        toast.error('Não foi possível gravar o registro de temperatura.')
      },
    })
  }

  return (
    <Card className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-neutral-100 pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-xs">
              <Thermometer className="h-4 w-4" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900">
              Registro de Temperatura & Termohigrometria
            </h2>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Tire foto do visor com a câmera do dispositivo ou anexe uma imagem para leitura automática.
          </p>
        </div>

        {ocrApplied && (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Leitura do display aplicada</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Lado Esquerdo: Evidências Fotográficas do Visor */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 sm:p-5">
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Fotos do Visor do Termômetro
                </label>
                {(maxImage || minImage) && (
                  <button
                    type="button"
                    onClick={() => triggerAiOcr(maxImage, maxMimeType, minImage, minMimeType)}
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Re-analisar
                  </button>
                )}
              </div>

              <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {/* SLOT 1: FOTO MÁXIMA */}
                <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-3 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200/50">
                      Visor em MÁX
                    </span>
                    {maxImage && (
                      <button
                        type="button"
                        onClick={() => {
                          setMaxImage(null)
                          setMaxFilename('')
                        }}
                        className="text-neutral-400 hover:text-rose-600 p-0.5 rounded-md hover:bg-neutral-100"
                        title="Remover foto"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {maxImage ? (
                    <div className="relative mt-2.5 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-900">
                      <img
                        src={maxImage}
                        alt="Visor Máxima"
                        className="h-36 w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => cameraInputMaxRef.current?.click()}
                        className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-neutral-900/80 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur-xs hover:bg-neutral-900 cursor-pointer shadow-xs"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Tirar outra
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2.5 flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-2.5 text-center">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => cameraInputMaxRef.current?.click()}
                          className="flex flex-col items-center justify-center rounded-xl bg-emerald-700 px-3.5 py-2.5 text-white shadow-xs hover:bg-emerald-800 transition-all cursor-pointer"
                        >
                          <Camera className="h-4 w-4" />
                          <span className="mt-1 text-[11px] font-bold">Tirar Foto</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputMaxRef.current?.click()}
                          className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-700 shadow-xs hover:bg-neutral-50 transition-all cursor-pointer"
                        >
                          <FolderOpen className="h-4 w-4 text-neutral-500" />
                          <span className="mt-1 text-[11px] font-semibold">Galeria</span>
                        </button>
                      </div>
                      <span className="text-[10px] text-neutral-400 mt-2">
                        Linha OUT central (MÁX)
                      </span>
                    </div>
                  )}

                  {/* Input Direto da Câmera (Abre o App Nativo da Câmera no Smartphone) */}
                  <input
                    ref={cameraInputMaxRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleMaxFileChange}
                  />
                  {/* Input Seletor de Arquivos/Galeria */}
                  <input
                    ref={fileInputMaxRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleMaxFileChange}
                  />
                </div>

                {/* SLOT 2: FOTO MÍNIMA */}
                <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-3 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                    <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 border border-sky-200/50">
                      Visor em MÍN
                    </span>
                    {minImage && (
                      <button
                        type="button"
                        onClick={() => {
                          setMinImage(null)
                          setMinFilename('')
                        }}
                        className="text-neutral-400 hover:text-rose-600 p-0.5 rounded-md hover:bg-neutral-100"
                        title="Remover foto"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {minImage ? (
                    <div className="relative mt-2.5 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-900">
                      <img
                        src={minImage}
                        alt="Visor Mínima"
                        className="h-36 w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => cameraInputMinRef.current?.click()}
                        className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-neutral-900/80 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur-xs hover:bg-neutral-900 cursor-pointer shadow-xs"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Tirar outra
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2.5 flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-2.5 text-center">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => cameraInputMinRef.current?.click()}
                          className="flex flex-col items-center justify-center rounded-xl bg-sky-700 px-3.5 py-2.5 text-white shadow-xs hover:bg-sky-800 transition-all cursor-pointer"
                        >
                          <Camera className="h-4 w-4" />
                          <span className="mt-1 text-[11px] font-bold">Tirar Foto</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputMinRef.current?.click()}
                          className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-700 shadow-xs hover:bg-neutral-50 transition-all cursor-pointer"
                        >
                          <FolderOpen className="h-4 w-4 text-neutral-500" />
                          <span className="mt-1 text-[11px] font-semibold">Galeria</span>
                        </button>
                      </div>
                      <span className="text-[10px] text-neutral-400 mt-2">
                        Linha OUT central (MÍN)
                      </span>
                    </div>
                  )}

                  {/* Input Direto da Câmera (Abre o App Nativo da Câmera no Smartphone) */}
                  <input
                    ref={cameraInputMinRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleMinFileChange}
                  />
                  {/* Input Seletor de Arquivos/Galeria */}
                  <input
                    ref={fileInputMinRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleMinFileChange}
                  />
                </div>
              </div>
            </div>

            {processPhoto.isPending && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-100/70 p-3 text-xs font-semibold text-emerald-900">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                <span>Lendo dígitos do display...</span>
              </div>
            )}

            {ocrMessage && !processPhoto.isPending && (
              <p className="text-xs text-neutral-600 bg-white border border-neutral-200 rounded-xl p-2.5 font-medium">
                {ocrMessage}
              </p>
            )}
          </div>

          {/* Lado Direito: Formulário de Lançamento */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Combobox de Ponto / Equipamento */}
              <div className="sm:col-span-2">
                <Combobox
                  label="Ponto de Monitoramento / Equipamento *"
                  placeholder="Selecione ou digite para buscar/criar..."
                  value={selectedLocationId}
                  onChange={handleLocationComboboxChange}
                  options={locationOptions}
                  allowCustom={true}
                  createLabel="Cadastrar novo ponto"
                  disabled={loadingLocations}
                  icon={<Thermometer className="h-4 w-4 text-emerald-700" />}
                />
              </div>

              <div>
                <label className="block text-base font-medium text-neutral-700">
                  Data da Medição *
                </label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <label className="block text-base font-medium text-neutral-700">
                  Hora da Medição *
                </label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-base font-medium text-neutral-700">
                  Período da Medição
                </label>
                <Select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="mt-1"
                >
                  <option value="UNICO">Único / Diário</option>
                  <option value="MANHA">Manhã</option>
                  <option value="TARDE">Tarde</option>
                  <option value="NOITE">Noite</option>
                </Select>
              </div>

              {/* Bloco de Temperaturas Principais */}
              <div>
                <label className="block text-sm font-bold text-rose-700">
                  Temp. Máxima (Max OUT °C) *
                </label>
                <Input
                  type="text"
                  value={tempMax}
                  onChange={(e) => setTempMax(e.target.value)}
                  placeholder="Ex: 6.1"
                  className="mt-1 font-semibold text-neutral-900 border-rose-200 focus-within:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-sky-700">
                  Temp. Mínima (Min OUT °C) *
                </label>
                <Input
                  type="text"
                  value={tempMin}
                  onChange={(e) => setTempMin(e.target.value)}
                  placeholder="Ex: 0.2"
                  className="mt-1 font-semibold text-neutral-900 border-sky-200 focus-within:border-sky-500"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-bold text-amber-900">
                    Temperatura Ambiente (°C) *
                  </label>
                  {(tempMaxIn || tempMinIn) && (
                    <span className="text-xs text-amber-700 font-medium">
                      Média ({tempMaxIn || '-'} + {tempMinIn || '-'})/2
                    </span>
                  )}
                </div>
                <Input
                  type="text"
                  value={tempCurrent}
                  onChange={(e) => setTempCurrent(e.target.value)}
                  placeholder="Ex: 19.8"
                  className="mt-1 font-semibold text-neutral-900 border-amber-200 focus-within:border-amber-500 bg-amber-50/20"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Umidade Relativa (% UR)
                </label>
                <Input
                  type="text"
                  value={humidity}
                  onChange={(e) => setHumidity(e.target.value)}
                  placeholder="Ex: 60 ou 98"
                  className="mt-1"
                />
              </div>

              {/* Detalhes Retráteis: Sensores Internos da Sala (IN) */}
              <div className="sm:col-span-2">
                <details className="group rounded-2xl border border-neutral-200 bg-neutral-50/40 p-3">
                  <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-neutral-600 hover:text-neutral-900">
                    <span>Valores dos Sensores Internos (Max IN / Min IN)</span>
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 text-neutral-400" />
                  </summary>
                  <div className="mt-3 grid grid-cols-1 gap-3 pt-3 border-t border-neutral-200/60 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-600">
                        Sensor Interno Máx (Max IN °C)
                      </label>
                      <Input
                        type="text"
                        value={tempMaxIn}
                        onChange={(e) => handleMaxInChange(e.target.value)}
                        placeholder="Ex: 20.2"
                        className="mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-600">
                        Sensor Interno Mín (Min IN °C)
                      </label>
                      <Input
                        type="text"
                        value={tempMinIn}
                        onChange={(e) => handleMinInChange(e.target.value)}
                        placeholder="Ex: 19.6"
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>
                </details>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-base font-medium text-neutral-700">
                  Responsável Técnico / Farmacêutico *
                </label>
                <Input
                  type="text"
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  placeholder="Nome do operador"
                  className="mt-1"
                  required
                />
              </div>
            </div>

            {/* Banner de Conformidade com StatusBadge padrão */}
            {derivedStatus !== 'INDEFINIDO' && (
              <div
                className={`flex items-start gap-3 rounded-2xl p-4 text-sm ${
                  derivedStatus === 'CONFORME'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border border-rose-200 bg-rose-50 text-rose-900'
                }`}
              >
                {derivedStatus === 'CONFORME' ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={derivedStatus} />
                    <span className="font-semibold">
                      {derivedStatus === 'CONFORME'
                        ? 'Temperatura Conforme com os limites operacionais'
                        : 'DESVIO TÉRMICO — Fora da Faixa!'}
                    </span>
                  </div>
                  <p className="text-xs">
                    Faixa Aceitável de {selectedLocation?.name}:{' '}
                    <strong>
                      {selectedLocation?.minTempTarget}°C a {selectedLocation?.maxTempTarget}°C
                    </strong>
                    .
                  </p>
                </div>
              </div>
            )}

            {/* Campo Obrigatório se Não Conforme */}
            {derivedStatus === 'NAO_CONFORME' && (
              <div className="rounded-2xl border border-rose-300 bg-rose-50/50 p-4 space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-rose-800">
                  Ação Corretiva / Justificativa (Obrigatório para Não-Conformidade) *
                </label>
                <TextArea
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  placeholder="Descreva a ação imediata: ex.: Verificado porta entreaberta, termostato regulado, reagentes transferidos para geladeira 2..."
                  rows={2}
                  className="bg-white border-rose-300"
                  required
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer do formulário com botão primário padrão */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-100 pt-5">
          <Button type="button" variant="secondary" onClick={handleReset}>
            Limpar
          </Button>
          <Button
            type="submit"
            loading={createRecord.isPending}
            disabled={!selectedLocationId || isNaN(numMin) || isNaN(numMax)}
            className="px-6"
          >
            Salvar Registro de Temperatura
          </Button>
        </div>
      </form>

      {/* Modal Rápido de Novo Ponto / Equipamento */}
      <TemperatureLocationModal
        isOpen={isNewLocationModalOpen}
        initialName={initialLocationName}
        onClose={() => {
          setIsNewLocationModalOpen(false)
          setInitialLocationName('')
        }}
        onSuccessCreated={(created) => {
          setSelectedLocationId(created.id)
        }}
      />
    </Card>
  )
}

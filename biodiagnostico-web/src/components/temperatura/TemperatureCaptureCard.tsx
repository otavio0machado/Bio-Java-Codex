import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  useCreateTemperatureRecord,
  useProcessTemperaturePhoto,
  useTemperatureLocations,
} from '../../hooks/useTemperature'
import type { TemperatureRecordRequest } from '../../types/temperature'
import { Button, Card, Input, Select, TextArea, useToast } from '../ui'
import { todayLocal } from '../../utils/date'

export function TemperatureCaptureCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: locations, isLoading: loadingLocations } = useTemperatureLocations()
  const processPhoto = useProcessTemperaturePhoto()
  const createRecord = useCreateTemperatureRecord()

  // Inputs ocultos para Foto 1 (Máxima)
  const fileInputMaxRef = useRef<HTMLInputElement>(null)
  const cameraInputMaxRef = useRef<HTMLInputElement>(null)

  // Inputs ocultos para Foto 2 (Mínima)
  const fileInputMinRef = useRef<HTMLInputElement>(null)
  const cameraInputMinRef = useRef<HTMLInputElement>(null)

  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [date, setDate] = useState<string>(todayLocal())
  const [time, setTime] = useState<string>(
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
  const [period, setPeriod] = useState<string>('UNICO')
  const [tempMax, setTempMax] = useState<string>('')
  const [tempMin, setTempMin] = useState<string>('')
  const [tempCurrent, setTempCurrent] = useState<string>('')
  const [humidity, setHumidity] = useState<string>('')
  const [responsible, setResponsible] = useState<string>(user?.name || '')
  const [actionTaken, setActionTaken] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  // Estados de Imagem: Foto Máxima (Slot 1)
  const [maxImage, setMaxImage] = useState<string | null>(null)
  const [maxMimeType, setMaxMimeType] = useState<string>('image/jpeg')
  const [maxFilename, setMaxFilename] = useState<string>('')

  // Estados de Imagem: Foto Mínima (Slot 2)
  const [minImage, setMinImage] = useState<string | null>(null)
  const [minMimeType, setMinMimeType] = useState<string>('image/jpeg')
  const [minFilename, setMinFilename] = useState<string>('')

  // Estados de OCR/IA
  const [ocrApplied, setOcrApplied] = useState<boolean>(false)
  const [ocrMessage, setOcrMessage] = useState<string | null>(null)
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null)

  // Seleciona primeiro ponto ativo por padrão
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

  const selectedLocation = locations?.find((l) => l.id === selectedLocationId)

  // Avaliação de conformidade em tempo real
  const numMin = parseFloat(tempMin.replace(',', '.'))
  const numMax = parseFloat(tempMax.replace(',', '.'))
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
          if (data.time) setTime(data.time)
          if (data.tempMax !== null && data.tempMax !== undefined) setTempMax(String(data.tempMax))
          if (data.tempMin !== null && data.tempMin !== undefined) setTempMin(String(data.tempMin))
          if (data.tempCurrent !== null && data.tempCurrent !== undefined) setTempCurrent(String(data.tempCurrent))
          if (data.humidity !== null && data.humidity !== undefined) setHumidity(String(data.humidity))
          setOcrMessage(data.statusMessage || 'Dados extraídos do display LCD por IA')
          setOcrConfidence(data.confidence ?? 0.95)

          toast.success('Leitura concluída! Valores de temperatura extraídos com Inteligência Artificial.')
        },
        onError: () => {
          setOcrMessage('Leitura automática indisponível. Preencha os valores manualmente nos campos.')
          toast.info('Não foi possível ler os dígitos com clareza. Digite os valores nos campos.')
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
    setTempCurrent('')
    setHumidity('')
    setActionTaken('')
    setNotes('')
    setOcrApplied(false)
    setOcrMessage(null)
    setOcrConfidence(null)
    setTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedLocationId) {
      toast.error('Selecione um ponto de monitoramento.')
      return
    }
    if (isNaN(numMin) || isNaN(numMax)) {
      toast.error('Informe as temperaturas máxima e mínima registradas.')
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
      tempCurrent: isNaN(parseFloat(tempCurrent)) ? null : parseFloat(tempCurrent),
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
        toast.success(`Medição de ${selectedLocation?.name} registrada e auditada com sucesso!`)
        handleReset()
      },
      onError: () => {
        toast.error('Não foi possível gravar o registro de temperatura.')
      },
    })
  }

  return (
    <Card className="border-neutral-200/80 bg-white p-6 shadow-sm sm:rounded-3xl">
      <div className="flex flex-col justify-between gap-4 border-b border-neutral-100 pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Lançamento Rápido & Leitura de Fotos por IA
            </h2>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Fotografe o display em modo <strong>MÁXIMA (MAX)</strong> e em modo <strong>MÍNIMA (MIN)</strong> para extração automática por IA.
          </p>
        </div>

        {ocrApplied && (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 border border-emerald-200/60">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Dados extraídos via OCR/IA ({Math.round((ocrConfidence || 0.95) * 100)}% precisão)</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="mt-6 space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Lado Esquerdo: Slots de Fotos Duplas (Máxima + Mínima) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/70 p-4 sm:p-5">
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700">
                  Evidências Fotográficas do Visor
                </label>
                {(maxImage || minImage) && (
                  <button
                    type="button"
                    onClick={() => triggerAiOcr(maxImage, maxMimeType, minImage, minMimeType)}
                    className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Re-analisar IA
                  </button>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* SLOT 1: FOTO MÁXIMA */}
                <div className="flex flex-col rounded-xl border border-neutral-200 bg-white p-3 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                      MAX • Foto Máxima
                    </span>
                    {maxImage && (
                      <button
                        type="button"
                        onClick={() => {
                          setMaxImage(null)
                          setMaxFilename('')
                        }}
                        className="text-neutral-400 hover:text-neutral-600"
                        title="Remover foto"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {maxImage ? (
                    <div className="relative mt-2 overflow-hidden rounded-lg border border-neutral-200 bg-black/5">
                      <img
                        src={maxImage}
                        alt="Visor Máxima"
                        className="h-32 w-full object-contain"
                      />
                      <div className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-[10px] text-white">
                        {maxFilename || 'Foto Máxima'}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/50 p-2 text-center">
                      <ImageIcon className="h-6 w-6 text-amber-500/80" />
                      <span className="mt-1 text-[11px] font-medium text-neutral-600">
                        Visor em modo MAX
                      </span>
                    </div>
                  )}

                  <div className="mt-2.5 flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="flex-1 text-[11px] py-1 h-8"
                      onClick={() => cameraInputMaxRef.current?.click()}
                    >
                      <Camera className="mr-1 h-3 w-3" />
                      Câmera
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="flex-1 text-[11px] py-1 h-8"
                      onClick={() => fileInputMaxRef.current?.click()}
                    >
                      <Upload className="mr-1 h-3 w-3" />
                      Arquivo
                    </Button>
                  </div>
                </div>

                {/* SLOT 2: FOTO MÍNIMA */}
                <div className="flex flex-col rounded-xl border border-neutral-200 bg-white p-3 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                    <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                      MIN • Foto Mínima
                    </span>
                    {minImage && (
                      <button
                        type="button"
                        onClick={() => {
                          setMinImage(null)
                          setMinFilename('')
                        }}
                        className="text-neutral-400 hover:text-neutral-600"
                        title="Remover foto"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {minImage ? (
                    <div className="relative mt-2 overflow-hidden rounded-lg border border-neutral-200 bg-black/5">
                      <img
                        src={minImage}
                        alt="Visor Mínima"
                        className="h-32 w-full object-contain"
                      />
                      <div className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-[10px] text-white">
                        {minFilename || 'Foto Mínima'}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/50 p-2 text-center">
                      <ImageIcon className="h-6 w-6 text-sky-500/80" />
                      <span className="mt-1 text-[11px] font-medium text-neutral-600">
                        Visor em modo MIN
                      </span>
                    </div>
                  )}

                  <div className="mt-2.5 flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="flex-1 text-[11px] py-1 h-8"
                      onClick={() => cameraInputMinRef.current?.click()}
                    >
                      <Camera className="mr-1 h-3 w-3" />
                      Câmera
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="flex-1 text-[11px] py-1 h-8"
                      onClick={() => fileInputMinRef.current?.click()}
                    >
                      <Upload className="mr-1 h-3 w-3" />
                      Arquivo
                    </Button>
                  </div>
                </div>
              </div>

              {/* Inputs Ocultos de Arquivo e Câmera */}
              <input
                ref={fileInputMaxRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleMaxFileChange}
              />
              <input
                ref={cameraInputMaxRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleMaxFileChange}
              />
              <input
                ref={fileInputMinRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleMinFileChange}
              />
              <input
                ref={cameraInputMinRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleMinFileChange}
              />
            </div>

            {processPhoto.isPending && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-100/70 p-3 text-xs font-medium text-emerald-900">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                <span>Analisando visor(es) com Inteligência Artificial...</span>
              </div>
            )}

            {ocrMessage && !processPhoto.isPending && (
              <p className="text-xs text-neutral-600 bg-white/80 border border-neutral-200 rounded-xl p-2.5">
                {ocrMessage}
              </p>
            )}
          </div>

          {/* Lado Direito: Formulário com Valores e Validação */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-700">
                  Ponto de Monitoramento / Equipamento *
                </label>
                <Select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="mt-1"
                  disabled={loadingLocations}
                >
                  {locations?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code}) — [{l.minTempTarget}°C a {l.maxTempTarget}°C]
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700">
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
                <label className="block text-xs font-semibold text-neutral-700">
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
                <label className="block text-xs font-semibold text-neutral-700">
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

              <div>
                <label className="block text-xs font-semibold text-neutral-700">
                  Temp. Máxima (Max OUT/IN °C) *
                </label>
                <Input
                  type="text"
                  value={tempMax}
                  onChange={(e) => setTempMax(e.target.value)}
                  placeholder="Ex: 6.1"
                  className="mt-1 font-semibold text-neutral-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700">
                  Temp. Mínima (Min OUT/IN °C) *
                </label>
                <Input
                  type="text"
                  value={tempMin}
                  onChange={(e) => setTempMin(e.target.value)}
                  placeholder="Ex: 0.2"
                  className="mt-1 font-semibold text-neutral-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700">
                  Temp. Atual / Momento (°C)
                </label>
                <Input
                  type="text"
                  value={tempCurrent}
                  onChange={(e) => setTempCurrent(e.target.value)}
                  placeholder="Opcional"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700">
                  Umidade Relativa (% UR)
                </label>
                <Input
                  type="text"
                  value={humidity}
                  onChange={(e) => setHumidity(e.target.value)}
                  placeholder="Para salas/ambientes"
                  className="mt-1"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-700">
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

            {/* Banner de Conformidade */}
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
                <div>
                  <p className="font-semibold">
                    {derivedStatus === 'CONFORME'
                      ? 'Temperatura Conforme com os limites operacionais'
                      : 'DESVIO TÉRMICO — Temperatura Fora da Faixa!'}
                  </p>
                  <p className="mt-0.5 text-xs">
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

        {/* Footer do formulário */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-100 pt-5">
          <Button type="button" variant="secondary" onClick={handleReset}>
            Limpar
          </Button>
          <Button
            type="submit"
            loading={createRecord.isPending}
            disabled={!selectedLocationId || isNaN(numMin) || isNaN(numMax)}
          >
            Salvar Registro de Temperatura
          </Button>
        </div>
      </form>
    </Card>
  )
}

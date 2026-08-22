import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
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

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

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

  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [photoFilename, setPhotoFilename] = useState<string>('')
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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoFilename(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setPreviewImage(base64)
      processWithAi(base64, file.type)
    }
    reader.readAsDataURL(file)
  }

  const processWithAi = (base64: string, mimeType: string) => {
    processPhoto.mutate(
      {
        imageBase64: base64,
        mimeType: mimeType || 'image/jpeg',
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
          setOcrMessage(data.statusMessage || 'Dados extraídos automaticamente do display LCD')
          setOcrConfidence(data.confidence ?? 0.95)

          toast.success('Foto do display processada! Valores extraídos com Inteligência Artificial.')
        },
        onError: () => {
          setOcrMessage('Leitura automática indisponível. Preencha os valores manualmente.')
          toast.info('Não foi possível ler o display com clareza. Digite os valores nos campos.')
        },
      }
    )
  }

  const handleReset = () => {
    setPreviewImage(null)
    setPhotoFilename('')
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
      photoUrl: previewImage || null,
      photoFilename: photoFilename || null,
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
              Lançamento Rápido & Leitura de Foto (IA)
            </h2>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Tire uma foto do visor LCD do termômetro ou preencha os dados da medição.
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
          {/* Lado Esquerdo: Área de Captura de Foto */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/70 p-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600">
                Evidência Fotográfica (Visor do Termômetro)
              </label>

              {previewImage ? (
                <div className="relative mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-black/5">
                  <img
                    src={previewImage}
                    alt="Visor do Termômetro"
                    className="h-56 w-full object-contain"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-3 py-2 text-xs text-white backdrop-blur-sm">
                    <span className="truncate max-w-[200px]">{photoFilename}</span>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="flex items-center gap-1 text-neutral-200 hover:text-white"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Trocar foto
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-neutral-800">
                    Arraste a foto do termômetro aqui
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    JPG, PNG ou foto direta da câmera do celular
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Enviar Arquivo
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera className="mr-1.5 h-3.5 w-3.5" />
                      Tirar Foto
                    </Button>
                  </div>
                </div>
              )}

              {/* Hidden Inputs para Upload e Câmera */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {processPhoto.isPending && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-100/70 p-3 text-xs font-medium text-emerald-900">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                <span>Analisando visor com Inteligência Artificial...</span>
              </div>
            )}

            {ocrMessage && !processPhoto.isPending && (
              <p className="text-xs text-neutral-500 italic">
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
                  Temp. Máxima (Max OUT °C) *
                </label>
                <Input
                  type="text"
                  value={tempMax}
                  onChange={(e) => setTempMax(e.target.value)}
                  placeholder="Ex: 5.5"
                  className="mt-1 font-semibold text-neutral-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700">
                  Temp. Mínima (Min OUT °C) *
                </label>
                <Input
                  type="text"
                  value={tempMin}
                  onChange={(e) => setTempMin(e.target.value)}
                  placeholder="Ex: 2.8"
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

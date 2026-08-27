import {
  AlertCircle,
  Camera,
  Check,
  FlipHorizontal,
  FolderOpen,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Modal, useToast } from '../ui'

interface CameraCaptureModalProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (base64: string, mimeType: string, filename: string) => void
  title?: string
  slotType?: 'MAX' | 'MIN'
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  title = 'Capturar Foto do Visor',
  slotType = 'MAX',
}: CameraCaptureModalProps) {
  const { toast } = useToast()

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileFallbackInputRef = useRef<HTMLInputElement>(null)

  const [stream, setStream] = useState<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [isLoadingCamera, setIsLoadingCamera] = useState<boolean>(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Encerra os tracks de vídeo ativos
  const stopTracks = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
  }, [stream])

  // Inicializa a câmera via WebRTC
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    setIsLoadingCamera(true)
    setCameraError(null)
    setCapturedPhoto(null)

    // Encerra stream anterior se houver
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Navegador não suporta captura direta por câmera.')
      }

      // Detecta se existem múltiplos dispositivos de vídeo
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoInputs = devices.filter((d) => d.kind === 'videoinput')
        setHasMultipleCameras(videoInputs.length > 1)
      } catch {
        // Ignora falha de enumeração
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play().catch(() => {})
      }
    } catch (err: any) {
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Permissão de acesso à câmera negada. Habilite o acesso nas configurações do navegador.'
          : err?.name === 'NotFoundError'
          ? 'Nenhuma câmera encontrada neste dispositivo.'
          : err?.message || 'Não foi possível inicializar a câmera.'
      setCameraError(msg)
    } finally {
      setIsLoadingCamera(false)
    }
  }, [stream])

  // Inicia ou encerra câmera conforme abertura do modal
  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode)
    } else {
      stopTracks()
      setCapturedPhoto(null)
      setCameraError(null)
    }
    return () => {
      stopTracks()
    }
  }, [isOpen])

  // Alternar entre câmera traseira e frontal
  const handleToggleCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextMode)
    startCamera(nextMode)
  }

  // Tira o instantâneo do vídeo
  const handleTakeSnapshot = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Se estiver na câmera frontal, espelha para sensação natural
    if (facingMode === 'user') {
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
    }

    ctx.drawImage(video, 0, 0, width, height)
    const base64 = canvas.toDataURL('image/jpeg', 0.92)
    setCapturedPhoto(base64)
    stopTracks()
  }

  // Retira nova foto
  const handleRetake = () => {
    setCapturedPhoto(null)
    startCamera(facingMode)
  }

  // Confirma e envia para o card principal
  const handleConfirm = () => {
    if (!capturedPhoto) return
    const filename = `foto_${slotType.toLowerCase()}_${Date.now()}.jpg`
    onCapture(capturedPhoto, 'image/jpeg', filename)
    toast.success(`Foto ${slotType} capturada com sucesso! Processando leitura...`)
    handleClose()
  }

  const handleClose = () => {
    stopTracks()
    setCapturedPhoto(null)
    setCameraError(null)
    onClose()
  }

  // Fallback de seleção de arquivo
  const handleFileFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      onCapture(base64, file.type || 'image/jpeg', file.name)
      toast.success(`Foto ${slotType} anexada com sucesso!`)
      handleClose()
    }
    reader.readAsDataURL(file)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="lg"
    >
      <div className="space-y-4">
        {/* Banner com instruções e indicação do modo */}
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900 border border-emerald-200">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-emerald-700 shrink-0" />
            <span>
              Enquadre o <strong>visor LCD do termômetro</strong> com boa iluminação e foco nítido nos dígitos.
            </span>
          </div>
          <span
            className={`font-bold px-2 py-0.5 rounded text-[11px] ${
              slotType === 'MAX' ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-800'
            }`}
          >
            Modo {slotType}
          </span>
        </div>

        {/* Área de Visualização da Câmera / Foto */}
        <div className="relative flex min-h-[320px] max-h-[480px] w-full items-center justify-center overflow-hidden rounded-2xl bg-neutral-950 shadow-inner">
          {isLoadingCamera && (
            <div className="flex flex-col items-center gap-2 text-white">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <span className="text-sm font-medium">Iniciando câmera...</span>
            </div>
          )}

          {cameraError && (
            <div className="mx-6 flex flex-col items-center gap-3 p-6 text-center text-white">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-rose-200">{cameraError}</p>
              <p className="text-xs text-neutral-400">
                Você pode anexar uma foto existente diretamente do computador ou galeria.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileFallbackInputRef.current?.click()}
                className="mt-2"
              >
                <FolderOpen className="mr-2 h-4 w-4 text-emerald-600" />
                Escolher Arquivo do Computador
              </Button>
            </div>
          )}

          {/* Vídeo ao Vivo */}
          {!isLoadingCamera && !cameraError && !capturedPhoto && (
            <div className="relative h-full w-full">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full max-h-[460px] w-full object-cover ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* Guia de enquadramento do display */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-3/4 w-4/5 rounded-2xl border-2 border-dashed border-emerald-400/80 bg-emerald-950/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  <div className="absolute top-2 left-2 text-[10px] font-bold text-emerald-300 uppercase tracking-widest bg-emerald-950/80 px-2 py-0.5 rounded">
                    Centralize o Visor LCD
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pré-visualização da Foto Capturada */}
          {capturedPhoto && (
            <div className="relative h-full w-full">
              <img
                src={capturedPhoto}
                alt="Foto capturada do visor"
                className="h-full max-h-[460px] w-full object-contain"
              />
              <div className="absolute top-3 left-3 rounded-lg bg-emerald-900/90 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                Foto Capturada
              </div>
            </div>
          )}
        </div>

        {/* Canvas oculto para extrair frame */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Input fallback oculto */}
        <input
          ref={fileFallbackInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileFallbackChange}
        />

        {/* Barra de Ações */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-neutral-100">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileFallbackInputRef.current?.click()}
            >
              <FolderOpen className="mr-1.5 h-4 w-4 text-neutral-500" />
              Arquivo Local
            </Button>

            {!capturedPhoto && !cameraError && hasMultipleCameras && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleToggleCamera}
                title="Trocar Câmera"
              >
                <FlipHorizontal className="mr-1.5 h-4 w-4 text-neutral-600" />
                Trocar Câmera
              </Button>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            {capturedPhoto ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleRetake}
                >
                  <RefreshCw className="mr-1.5 h-4 w-4 text-neutral-600" />
                  Tirar Novamente
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleConfirm}
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  Confirmar & Analisar
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleClose}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleTakeSnapshot}
                  disabled={isLoadingCamera || !!cameraError}
                >
                  <Camera className="mr-1.5 h-4 w-4" />
                  Capturar Foto
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}


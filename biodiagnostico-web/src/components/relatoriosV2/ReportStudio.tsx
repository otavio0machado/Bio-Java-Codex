import axios from 'axios'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileSignature,
  FileText,
  Maximize2,
  PlayCircle,
  Printer,
  RotateCcw,
  ShieldCheck,
  Tag,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useGenerateReportV2,
  useReportDefinitionV2,
  useSignReportV2,
} from '../../hooks/useReportsV2'
import { reportsV2Service } from '../../services/reportsV2Service'
import type {
  ReportCode,
  ReportDefinition,
  ReportExecutionResponse,
  ReportFilterField,
  ReportFormat,
} from '../../types/reportsV2'
import { Button, Card, LoadingSpinner, Select, useToast } from '../ui'
import { DynamicFilterForm } from './DynamicFilterForm'
import { SignReportModal } from './SignReportModal'
import { LabelsManagerModal } from './LabelsManagerModal'

export function ReportStudio() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const reportCode = code as ReportCode | undefined
  const definitionQuery = useReportDefinitionV2(reportCode)
  const generateMutation = useGenerateReportV2()
  const signMutation = useSignReportV2()

  const [filters, setFilters] = useState<Record<string, unknown>>({})
  const [format, setFormat] = useState<ReportFormat>('PDF')
  const [signImmediately, setSignImmediately] = useState(false)
  const [lastExecution, setLastExecution] = useState<ReportExecutionResponse | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Live PDF preview state
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const [pdfFilename, setPdfFilename] = useState<string | null>(null)

  // Modals
  const [isSignModalOpen, setIsSignModalOpen] = useState(false)
  const [isLabelsModalOpen, setIsLabelsModalOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const defaultsInitializedRef = useRef<ReportCode | null>(null)

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl)
      }
    }
  }, [pdfBlobUrl])

  useEffect(() => {
    const def = definitionQuery.data
    if (def && !def.supportedFormats.includes(format)) {
      setFormat(def.supportedFormats[0] ?? 'PDF')
    }
  }, [definitionQuery.data, format])

  useEffect(() => {
    setFilters({})
    setLastExecution(null)
    setGenerateError(null)
    setSignImmediately(false)
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl)
      setPdfBlobUrl(null)
    }
    setPdfFilename(null)
    defaultsInitializedRef.current = null
  }, [reportCode])

  useEffect(() => {
    const def = definitionQuery.data
    if (!def || !reportCode || defaultsInitializedRef.current === reportCode) return
    defaultsInitializedRef.current = reportCode
    setFilters(buildDefaultFilters(def))
  }, [definitionQuery.data, reportCode])

  const handleGenerate = async () => {
    if (!reportCode) return
    setGenerateError(null)
    setIsPdfLoading(true)
    const effectiveSign = definition?.signatureRequired ? true : signImmediately

    try {
      const execution = await generateMutation.mutateAsync({
        code: reportCode,
        filters,
        format,
        signImmediately: effectiveSign,
      })

      let finalExecution = execution
      if (effectiveSign && execution.status !== 'SIGNED') {
        try {
          finalExecution = await signMutation.mutateAsync({ id: execution.id })
          notifyGenerated(toast, finalExecution, true)
        } catch (signError) {
          toast.warning(
            `Relatório gerado, mas falha ao assinar: ${extractErrorMessage(signError)}`,
          )
        }
      } else {
        notifyGenerated(toast, execution, false)
      }

      setLastExecution(finalExecution)

      // Download blob to show in PDF viewer
      try {
        const downloadResult = await reportsV2Service.downloadBlob(finalExecution.id)
        if (pdfBlobUrl) {
          URL.revokeObjectURL(pdfBlobUrl)
        }
        const newUrl = URL.createObjectURL(downloadResult.blob)
        setPdfBlobUrl(newUrl)
        setPdfFilename(downloadResult.filename ?? `${finalExecution.reportNumber ?? finalExecution.id}.pdf`)
      } catch (blobErr) {
        toast.warning('Laudo gerado com sucesso.')
      }
    } catch (error) {
      setGenerateError(extractErrorMessage(error))
    } finally {
      setIsPdfLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!lastExecution) return
    try {
      const result = await reportsV2Service.downloadBlob(lastExecution.id)
      const url = URL.createObjectURL(result.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download =
        result.filename ?? `${lastExecution.reportNumber ?? lastExecution.id}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success('Download iniciado.')
    } catch (error) {
      toast.error(`Falha ao baixar: ${extractErrorMessage(error)}`)
    }
  }

  const handlePrint = () => {
    if (pdfBlobUrl) {
      const printWindow = window.open(pdfBlobUrl, '_blank')
      if (printWindow) {
        printWindow.focus()
      } else {
        window.print()
      }
    }
  }

  const handleCopyVerifyUrl = async () => {
    if (!lastExecution?.verifyUrl) {
      toast.warning('Este laudo ainda não possui link público de verificação.')
      return
    }
    try {
      await navigator.clipboard.writeText(lastExecution.verifyUrl)
      toast.success('Link de verificação pública copiado.')
    } catch {
      toast.warning('Não foi possível copiar o link automaticamente.')
    }
  }

  if (!reportCode) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <p className="text-base text-neutral-600">Código de relatório ausente.</p>
        </Card>
      </div>
    )
  }

  if (definitionQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner size="lg" className="text-green-800" />
      </div>
    )
  }

  if (definitionQuery.isError || !definitionQuery.data) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Card className="space-y-4">
          <div className="flex items-center gap-3 text-red-700">
            <AlertTriangle className="h-6 w-6" />
            <h3 className="text-lg font-semibold">Relatório Indisponível</h3>
          </div>
          <p className="text-sm text-neutral-600">
            {definitionQuery.error
              ? extractErrorMessage(definitionQuery.error)
              : 'Não foi possível carregar a definição deste relatório.'}
          </p>
          <Button variant="secondary" onClick={() => navigate('/relatorios')} icon={<ArrowLeft className="h-4 w-4" />}>
            Voltar aos Relatórios
          </Button>
        </Card>
      </div>
    )
  }

  const definition = definitionQuery.data
  const canGenerate = hasRequiredFilters(definition, filters)
  const isSigned = lastExecution?.status === 'SIGNED'

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Padronizado */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/relatorios')}
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            Voltar
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-neutral-900">{definition.name}</h1>
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600">
                {definition.code}
              </span>
            </div>
            <p className="mt-1 text-base text-neutral-500">{definition.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {definition.supportedFormats.length > 1 ? (
            <Select value={format} onChange={(event) => setFormat(event.target.value as ReportFormat)}>
              {definition.supportedFormats.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          ) : null}

          <Button
            onClick={() => void handleGenerate()}
            loading={generateMutation.isPending || signMutation.isPending || isPdfLoading}
            disabled={!canGenerate}
            icon={<PlayCircle className="h-4 w-4" />}
          >
            {lastExecution ? 'Regerar Laudo' : `Gerar Laudo (${format})`}
          </Button>
        </div>
      </header>

      {/* Grid Principal */}
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        {/* Painel de Filtros à Esquerda */}
        <aside className="space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Parâmetros</h2>
                <p className="text-xs text-neutral-500">Defina o período e filtros do laudo.</p>
              </div>
              <button
                type="button"
                onClick={() => setFilters(buildDefaultFilters(definition))}
                className="text-xs font-medium text-neutral-500 hover:text-neutral-900 inline-flex items-center gap-1"
                title="Restaurar valores padrão"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Limpar
              </button>
            </div>

            <DynamicFilterForm
              filterSpec={definition.filterSpec}
              values={filters}
              onChange={setFilters}
            />

            {/* Opção de Assinatura */}
            <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={definition.signatureRequired ? true : signImmediately}
                  disabled={definition.signatureRequired}
                  onChange={(event) => setSignImmediately(event.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-green-800 focus:ring-green-800 disabled:opacity-60"
                />
                <span>
                  {definition.signatureRequired ? 'Assinatura obrigatória do RT' : 'Assinar digitalmente após gerar'}
                </span>
              </label>

              <div className="border-t border-neutral-200/60 pt-2 text-xs text-neutral-500">
                <p className="font-medium text-neutral-700">Base Normativa:</p>
                <p className="mt-0.5">{definition.legalBasis}</p>
              </div>
            </div>
          </Card>
        </aside>

        {/* Visualizador de Laudo à Direita */}
        <section className="space-y-4">
          {generateError ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Erro ao gerar laudo</p>
                <p className="mt-1">{generateError}</p>
              </div>
            </div>
          ) : null}

          {/* Barra de Status do Laudo Gerado */}
          {lastExecution ? (
            <div
              className={
                'flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 text-sm ' +
                (lastExecution.status === 'WITH_WARNINGS'
                  ? 'border-amber-200 bg-amber-50 text-amber-950'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-950')
              }
            >
              <div className="flex items-center gap-3">
                {isSigned ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {lastExecution.reportNumber ?? 'Laudo Oficial'}{' '}
                    {isSigned ? '(Assinado)' : '(Não assinado)'}
                  </p>
                  <p className="text-xs opacity-80">
                    Período: {lastExecution.periodLabel ?? '-'} · Emitido em{' '}
                    {new Date(lastExecution.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isSigned ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsSignModalOpen(true)}
                    icon={<FileSignature className="h-3.5 w-3.5" />}
                  >
                    Assinar
                  </Button>
                ) : null}

                {lastExecution.verifyUrl ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleCopyVerifyUrl()}
                    icon={<Copy className="h-3.5 w-3.5" />}
                  >
                    Copiar Link QR
                  </Button>
                ) : null}

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsLabelsModalOpen(true)}
                  icon={<Tag className="h-3.5 w-3.5" />}
                >
                  Etiquetas
                </Button>

                <Button
                  size="sm"
                  onClick={() => void handleDownload()}
                  icon={<Download className="h-3.5 w-3.5" />}
                >
                  Baixar PDF
                </Button>
              </div>
            </div>
          ) : null}

          {/* Card do Visualizador */}
          <Card className="min-h-[36rem] overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-800" />
                <span className="text-sm font-semibold text-neutral-800">
                  {pdfFilename ?? 'Visualizador de Laudo'}
                </span>
              </div>

              {pdfBlobUrl ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handlePrint}
                    icon={<Printer className="h-3.5 w-3.5" />}
                  >
                    Imprimir
                  </Button>
                  <a
                    href={pdfBlobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200/60"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Nova Aba
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    icon={<Maximize2 className="h-3.5 w-3.5" />}
                  >
                    {isFullscreen ? 'Normal' : 'Expandir'}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className={`relative bg-neutral-100 ${isFullscreen ? 'fixed inset-4 z-50 rounded-2xl shadow-2xl flex flex-col bg-white' : 'min-h-[34rem]'}`}>
              {isFullscreen ? (
                <div className="flex items-center justify-between border-b p-3 bg-neutral-50">
                  <span className="font-semibold text-sm">{pdfFilename}</span>
                  <Button size="sm" variant="secondary" onClick={() => setIsFullscreen(false)}>Fechar Tela Cheia</Button>
                </div>
              ) : null}

              {isPdfLoading ? (
                <div className="flex h-[34rem] flex-col items-center justify-center gap-3">
                  <LoadingSpinner size="lg" className="text-green-800" />
                  <p className="text-sm text-neutral-600">Compilando laudo oficial...</p>
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  src={`${pdfBlobUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                  title="Laudo PDF"
                  className="h-[38rem] w-full border-0 bg-white"
                />
              ) : (
                <div className="flex h-[34rem] flex-col items-center justify-center gap-3 p-8 text-center text-neutral-500">
                  <FileCheck2 className="h-10 w-10 text-neutral-400" />
                  <p className="text-base font-semibold text-neutral-800">Pronto para Geração</p>
                  <p className="max-w-md text-sm text-neutral-500">
                    Ajuste os parâmetros no painel ao lado e clique em <strong>"Gerar Laudo"</strong> para visualizar o laudo em alta resolução.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </section>
      </div>

      {/* Modal de Assinatura */}
      {isSignModalOpen && lastExecution ? (
        <SignReportModal
          execution={lastExecution}
          onClose={() => setIsSignModalOpen(false)}
          onSigned={(signed) => {
            setLastExecution(signed)
            setIsSignModalOpen(false)
            void (async () => {
              try {
                const res = await reportsV2Service.downloadBlob(signed.id)
                if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
                setPdfBlobUrl(URL.createObjectURL(res.blob))
              } catch (e) {
                // ignore
              }
            })()
          }}
        />
      ) : null}

      {/* Modal de Etiquetas */}
      {isLabelsModalOpen && lastExecution ? (
        <LabelsManagerModal
          execution={lastExecution}
          onClose={() => setIsLabelsModalOpen(false)}
          onChange={(updated) => {
            setLastExecution(updated)
            setIsLabelsModalOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

function buildDefaultFilters(definition: ReportDefinition): Record<string, unknown> {
  const defaults: Record<string, unknown> = {}
  for (const field of definition.filterSpec.fields) {
    if (field.key === 'periodType' && field.allowedValues?.includes('current-month')) {
      defaults[field.key] = 'current-month'
    } else if (field.key === 'area' && field.allowedValues?.includes('bioquimica')) {
      defaults[field.key] = 'bioquimica'
    } else if (field.key === 'areas' && field.required && field.allowedValues?.length) {
      defaults[field.key] = field.allowedValues
    } else if (field.required && field.type === 'STRING_ENUM' && field.allowedValues?.length === 1) {
      defaults[field.key] = field.allowedValues[0]
    }
  }
  return defaults
}

function hasRequiredFilters(definition: ReportDefinition, values: Record<string, unknown>): boolean {
  for (const field of definition.filterSpec.fields) {
    if (field.required && !hasValue(values[field.key], field)) return false
  }

  const periodType = values.periodType
  if (periodType === 'specific-month') {
    return hasValue(values.month) && hasValue(values.year)
  }
  if (periodType === 'year') {
    return hasValue(values.year)
  }
  if (periodType === 'date-range') {
    return hasValue(values.dateFrom) && hasValue(values.dateTo)
  }
  return true
}

function hasValue(value: unknown, field?: ReportFilterField): boolean {
  if (Array.isArray(value)) return field?.required ? value.length > 0 : true
  return value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '')
}

function notifyGenerated(
  toast: ReturnType<typeof useToast>['toast'],
  execution: ReportExecutionResponse,
  signed: boolean,
) {
  const reportNumber = execution.reportNumber ?? ''
  if ((execution.warnings ?? []).length > 0 || execution.status === 'WITH_WARNINGS') {
    toast.warning(`Laudo ${reportNumber} gerado com observações.`)
    return
  }
  toast.success(`Laudo ${reportNumber} gerado com sucesso${signed ? ' e assinado digitalmente' : ''}.`)
}

function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          message?: string
          error?: string
          detail?: string
          title?: string
          violations?: Array<{ field?: string; message?: string } | string>
        }
      | undefined
    if (data?.violations && data.violations.length > 0) {
      return data.violations
        .map((v) => (typeof v === 'string' ? v : v.field ? `${v.field}: ${v.message ?? ''}` : v.message ?? ''))
        .filter(Boolean)
        .join('; ')
    }
    return data?.detail ?? data?.message ?? data?.title ?? data?.error ?? error.message
  }
  if (error instanceof Error) return error.message
  return 'Erro desconhecido'
}

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
  ShieldAlert,
  ShieldCheck,
  Sparkles,
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

  // Cleanup blob URL on unmount or new PDF
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl)
      }
    }
  }, [pdfBlobUrl])

  // Pre-selection of format
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

      // Automatically download blob and load into live PDF viewer
      try {
        const downloadResult = await reportsV2Service.downloadBlob(finalExecution.id)
        if (pdfBlobUrl) {
          URL.revokeObjectURL(pdfBlobUrl)
        }
        const newUrl = URL.createObjectURL(downloadResult.blob)
        setPdfBlobUrl(newUrl)
        setPdfFilename(downloadResult.filename ?? `${finalExecution.reportNumber ?? finalExecution.id}.pdf`)
      } catch (blobErr) {
        toast.warning('Laudo gerado com sucesso, mas não foi possível carregar o preview embutido.')
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
      toast.success('Download do laudo iniciado.')
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
      toast.success('Link de verificação pública copiado para a área de transferência.')
    } catch {
      toast.warning('Não foi possível copiar o link automaticamente.')
    }
  }

  const handleApplyPreset = (periodType: string, customPayload?: Record<string, unknown>) => {
    setFilters((prev) => ({
      ...prev,
      periodType,
      ...customPayload,
    }))
    toast.success(`Preset '${periodType}' aplicado aos filtros.`)
  }

  if (!reportCode) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card>
          <p className="text-sm text-neutral-600">Código de relatório ausente.</p>
        </Card>
      </div>
    )
  }

  if (definitionQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <LoadingSpinner size="lg" className="text-green-800" />
        <p className="text-sm text-neutral-500">Carregando estúdio de laudos...</p>
      </div>
    )
  }

  if (definitionQuery.isError || !definitionQuery.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card className="space-y-4">
          <div className="flex items-center gap-3 text-red-700">
            <AlertTriangle className="h-6 w-6" />
            <h3 className="text-lg font-semibold">Relatório Indisponível</h3>
          </div>
          <p className="text-sm text-neutral-600">
            {definitionQuery.error
              ? extractErrorMessage(definitionQuery.error)
              : 'Não foi possível carregar a definição e os esquemas deste relatório.'}
          </p>
          <Button variant="secondary" onClick={() => navigate('/relatorios')} icon={<ArrowLeft className="h-4 w-4" />}>
            Voltar à Central de Relatórios
          </Button>
        </Card>
      </div>
    )
  }

  const definition = definitionQuery.data
  const canGenerate = hasRequiredFilters(definition, filters)
  const lastExecutionHasWarnings = (lastExecution?.warnings ?? []).length > 0
  const isSigned = lastExecution?.status === 'SIGNED'

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Studio Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/relatorios')}
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            Central
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-900">
                {definition.code}
              </span>
              {definition.signatureRequired ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-900">
                  <ShieldCheck className="h-3 w-3" /> Assinatura RT Obrigatória
                </span>
              ) : null}
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                Retenção: {formatRetention(definition.retentionDays)}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">{definition.name}</h1>
            <p className="text-sm text-neutral-500">{definition.description}</p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap items-center gap-3">
          {definition.supportedFormats.length > 1 ? (
            <Select value={format} onChange={(event) => setFormat(event.target.value as ReportFormat)}>
              {definition.supportedFormats.map((item) => (
                <option key={item} value={item}>
                  Formato: {item}
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
            {lastExecution ? 'Regerar Laudo' : `Gerar Laudo Oficial (${format})`}
          </Button>
        </div>
      </header>

      {/* Main Studio Grid */}
      <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
        {/* Left Column: Filter Sidebar */}
        <aside className="space-y-4">
          {/* Quick Presets */}
          <Card className="space-y-3 bg-gradient-to-br from-neutral-50 to-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-800" />
              <h3 className="text-sm font-semibold text-neutral-900">Atalhos de Período</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset('current-month')}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-xs font-medium text-neutral-700 shadow-2xs transition hover:border-green-800 hover:text-green-900"
              >
                📅 Mês Atual
              </button>
              <button
                type="button"
                onClick={() => {
                  const lastMonth = new Date()
                  lastMonth.setMonth(lastMonth.getMonth() - 1)
                  handleApplyPreset('specific-month', {
                    month: lastMonth.getMonth() + 1,
                    year: lastMonth.getFullYear(),
                  })
                }}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-xs font-medium text-neutral-700 shadow-2xs transition hover:border-green-800 hover:text-green-900"
              >
                ⏪ Mês Anterior
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('year', { year: new Date().getFullYear() })}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-xs font-medium text-neutral-700 shadow-2xs transition hover:border-green-800 hover:text-green-900"
              >
                📊 Ano Fiscal ({new Date().getFullYear()})
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date()
                  const past30 = new Date(Date.now() - 30 * 86400000)
                  handleApplyPreset('date-range', {
                    dateFrom: past30.toISOString().slice(0, 10),
                    dateTo: now.toISOString().slice(0, 10),
                  })
                }}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-xs font-medium text-neutral-700 shadow-2xs transition hover:border-green-800 hover:text-green-900"
              >
                ⏱️ Últimos 30 Dias
              </button>
            </div>
          </Card>

          {/* Filter Form Card */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">Parâmetros do Laudo</h2>
                <p className="text-xs text-neutral-500">Defina os critérios de amostragem e filtros analíticos.</p>
              </div>
              <button
                type="button"
                onClick={() => setFilters(buildDefaultFilters(definition))}
                className="text-xs font-medium text-neutral-500 hover:text-neutral-900 inline-flex items-center gap-1"
                title="Restaurar valores padrão"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>

            <DynamicFilterForm
              filterSpec={definition.filterSpec}
              values={filters}
              onChange={setFilters}
            />

            {/* Governance & Signature Options */}
            <div className="space-y-3 rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-600">Governança & Assinatura</h4>

              <label
                className={
                  'flex items-center gap-2 rounded-xl border bg-white p-2.5 text-xs font-medium transition ' +
                  (definition.signatureRequired
                    ? 'border-purple-200 text-purple-900 shadow-2xs'
                    : 'border-neutral-200 text-neutral-700')
                }
              >
                <input
                  type="checkbox"
                  checked={definition.signatureRequired ? true : signImmediately}
                  disabled={definition.signatureRequired}
                  onChange={(event) => setSignImmediately(event.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-green-800 focus:ring-green-800 disabled:opacity-60"
                />
                <span>
                  {definition.signatureRequired ? 'Assinatura digital obrigatória do RT' : 'Assinar digitalmente após gerar'}
                </span>
              </label>

              <div className="space-y-1 text-xs text-neutral-500">
                <p className="font-semibold text-neutral-700">Base Normativa / Acreditação:</p>
                <p className="leading-relaxed">{definition.legalBasis}</p>
              </div>
            </div>
          </Card>
        </aside>

        {/* Right Column: Live PDF Document Viewer */}
        <section className="space-y-4">
          {/* Error notification */}
          {generateError ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Erro na Emissão do Laudo</p>
                <p className="mt-1 leading-relaxed">{generateError}</p>
              </div>
            </div>
          ) : null}

          {/* Last execution metadata bar */}
          {lastExecution ? (
            <div
              className={
                'flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 shadow-sm transition ' +
                (lastExecutionHasWarnings
                  ? 'border-amber-200 bg-amber-50/70 text-amber-950'
                  : 'border-emerald-200 bg-emerald-50/70 text-emerald-950')
              }
            >
              <div className="flex items-center gap-3">
                {isSigned ? (
                  <div className="rounded-xl bg-emerald-600 p-2 text-white">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                ) : lastExecutionHasWarnings ? (
                  <div className="rounded-xl bg-amber-600 p-2 text-white">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                ) : (
                  <div className="rounded-xl bg-emerald-600 p-2 text-white">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-base">
                      {lastExecution.reportNumber ?? 'Laudo Oficial'}
                    </p>
                    {isSigned ? (
                      <span className="rounded-full bg-emerald-200/70 px-2 py-0.5 text-xs font-semibold text-emerald-900">
                        Assinado Digitalmente
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-800">
                        Pendente de Assinatura
                      </span>
                    )}
                  </div>
                  <p className="text-xs opacity-85">
                    Período: <strong>{lastExecution.periodLabel ?? '-'}</strong> · Emitido por{' '}
                    <strong>{lastExecution.username ?? 'Sistema'}</strong>
                    {lastExecution.signedAt ? ` · Assinado em ${new Date(lastExecution.signedAt).toLocaleString('pt-BR')}` : ''}
                  </p>
                </div>
              </div>

              {/* Action buttons on generated bar */}
              <div className="flex flex-wrap items-center gap-2">
                {!isSigned ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsSignModalOpen(true)}
                    icon={<FileSignature className="h-3.5 w-3.5" />}
                  >
                    Assinar como RT
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

          {/* Live Document Viewer Card */}
          <Card className="min-h-[38rem] overflow-hidden p-0">
            {/* Viewer Toolbar */}
            <div className="flex flex-wrap items-center justify-between border-b border-neutral-200 bg-neutral-50/90 px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-800" />
                <span className="text-sm font-semibold text-neutral-900">
                  {pdfFilename ?? 'Visualizador Oficial de Laudo (Alta Fidelidade)'}
                </span>
                {pdfBlobUrl ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                    PDF 300 DPI
                  </span>
                ) : null}
              </div>

              {pdfBlobUrl ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handlePrint}
                    icon={<Printer className="h-3.5 w-3.5" />}
                    title="Imprimir laudo"
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
                    title="Tela cheia"
                  >
                    {isFullscreen ? 'Normal' : 'Expandir'}
                  </Button>
                </div>
              ) : null}
            </div>

            {/* Viewer Body */}
            <div className={`relative bg-neutral-100 ${isFullscreen ? 'fixed inset-4 z-50 rounded-2xl shadow-2xl flex flex-col bg-white' : 'min-h-[36rem]'}`}>
              {isFullscreen ? (
                <div className="flex items-center justify-between border-b p-3 bg-neutral-50">
                  <span className="font-semibold text-sm">{pdfFilename}</span>
                  <Button size="sm" variant="secondary" onClick={() => setIsFullscreen(false)}>Fechar Tela Cheia</Button>
                </div>
              ) : null}

              {isPdfLoading ? (
                <div className="flex h-[36rem] flex-col items-center justify-center gap-3">
                  <LoadingSpinner size="lg" className="text-green-800" />
                  <p className="text-sm font-medium text-neutral-600">Compilando laudo em alta resolução (300 DPI)...</p>
                  <p className="text-xs text-neutral-400">Processando tabelas analíticas, gráficos de dispersão e assinaturas.</p>
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  src={`${pdfBlobUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                  title="Laudo PDF"
                  className="h-[42rem] w-full border-0 bg-white shadow-inner"
                />
              ) : (
                <div className="flex h-[36rem] flex-col items-center justify-center gap-4 p-8 text-center">
                  <div className="rounded-3xl bg-white p-6 shadow-sm border border-neutral-200/80">
                    <FileCheck2 className="mx-auto h-12 w-12 text-green-800" />
                    <h3 className="mt-3 text-lg font-bold text-neutral-900">Laudo Pronto para Emissão</h3>
                    <p className="mt-1 max-w-md text-sm text-neutral-500">
                      Configure os filtros no painel à esquerda e clique em <strong>"Gerar Laudo Oficial"</strong> para visualizar o documento completo em alta resolução com assinatura digital.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-700" /> Gráficos JFreeChart 300 DPI
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-700" /> QR Code de Validação Pública
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-700" /> Rastreabilidade SHA-256
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>
      </div>

      {/* Signature Modal */}
      {isSignModalOpen && lastExecution ? (
        <SignReportModal
          execution={lastExecution}
          onClose={() => setIsSignModalOpen(false)}
          onSigned={(signed) => {
            setLastExecution(signed)
            setIsSignModalOpen(false)
            // Reload updated signed PDF
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

      {/* Labels Modal */}
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
    toast.warning(`Laudo ${reportNumber} gerado com observações de conformidade.`)
    return
  }
  toast.success(`Laudo ${reportNumber} emitido com sucesso${signed ? ' e assinado digitalmente' : ''}.`)
}

function formatRetention(days: number): string {
  if (!days || days <= 0) return 'Permanente'
  if (days < 30) return `${days} dias`
  if (days < 365) {
    const months = Math.round(days / 30)
    return `${months} ${months === 1 ? 'mês' : 'meses'}`
  }
  const years = Math.round((days / 365) * 10) / 10
  const rounded = Number.isInteger(years) ? years.toFixed(0) : years.toFixed(1)
  return `${rounded} ${years === 1 ? 'ano' : 'anos'}`
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

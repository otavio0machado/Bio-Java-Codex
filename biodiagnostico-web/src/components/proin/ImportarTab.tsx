import axios from 'axios'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, UploadCloud } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useCreateQcBatch } from '../../hooks/useQcRecords'
import type { ImportedQcPreviewRow, QcRecordRequest } from '../../types'
import { Button, Card, EmptyState, useToast } from '../ui'

interface ImportarTabProps {
  area: string
}

interface ImportIssue {
  line: number
  message: string
}

interface PreviewRow extends ImportedQcPreviewRow {
  sourceLine: number
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_IMPORT_ROWS = 1000
type SpreadsheetDateParser = (value: number) => { y: number; m: number; d: number } | null

export function ImportarTab({ area }: ImportarTabProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const createBatch = useCreateQcBatch()
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [issues, setIssues] = useState<ImportIssue[]>([])
  const [fileName, setFileName] = useState('')
  const [isParsingFile, setIsParsingFile] = useState(false)
  const [totalRows, setTotalRows] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)

  const clearPreview = () => {
    setPreviewRows([])
    setIssues([])
    setFileName('')
    setTotalRows(0)
  }

  const parseFile = async (file: File) => {
    const extension = file.name.toLowerCase()
    if (!extension.endsWith('.xlsx') && !extension.endsWith('.xls')) {
      toast.error('Formato inválido. Envie uma planilha `.xlsx` ou `.xls`.')
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error('Arquivo muito grande. O limite atual é de 10 MB.')
      return
    }

    setIsParsingFile(true)

    try {
      const [{ SSF, read, utils }, buffer] = await Promise.all([import('xlsx'), file.arrayBuffer()])
      const workbook = read(buffer, { cellDates: true })
      const firstSheetName = workbook.SheetNames[0]
      const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined

      if (!firstSheet) {
        toast.error('Não foi possível localizar uma planilha válida no arquivo enviado.')
        clearPreview()
        return
      }

      const rows = utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' })
      if (!rows.length) {
        toast.warning('A planilha está vazia.')
        clearPreview()
        return
      }
      if (rows.length > MAX_IMPORT_ROWS) {
        toast.error(`A planilha excede o limite de ${MAX_IMPORT_ROWS} linhas por importação.`)
        clearPreview()
        return
      }

      const parseSpreadsheetDateCode: SpreadsheetDateParser = SSF.parse_date_code
      const nextPreviewRows: PreviewRow[] = []
      const nextIssues: ImportIssue[] = []

      rows.forEach((row, index) => {
        const lineNumber = index + 2
        const normalized = normalizeRow(row)

        const mappedRow: PreviewRow = {
          previewId: crypto.randomUUID(),
          sourceLine: lineNumber,
          examName: readString(normalized, ['examName', 'exame']),
          area: readString(normalized, ['area']) || area,
          date: readDate(normalized, ['date', 'data'], parseSpreadsheetDateCode),
          level: readString(normalized, ['level', 'nivel']) || 'Normal',
          lotNumber: readOptionalString(normalized, ['lotNumber', 'lot', 'lote']),
          value: readNumber(normalized, ['value', 'valor']),
          targetValue: readNumber(normalized, ['targetValue', 'valorAlvo', 'alvo']),
          targetSd: readNumber(normalized, ['targetSd', 'desvioPadrao', 'dp']),
          cvLimit: readOptionalNumber(normalized, ['cvLimit', 'cvLimite', 'cvMax', 'cvMaxThreshold']) ?? 10,
          equipment: readOptionalString(normalized, ['equipment', 'equipamento']),
          analyst: readOptionalString(normalized, ['analyst', 'analista']),
        }

        const rowIssues = validatePreviewRow(mappedRow)
        if (rowIssues.length) {
          nextIssues.push(...rowIssues.map((message) => ({ line: lineNumber, message })))
          return
        }

        nextPreviewRows.push(mappedRow)
      })

      setFileName(file.name)
      setTotalRows(rows.length)
      setPreviewRows(nextPreviewRows)
      setIssues(nextIssues)

      if (nextIssues.length) {
        toast.warning(`Foram encontrados ${nextIssues.length} problema(s). Corrija a planilha antes de importar.`)
        return
      }

      toast.success(`${nextPreviewRows.length} linha(s) válidas prontas para importação.`)
    } catch {
      clearPreview()
      toast.error('Não foi possível ler a planilha enviada.')
    } finally {
      setIsParsingFile(false)
    }
  }

  const handleImport = async () => {
    if (!previewRows.length) {
      toast.warning('Nenhuma linha válida foi carregada para importação.')
      return
    }
    if (issues.length) {
      toast.warning('Corrija os erros da planilha antes de importar.')
      return
    }

    try {
      const payload: QcRecordRequest[] = previewRows.map((row) => {
        const { previewId, sourceLine, ...payloadRow } = row
        void previewId
        void sourceLine
        return payloadRow
      })
      await createBatch.mutateAsync(payload)
      toast.success('Importação concluída com sucesso.')
      clearPreview()
    } catch (error) {
      toast.error(extractApiErrorMessage(error))
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div
          className={`flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 text-center transition-colors ${
            isDragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-neutral-200 bg-neutral-50'
          }`}
          onClick={() => {
            if (!isParsingFile) {
              inputRef.current?.click()
            }
          }}
          onDragOver={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onDragEnter={(event) => {
            event.preventDefault()
            event.stopPropagation()
            if (!isParsingFile) {
              setIsDragOver(true)
            }
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setIsDragOver(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setIsDragOver(false)
            if (isParsingFile) return
            const file = event.dataTransfer.files[0]
            if (file) {
              void parseFile(file)
            }
          }}
        >
          <UploadCloud className={`h-10 w-10 ${isDragOver ? 'text-blue-600' : 'text-green-800'}`} />
          <h3 className="mt-4 text-lg font-semibold text-neutral-900">Arraste ou selecione um arquivo Excel</h3>
          <p className="mt-2 max-w-xl text-sm text-neutral-500">
            Aceita `.xlsx` e `.xls` com até 1000 linhas. Colunas suportadas: `examName`/`exame`, `date`/`data`,
            `value`/`valor`, `targetValue`/`valorAlvo`/`alvo` e `targetSd`/`desvioPadrao`/`dp`.
          </p>
          <Button className="mt-6" loading={isParsingFile}>
            {isParsingFile ? 'Lendo planilha...' : 'Selecionar arquivo'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            disabled={isParsingFile}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void parseFile(file)
              }
              event.target.value = ''
            }}
          />
        </div>
      </Card>

      {fileName ? (
        <Card className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Preview da importação</h3>
              <p className="text-sm text-neutral-500">
                Arquivo `{fileName}` · {previewRows.length} linha(s) válidas de {totalRows} detectadas
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="ghost" onClick={clearPreview}>
                Limpar
              </Button>
              <Button
                onClick={() => void handleImport()}
                loading={createBatch.isPending}
                disabled={isParsingFile || !previewRows.length || issues.length > 0}
              >
                Importar
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              icon={<FileSpreadsheet className="h-5 w-5" />}
              label="Linhas lidas"
              value={String(totalRows)}
              tone="neutral"
            />
            <SummaryCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Linhas válidas"
              value={String(previewRows.length)}
              tone="success"
            />
            <SummaryCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Problemas"
              value={String(issues.length)}
              tone={issues.length ? 'danger' : 'neutral'}
            />
          </div>

          {issues.length ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
                <AlertTriangle className="h-4 w-4" />
                Corrija os erros abaixo para liberar a importação
              </div>
              <div className="mt-3 space-y-2 text-sm text-red-700">
                {issues.slice(0, 8).map((issue, index) => (
                  <div key={`${issue.line}-${index}`} className="rounded-xl bg-white/70 px-3 py-2">
                    Linha {issue.line}: {issue.message}
                  </div>
                ))}
                {issues.length > 8 ? (
                  <div className="text-xs font-medium uppercase tracking-wide text-red-600">
                    + {issues.length - 8} problema(s) adicional(is)
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {previewRows.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="pb-3 font-medium">Linha</th>
                    <th className="pb-3 font-medium">Exame</th>
                    <th className="pb-3 font-medium">Data</th>
                    <th className="pb-3 font-medium">Nível</th>
                    <th className="pb-3 font-medium">Valor</th>
                    <th className="pb-3 font-medium">Alvo</th>
                    <th className="pb-3 font-medium">DP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {previewRows.slice(0, 12).map((row) => (
                    <tr key={row.previewId}>
                      <td className="py-3 text-neutral-500">{row.sourceLine}</td>
                      <td className="py-3">{row.examName}</td>
                      <td className="py-3">{row.date}</td>
                      <td className="py-3">{row.level}</td>
                      <td className="py-3">{row.value}</td>
                      <td className="py-3">{row.targetValue}</td>
                      <td className="py-3">{row.targetSd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      ) : (
        <EmptyState
          icon={<UploadCloud className="h-8 w-8" />}
          title="Nenhum arquivo carregado"
          description="Quando a planilha for lida, o preview vai aparecer aqui antes da importação."
        />
      )}
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  tone: 'neutral' | 'success' | 'danger'
}) {
  const toneClasses = {
    neutral: 'bg-neutral-50 text-neutral-700',
    success: 'bg-green-50 text-green-700',
    danger: 'bg-red-50 text-red-700',
  }

  return (
    <div className={`rounded-2xl p-4 ${toneClasses[tone]}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
    </div>
  )
}

function normalizeRow(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {}
  Object.entries(row).forEach(([key, value]) => {
    normalized[normalizeHeaderKey(key)] = value
  })
  return normalized
}

function normalizeHeaderKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function readValue(row: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[normalizeHeaderKey(alias)]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value
    }
  }
  return undefined
}

function readString(row: Record<string, unknown>, aliases: string[]) {
  const value = readValue(row, aliases)
  if (value === undefined) {
    return ''
  }
  return String(value).trim()
}

function readOptionalString(row: Record<string, unknown>, aliases: string[]) {
  const value = readString(row, aliases)
  return value || undefined
}

function readNumber(row: Record<string, unknown>, aliases: string[]) {
  const value = readValue(row, aliases)
  return parseNumber(value)
}

function readOptionalNumber(row: Record<string, unknown>, aliases: string[]) {
  const value = readValue(row, aliases)
  const parsed = parseNumber(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function readDate(row: Record<string, unknown>, aliases: string[], parseSpreadsheetDateCode: SpreadsheetDateParser) {
  const value = readValue(row, aliases)
  return parseSpreadsheetDate(value, parseSpreadsheetDateCode)
}

function parseNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Number.NaN
  }
  if (value instanceof Date) {
    return Number.NaN
  }

  const raw = String(value ?? '').trim()
  if (!raw) {
    return Number.NaN
  }

  const normalized = raw
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function parseSpreadsheetDate(value: unknown, parseSpreadsheetDateCode: SpreadsheetDateParser) {
  if (!value) {
    return ''
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  if (typeof value === 'number') {
    const parsed = parseSpreadsheetDateCode(value)
    if (!parsed) {
      return ''
    }
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }

  const raw = String(value).trim()
  if (!raw) {
    return ''
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10)
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('/')
    return `${year}-${month}-${day}`
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('-')
    return `${year}-${month}-${day}`
  }
  return ''
}

function validatePreviewRow(row: PreviewRow) {
  const errors: string[] = []

  if (!row.examName) {
    errors.push('Exame é obrigatório.')
  }
  if (!row.date) {
    errors.push('Data inválida ou ausente.')
  }
  if (!Number.isFinite(row.value)) {
    errors.push('Valor medido inválido.')
  }
  if (!Number.isFinite(row.targetValue)) {
    errors.push('Valor alvo inválido.')
  }
  if (!Number.isFinite(row.targetSd)) {
    errors.push('Desvio padrão alvo inválido.')
  }
  if (!Number.isFinite(row.cvLimit) || row.cvLimit < 0) {
    errors.push('CV limite inválido.')
  }

  return errors
}

function extractApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          message?: string
          fields?: Record<string, string>
        }
      | undefined

    if (data?.fields && Object.keys(data.fields).length) {
      const details = Object.entries(data.fields)
        .slice(0, 3)
        .map(([field, message]) => `${field}: ${message}`)
        .join(' · ')
      return details ? `${data.message ?? 'Dados inválidos'} · ${details}` : data.message ?? 'Dados inválidos.'
    }
    if (typeof data?.message === 'string' && data.message.trim()) {
      return data.message
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Não foi possível importar o arquivo selecionado.'
}

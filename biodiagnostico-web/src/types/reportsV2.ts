/**
 * Tipos V2 de Relatorios - alinhados ao contrato real exposto por
 * {@code /api/reports/v2/**}. Backend usa {@code ReportDefinitionResponse}
 * com {@code filters: FilterFieldDto[]} (nao aninhado em filterSpec); no
 * frontend exibimos uma visao aninhada {@code filterSpec.fields} por
 * conveniencia - o mapeamento e feito no service.
 */

/**
 * Codigo estavel exposto pelo backend. Hoje so CQ_OPERATIONAL_V2 existe;
 * tipamos como union aberta para nao quebrar ao ligar slices futuros.
 */
export type ReportCode = 'CQ_OPERATIONAL_V2' | (string & {})

/** Categorias usadas no catalogo (alinhadas ao enum do backend). */
export type ReportCategory =
  | 'CONTROLE_QUALIDADE'
  | 'REAGENTES'
  | 'MANUTENCAO'
  | 'HEMATOLOGIA'
  | (string & {})

export type ReportFormat = 'PDF' | 'HTML' | 'XLSX'

export type ReportFilterFieldType =
  | 'STRING_ENUM'
  | 'INTEGER'
  | 'DATE'
  | 'DATE_RANGE'
  | 'UUID'
  | 'UUID_LIST'
  | 'BOOLEAN'

export interface ReportFilterField {
  key: string
  type: ReportFilterFieldType
  required: boolean
  allowedValues: string[] | null
  label: string
  helpText: string | null
}

export interface ReportFilterSpec {
  fields: ReportFilterField[]
}

export interface ReportDefinition {
  code: ReportCode
  name: string
  description: string
  category: ReportCategory
  supportedFormats: ReportFormat[]
  filterSpec: ReportFilterSpec
  roleAccess: string[]
  signatureRequired: boolean
  previewSupported: boolean
  retentionDays: number
  legalBasis: string
}

/**
 * Resposta canonica de execucao V2. Alinha ao record Java {@code ReportExecutionResponse}.
 * Observacao: o backend atual NAO devolve {@code filters}, {@code durationMs},
 * {@code errorMessage}, {@code labels} na resposta V2 (alguns existem no
 * {@code ReportRun} V1 ainda). Expomos apenas o que o record serializa.
 */
export interface ReportExecutionResponse {
  id: string
  reportCode: ReportCode
  format: ReportFormat
  /** SUCCESS | FAILURE | SIGNED (string aberta para evolucao). */
  status: 'SUCCESS' | 'FAILURE' | 'SIGNED' | (string & {})
  reportNumber: string | null
  /** Hash do PDF original. */
  sha256: string | null
  /** Hash da versao assinada (== signedSha256). */
  signatureHash: string | null
  /** Alias explicito de signatureHash para clareza de cadeia. */
  signedSha256: string | null
  sizeBytes: number | null
  pageCount: number | null
  username: string | null
  createdAt: string
  signedAt: string | null
  expiresAt: string | null
  downloadUrl: string | null
  verifyUrl: string | null
  periodLabel: string | null
}

export interface PreviewResponse {
  html: string
  warnings: string[]
  periodLabel: string
}

export interface VerifyReportResponse {
  reportNumber: string | null
  reportCode: ReportCode | null
  periodLabel: string | null
  generatedAt: string | null
  generatedByName: string | null
  sha256: string | null
  signatureHash: string | null
  signedAt: string | null
  signedByName: string | null
  signed: boolean
  valid: boolean
}

export interface GenerateReportRequest {
  code: ReportCode
  filters: Record<string, unknown>
  format?: ReportFormat
  /**
   * Hint para assinar imediatamente apos gerar. O backend atual ignora se
   * nao implementado; o hook chama /sign em sequencia quando true.
   */
  signImmediately?: boolean
}

export interface PreviewRequest {
  code: ReportCode
  filters: Record<string, unknown>
}

export interface SignReportRequest {
  signerName?: string
  signerRegistration?: string
}

export interface ExecutionsFilter {
  code?: ReportCode
  status?: string
  from?: string
  to?: string
  /** Nao suportado pelo backend F1 - reservado para slice futuro. */
  user?: string
  page?: number
  size?: number
}

/** Formato da pagina devolvida pelo Spring Data. */
export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

/**
 * Forma crua que o backend devolve para a definicao. O service achata
 * para {@link ReportDefinition} (com filterSpec aninhado).
 */
export interface ReportDefinitionRawResponse {
  code: ReportCode
  name: string
  description: string
  category: ReportCategory
  supportedFormats: ReportFormat[] | string[]
  filters: ReportFilterField[]
  roleAccess: string[]
  signatureRequired: boolean
  previewSupported: boolean
  retentionDays: number
  legalBasis: string
}

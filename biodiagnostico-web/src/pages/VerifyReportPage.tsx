import { AlertTriangle, CheckCircle2, FileSignature, History, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import type { VerifyReportResponse } from '../types/reportsV2'
import { useVerifyReport } from '../hooks/useReportsV2'
import { LoadingSpinner } from '../components/ui'

/**
 * Pagina publica de verificacao de laudo (Fluxo D).
 *
 * <p>Rota: {@code /r/verify/:token}. O parametro pode ser um TOKEN estavel
 * (embutido no QR Code) OU um SHA-256 de 64 hex (retrocompat). Nao depende de
 * autenticacao; o endpoint {@code /api/reports/v2/verify/{param}} tambem e
 * publico (permitAll no SecurityConfig).
 *
 * <p>A decisao de UI segue o campo autoritativo {@code status} (enumerado).
 * O frontend NAO recalcula validade nem deriva estado a partir de hashes:
 * <ul>
 *   <li>VALID_SIGNED -&gt; banner verde "Documento valido e assinado"</li>
 *   <li>VALID_UNSIGNED -&gt; banner azul "Documento valido (nao assinado)"</li>
 *   <li>SUPERSEDED -&gt; banner ambar "Versao substituida" (hash preliminar)</li>
 *   <li>NOT_FOUND -&gt; banner vermelho "Hash desconhecido"</li>
 *   <li>Erro de rede -&gt; banner neutro com ponteiro para tentar de novo</li>
 * </ul>
 */
export function VerifyReportPage() {
  // O segmento da rota e :token, mas semanticamente aceita token OU hash.
  const { token } = useParams<{ token: string }>()
  const query = useVerifyReport(token)

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white py-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 sm:px-6">
          <div className="rounded-xl bg-green-100 p-2 text-green-800">
            <FileSignature className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Biodiagnóstico</h1>
            <p className="text-xs text-neutral-500">Verificação pública de laudo</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {query.isLoading ? (
          <div className="flex min-h-56 items-center justify-center">
            <LoadingSpinner size="lg" className="text-green-800" />
          </div>
        ) : query.isError ? (
          <div className="rounded-2xl border border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
            <p>Não foi possível consultar o serviço de verificação agora.</p>
            <p className="mt-2 text-xs text-neutral-500">
              Tente novamente em instantes. Se o problema persistir, contate o laboratório.
            </p>
          </div>
        ) : query.data ? (
          <VerifyResult data={query.data} param={token ?? ''} />
        ) : null}

        <footer className="mt-10 text-center">
          <Link to="/login" className="text-sm text-neutral-500 underline hover:text-neutral-800">
            Voltar para login
          </Link>
        </footer>
      </main>
    </div>
  )
}

interface VerifyResultProps {
  data: VerifyReportResponse
  /** Token/hash informado na URL (eco para o caso NOT_FOUND). */
  param: string
}

function VerifyResult({ data, param }: VerifyResultProps) {
  switch (data.status) {
    case 'VALID_SIGNED':
      return <ValidSignedResult data={data} />
    case 'VALID_UNSIGNED':
      return <ValidUnsignedResult data={data} />
    case 'SUPERSEDED':
      return <SupersededResult data={data} />
    case 'NOT_FOUND':
    default:
      return <NotFoundResult param={param} />
  }
}

/** VALID_SIGNED: hash autoritativo = signatureHash (versao entregue). */
function ValidSignedResult({ data }: { data: VerifyReportResponse }) {
  return (
    <div className="space-y-4">
      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-900"
      >
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-base font-semibold">Documento válido e assinado</p>
          <p className="mt-1 text-sm">
            Este laudo foi gerado e assinado digitalmente pelo Biodiagnóstico.
          </p>
        </div>
      </div>

      <ReportDetailsCard data={data} showSignatureFields />

      <HashPanel>
        <HashRow
          label="SHA-256 do arquivo assinado (versão entregue)"
          value={data.signatureHash}
          authoritative
        />
        <HashRow label="SHA-256 original" value={data.sha256} />
      </HashPanel>
    </div>
  )
}

/** VALID_UNSIGNED: hash autoritativo = sha256 (versao entregue, sem assinatura). */
function ValidUnsignedResult({ data }: { data: VerifyReportResponse }) {
  return (
    <div className="space-y-4">
      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl border border-blue-300 bg-blue-50 p-5 text-blue-900"
      >
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-base font-semibold">Documento válido (não assinado)</p>
          <p className="mt-1 text-sm">
            Laudo gerado pelo Biodiagnóstico, ainda sem assinatura do responsável técnico.
          </p>
        </div>
      </div>

      <ReportDetailsCard data={data} />

      <HashPanel>
        <HashRow
          label="SHA-256 do arquivo (versão entregue)"
          value={data.sha256}
          authoritative
        />
      </HashPanel>
    </div>
  )
}

/**
 * SUPERSEDED: o hash informado e de uma versao preliminar (nao assinada) de um
 * laudo que ja foi assinado depois. A versao oficial entregue e a assinada.
 */
function SupersededResult({ data }: { data: VerifyReportResponse }) {
  return (
    <div className="space-y-4">
      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900"
      >
        <History className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-base font-semibold">Versão substituída</p>
          <p className="mt-1 text-sm">
            Este hash corresponde a uma versão preliminar (não assinada) deste laudo. A versão
            oficial entregue é a assinada. Compare o hash do seu arquivo com o SHA-256 da versão
            assinada abaixo.
          </p>
        </div>
      </div>

      <ReportDetailsCard data={data} showSignatureFields />

      <HashPanel>
        <HashRow
          label="SHA-256 da versão assinada (oficial)"
          value={data.signatureHash}
          authoritative
        />
      </HashPanel>
    </div>
  )
}

/** NOT_FOUND: hash desconhecido (comportamento de !valid). */
function NotFoundResult({ param }: { param: string }) {
  return (
    <div className="space-y-4">
      <div
        role="alert"
        className="flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 p-5 text-red-800"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-base font-semibold">Hash desconhecido</p>
          <p className="mt-1 text-sm">
            Este documento <strong>não foi emitido pelo Biodiagnóstico</strong> ou o hash informado
            não corresponde a nenhum laudo registrado.
          </p>
          <p className="mt-2 break-all font-mono text-xs text-red-700">{param}</p>
        </div>
      </div>
    </div>
  )
}

/** Cartao com metadados do laudo (numero, periodo, geracao, assinatura). */
function ReportDetailsCard({
  data,
  showSignatureFields,
}: {
  data: VerifyReportResponse
  showSignatureFields?: boolean
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Item label="Número do laudo" value={data.reportNumber} mono />
        <Item label="Tipo" value={data.reportCode} />
        <Item label="Período" value={data.periodLabel} />
        <Item
          label="Gerado em"
          value={data.generatedAt ? new Date(data.generatedAt).toLocaleString('pt-BR') : null}
        />
        <Item label="Gerado por" value={data.generatedByName} />
        {showSignatureFields ? (
          <>
            <Item label="Assinado por" value={data.signedByName} />
            <Item
              label="Assinado em"
              value={data.signedAt ? new Date(data.signedAt).toLocaleString('pt-BR') : null}
            />
          </>
        ) : null}
      </dl>
    </div>
  )
}

/** Painel agrupando hashes (autoritativo + secundarios). */
function HashPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="space-y-4">{children}</div>
    </div>
  )
}

/**
 * Linha de hash. {@code authoritative} destaca o hash que o verificador deve
 * comparar com o arquivo em maos (propriedade regulatoria central).
 */
function HashRow({
  label,
  value,
  authoritative,
}: {
  label: string
  value: string | null
  authoritative?: boolean
}) {
  return (
    <div
      className={
        authoritative
          ? 'rounded-xl border border-neutral-300 bg-neutral-50 p-4'
          : undefined
      }
    >
      <p
        className={`text-xs uppercase tracking-wider ${
          authoritative ? 'font-semibold text-neutral-700' : 'text-neutral-500'
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1 break-all font-mono text-xs ${
          authoritative ? 'text-neutral-900' : 'text-neutral-600'
        }`}
      >
        {value ?? '-'}
      </p>
    </div>
  )
}

function Item({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className={`mt-1 text-sm text-neutral-800 ${mono ? 'font-mono' : ''}`}>{value ?? '-'}</dd>
    </div>
  )
}

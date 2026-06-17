import { AlertCircle, Loader2, Sparkles } from 'lucide-react'

/**
 * Rotulo padrao de assistencia por IA. Reforca que a saida e apoio a decisao
 * e nao substitui avaliacao tecnica — exigencia da Onda 1 de recursos de IA.
 */
export function AiAssistDisclaimer({ className }: { className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 text-xs text-neutral-500 ${className ?? ''}`}>
      <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none text-violet-500" />
      <span>Explicação gerada por IA — apoio à decisão, não substitui avaliação técnica.</span>
    </p>
  )
}

interface AiAssistResultProps {
  isPending: boolean
  isError: boolean
  text: string | null
  loadingLabel?: string
  errorLabel?: string
  /** Quando true, exibe o rotulo de assistencia abaixo do texto. */
  withDisclaimer?: boolean
}

/**
 * Bloco de exibicao da resposta de IA com estados de loading e erro.
 * Visual alinhado ao restante do PROIN (cantos arredondados, tipografia legivel).
 *
 * Observacao: o backend pode devolver um texto de fallback amigavel em vez de
 * erro HTTP. Nesse caso {@code isError} e false e o texto e mostrado normalmente.
 */
export function AiAssistResult({
  isPending,
  isError,
  text,
  loadingLabel = 'Analisando com IA...',
  errorLabel = 'Não foi possível concluir a análise agora. Tente novamente.',
  withDisclaimer = true,
}: AiAssistResultProps) {
  if (isPending) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-sm text-violet-900">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{loadingLabel}</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
        <span>{errorLabel}</span>
      </div>
    )
  }

  if (!text) {
    return null
  }

  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50/50 px-4 py-3">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">{text}</p>
      {withDisclaimer ? <AiAssistDisclaimer className="mt-3" /> : null}
    </div>
  )
}

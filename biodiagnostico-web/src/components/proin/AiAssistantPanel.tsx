import { AlertCircle, Loader2, MessageCircle, Send, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAiAnalysis } from '../../hooks/useAiAnalysis'
import { Button, Modal } from '../ui'
import { AiAssistDisclaimer } from './AiAssistShared'
import { AiMarkdown } from './AiMarkdown'

interface AiAssistantPanelProps {
  /** Area de CQ do contexto atual; enviada ao backend quando presente. */
  area?: string
  areaLabel?: string
  buttonLabel?: string
}

interface ChatTurn {
  id: number
  question: string
  /** Resposta da IA. null enquanto a chamada esta em andamento. */
  answer: string | null
  /** True quando a chamada falhou (erro HTTP real, nao fallback do backend). */
  failed: boolean
}

/**
 * E13 — Painel de chat "pergunte aos seus dados de CQ".
 *
 * Reusa {@code useAiAnalysis} (POST /ai/analyze). Envia a pergunta como
 * {@code prompt} junto da {@code area} do contexto atual, e mantem um historico
 * simples em memoria (perdido ao fechar/recarregar). Read-only e assistivo:
 * nao altera nenhuma regra de CQ.
 *
 * Observacao: o backend pode devolver um texto de fallback amigavel em vez de
 * erro HTTP. Nesse caso a resposta e tratada normalmente (mostrada como texto).
 */
export function AiAssistantPanel({ area, areaLabel, buttonLabel = 'Assistente de IA' }: AiAssistantPanelProps) {
  const analysis = useAiAnalysis()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const turnIdRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Mantem a conversa rolada para a ultima mensagem.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [turns])

  const submit = async () => {
    const question = input.trim()
    if (!question || analysis.isPending) return
    const id = ++turnIdRef.current
    setTurns((prev) => [...prev, { id, question, answer: null, failed: false }])
    setInput('')
    try {
      const response = await analysis.mutateAsync({
        prompt: question,
        ...(area ? { area } : {}),
      })
      setTurns((prev) => prev.map((turn) => (turn.id === id ? { ...turn, answer: response } : turn)))
    } catch {
      setTurns((prev) => prev.map((turn) => (turn.id === id ? { ...turn, failed: true } : turn)))
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        icon={<Sparkles className="h-4 w-4 text-violet-500" />}
        onClick={() => setIsOpen(true)}
      >
        {buttonLabel}
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Assistente de IA — pergunte aos seus dados de CQ"
        size="lg"
        footer={
          <div className="space-y-2">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void submit()
                  }
                }}
                rows={2}
                placeholder={
                  areaLabel
                    ? `Pergunte sobre o CQ de ${areaLabel}... (Enter envia, Shift+Enter quebra linha)`
                    : 'Pergunte sobre seus dados de CQ... (Enter envia, Shift+Enter quebra linha)'
                }
                className="min-h-[3rem] flex-1 resize-none rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
              />
              <Button
                onClick={() => void submit()}
                loading={analysis.isPending}
                disabled={!input.trim()}
                icon={<Send className="h-4 w-4" />}
              >
                Enviar
              </Button>
            </div>
            <AiAssistDisclaimer />
          </div>
        }
      >
        <div ref={scrollRef} className="max-h-[50vh] space-y-4 overflow-y-auto">
          {turns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 px-5 py-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                <MessageCircle className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-medium text-neutral-700">
                Faça perguntas em linguagem natural sobre os registros de CQ
                {areaLabel ? ` de ${areaLabel}` : ''}.
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Ex.: "Houve alguma tendência de alta nas últimas semanas?" ou "Quais exames mais reprovaram?"
              </p>
            </div>
          ) : (
            turns.map((turn) => (
              <div key={turn.id} className="space-y-2">
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-green-800 px-4 py-2.5 text-sm text-white">
                    {turn.question}
                  </div>
                </div>
                <div className="flex justify-start">
                  {turn.answer === null && !turn.failed ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-2.5 text-sm text-violet-900">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Analisando seus dados de CQ...</span>
                    </div>
                  ) : turn.failed ? (
                    <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                      <span>Não foi possível responder agora. Tente novamente.</span>
                    </div>
                  ) : (
                    <div className="max-w-[85%] rounded-2xl border border-violet-100 bg-violet-50/50 px-4 py-2.5">
                      <AiMarkdown>{turn.answer ?? ''}</AiMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </>
  )
}

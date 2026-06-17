import axios from 'axios'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useCreatePostCalibration } from '../../hooks/useQcRecords'
import { useSuggestObservation } from '../../hooks/useAiAssist'
import type { PostCalibrationRecord, QcRecord } from '../../types'
import { Button, Input, Modal, TextArea, useToast } from '../ui'
import { AiAssistDisclaimer } from './AiAssistShared'

interface PostCalibrationModalProps {
  record: QcRecord | null
  isOpen: boolean
  onClose: () => void
  onSaved?: (postCalibration: PostCalibrationRecord) => void
}

export function PostCalibrationModal({ record, isOpen, onClose, onSaved }: PostCalibrationModalProps) {
  const { toast } = useToast()
  const mutation = useCreatePostCalibration(record?.id ?? '')
  const suggestObservation = useSuggestObservation()
  const [form, setForm] = useState(() => buildInitialForm(record))

  // C8 — Sugere uma observacao a partir do contexto que o modal ja conhece.
  // A sugestao apenas preenche o campo; o operador edita e decide salvar.
  const handleSuggestObservation = async () => {
    if (!record || suggestObservation.isPending) return
    const violations = record.violations?.length
      ? record.violations.map((v) => `${v.rule} (${v.description})`).join('; ')
      : 'sem violação Westgard registrada'
    const contextParts = [
      `Exame: ${record.examName}`,
      `Área: ${record.area}`,
      `Nível: ${record.level}`,
      `Valor original: ${record.value.toFixed(2)}`,
      `Alvo: ${record.targetValue.toFixed(2)} (DP ${record.targetSd.toFixed(2)})`,
      `CV original: ${record.cv.toFixed(2)}% (limite ${record.cvLimit.toFixed(2)}%)`,
      `Status do CQ: ${record.status}`,
      `Regras Westgard: ${violations}`,
    ]
    if (form.postCalibrationValue) {
      contextParts.push(`Novo valor pós-calibração informado: ${Number(form.postCalibrationValue).toFixed(2)}`)
    }
    try {
      const suggestion = await suggestObservation.mutateAsync({
        kind: 'post-calibration',
        context: contextParts.join(' | '),
      })
      setForm((current) => ({ ...current, notes: suggestion }))
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível gerar a sugestão agora.'))
    }
  }

  const handleSubmit = async () => {
    // Trava anti-duplo-submit: ignora cliques enquanto a gravacao esta em voo.
    if (mutation.isPending) return
    if (!record || !form.postCalibrationValue) {
      toast.warning('Informe o valor pós-calibração para salvar.')
      return
    }
    if (!record.needsCalibration) {
      toast.warning('A pós-calibração só pode ser registrada quando existe pendência corretiva ativa.')
      return
    }

    try {
      const response = await mutation.mutateAsync({
        date: form.date,
        postCalibrationValue: Number(form.postCalibrationValue),
        analyst: form.analyst,
        notes: form.notes,
      })
      onSaved?.(response)
      toast.success('Pós-calibração registrada com sucesso.')
      onClose()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível salvar a pós-calibração.'))
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Pós-Calibração"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={mutation.isPending}>
            Salvar
          </Button>
        </div>
      }
    >
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        O pós-calibração registra a ação corretiva vinculada a este evento. Ele não altera o status nem reescreve o resultado original do CQ.
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Exame" value={record?.examName ?? ''} readOnly />
        <Input label="Valor original" value={record ? record.value.toFixed(2) : ''} readOnly />
        <Input
          label="Data"
          type="date"
          value={form.date}
          onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
        />
        <Input
          label="Valor pós-calibração"
          type="number"
          step="0.01"
          value={form.postCalibrationValue}
          onChange={(event) => setForm((current) => ({ ...current, postCalibrationValue: event.target.value }))}
        />
        <Input
          label="Analista"
          value={form.analyst}
          onChange={(event) => setForm((current) => ({ ...current, analyst: event.target.value }))}
        />
      </div>
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-neutral-700">Observações</span>
          <button
            type="button"
            onClick={handleSuggestObservation}
            disabled={!record || suggestObservation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
            title="Sugestão assistiva gerada por IA"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {suggestObservation.isPending ? 'Gerando...' : 'Sugerir observação'}
          </button>
        </div>
        <TextArea
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
        />
        {suggestObservation.data ? <AiAssistDisclaimer className="mt-2" /> : null}
      </div>
    </Modal>
  )
}

function getApiErrorMessage(error: unknown, fallbackMessage: string) {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.message
    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage
    }
  }
  return fallbackMessage
}

function buildInitialForm(record: QcRecord | null) {
  return {
    date: record?.date ?? new Date().toISOString().slice(0, 10),
    postCalibrationValue: '',
    analyst: '',
    notes: '',
  }
}

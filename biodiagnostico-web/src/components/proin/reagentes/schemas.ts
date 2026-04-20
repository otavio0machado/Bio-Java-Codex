import { z } from 'zod'
import type { ReagentLotRequest, StockMovementRequest } from '../../../types'

interface ValidationResult {
  message: string
}

const lotSchema = z
  .object({
    manufacturer: z.string().trim().min(1, 'Informe o fabricante do lote.'),
    expiryDate: z.string().trim().min(1, 'Informe a data de validade.'),
    startDate: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const startDate = value.startDate?.trim()
    if (startDate && value.expiryDate < startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiryDate'],
        message: 'A data de validade não pode ser anterior à data de início de uso.',
      })
    }
  })

const movementSchema = z.object({
  type: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE']),
  quantity: z.number().positive('Informe a quantidade.'),
  responsible: z.string().trim().min(1, 'Informe o responsável pela movimentação.'),
  reason: z.string().nullable().optional(),
})

export function validateLotForm(form: ReagentLotRequest): ValidationResult | null {
  if (!form.name?.trim() || !form.lotNumber?.trim()) {
    return { message: 'Preencha nome e lote.' }
  }

  const result = lotSchema.safeParse(form)
  if (!result.success) {
    return { message: result.error.issues[0]?.message ?? 'Erro ao validar lote.' }
  }

  return null
}

export function validateMovementForm(
  form: StockMovementRequest,
  currentStock: number,
): ValidationResult | null {
  const result = movementSchema.safeParse(form)
  if (!result.success) {
    return { message: result.error.issues[0]?.message ?? 'Erro ao validar movimentação.' }
  }

  const nextStock =
    form.type === 'ENTRADA'
      ? currentStock + form.quantity
      : form.type === 'SAIDA'
        ? currentStock - form.quantity
        : form.quantity

  const zeroingSaida = form.type === 'SAIDA' && nextStock === 0
  if ((form.type === 'AJUSTE' || zeroingSaida) && !form.reason) {
    return {
      message: 'Selecione um motivo: AJUSTE e saídas que zeram o estoque exigem justificativa.',
    }
  }

  return null
}

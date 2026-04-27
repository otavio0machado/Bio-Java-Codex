import { z } from 'zod'
import type { ReagentLotRequest, StockMovementRequest } from '../../../types'
import { CATEGORIES, REAGENT_STATUS_OPTIONS, TEMPS } from './constants'

interface ValidationResult {
  message: string
}

const STATUS_VALUES = REAGENT_STATUS_OPTIONS.map((option) => option.value)

/**
 * Validacao zod do form de cadastro/edicao de lote pos-refator v2.
 *
 * Regras canonicas (espelha o contrato 4.1):
 * - 9 obrigatorios canonicos: label, lotNumber, manufacturer, category,
 *   currentStock, status, expiryDate, location, storageTemp.
 * - {@code receivedDate <= openedDate <= expiryDate} quando ambos presentes.
 * - {@code label} e {@code lotNumber} sao trimados; falha se vazios apos trim.
 *
 * Backend tambem aplica essas regras; o front e a primeira linha de defesa
 * para responder com mensagem amigavel sem round-trip.
 */
const lotSchema = z
  .object({
    label: z.string().trim().min(1, 'Informe a etiqueta do lote.'),
    lotNumber: z.string().trim().min(1, 'Informe o número do lote.'),
    manufacturer: z.string().trim().min(1, 'Informe o fabricante do lote.'),
    category: z.string().refine((value) => CATEGORIES.includes(value), {
      message: 'Selecione uma categoria válida.',
    }),
    currentStock: z
      .number({ error: 'Informe a quantidade atual.' })
      .min(0, 'A quantidade atual não pode ser negativa.'),
    status: z.string().refine((value) => STATUS_VALUES.includes(value as never), {
      message: 'Selecione um status válido.',
    }),
    expiryDate: z.string().trim().min(1, 'Informe a data de validade.'),
    location: z.string().trim().min(1, 'Informe a localização física do lote.'),
    storageTemp: z.string().refine((value) => TEMPS.includes(value), {
      message: 'Selecione uma temperatura válida.',
    }),
    receivedDate: z.string().trim().optional().or(z.literal('')),
    openedDate: z.string().trim().optional().or(z.literal('')),
    supplier: z.string().trim().optional().or(z.literal('')),
  })
  .superRefine((value, ctx) => {
    const expiry = value.expiryDate?.trim()
    const received = value.receivedDate?.trim()
    const opened = value.openedDate?.trim()

    if (received && expiry && expiry < received) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiryDate'],
        message: 'A data de validade não pode ser anterior à data de recebimento.',
      })
    }

    if (opened && expiry && expiry < opened) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiryDate'],
        message: 'A data de validade não pode ser anterior à data de abertura.',
      })
    }

    if (received && opened && opened < received) {
      ctx.addIssue({
        code: 'custom',
        path: ['openedDate'],
        message: 'A data de abertura não pode ser anterior ao recebimento.',
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
  const result = lotSchema.safeParse(form)
  if (!result.success) {
    return { message: result.error.issues[0]?.message ?? 'Erro ao validar lote.' }
  }

  return null
}

export function validateMovementForm(
  form: StockMovementRequest,
  currentStock: number,
  canReceiveEntry = true,
): ValidationResult | null {
  const result = movementSchema.safeParse(form)
  if (!result.success) {
    return { message: result.error.issues[0]?.message ?? 'Erro ao validar movimentação.' }
  }

  if (!canReceiveEntry && form.type === 'ENTRADA') {
    return { message: 'Lote vencido não aceita nova entrada. Crie um novo lote.' }
  }

  if (form.type === 'SAIDA' && form.quantity > currentStock) {
    return { message: `Estoque insuficiente para esta saída. Estoque atual: ${currentStock}.` }
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

import type { ReagentStatus } from '../../../types'

export const MOVEMENT_REASONS: { value: string; label: string }[] = [
  { value: 'CONTAGEM_FISICA', label: 'Contagem física' },
  { value: 'QUEBRA', label: 'Quebra / perda' },
  { value: 'CONTAMINACAO', label: 'Contaminação' },
  { value: 'CORRECAO', label: 'Correção de lançamento' },
  { value: 'VENCIMENTO', label: 'Vencimento' },
  { value: 'OUTRO', label: 'Outro (ver observação)' },
]

/**
 * Lista fechada de categorias canonicas. DEVE ficar espelhada com
 * {@code CategoryRegistry.ALL} no backend (ReagentService valida pelo conjunto).
 */
export const CATEGORIES = [
  'Bioquímica',
  'Hematologia',
  'Imunologia',
  'Parasitologia',
  'Microbiologia',
  'Uroanálise',
  'Kit Diagnóstico',
  'Controle CQ',
  'Calibrador',
  'Geral',
]

/**
 * Lista fechada de temperaturas canonicas. Espelhada com
 * {@code StorageTempRegistry.ALL} no backend.
 */
export const TEMPS = ['2-8°C', '15-25°C (Ambiente)', '-20°C', '-80°C']

/**
 * Status canonicos pos-refator v2. Substitui o conjunto antigo
 * {@code ativo/em_uso/inativo/vencido/quarentena}.
 */
export const REAGENT_STATUS_OPTIONS: { value: ReagentStatus; label: string }[] = [
  { value: 'em_estoque', label: 'Em estoque' },
  { value: 'em_uso', label: 'Em uso' },
  { value: 'fora_de_estoque', label: 'Fora de estoque' },
  { value: 'vencido', label: 'Vencido' },
]

/**
 * Tabs do drilldown de etiqueta — espelha o conjunto canonico mais "todos".
 */
export const TAG_STATUS_TABS = [
  'todos',
  'em_estoque',
  'em_uso',
  'fora_de_estoque',
  'vencido',
] as const

export const REAGENT_STATUS_LABELS: Record<string, string> = {
  em_estoque: 'Em estoque',
  em_uso: 'Em uso',
  fora_de_estoque: 'Fora de estoque',
  vencido: 'Vencido',
}

export const MOVEMENT_REASONS: { value: string; label: string }[] = [
  { value: 'CONTAGEM_FISICA', label: 'Contagem física' },
  { value: 'QUEBRA', label: 'Quebra / perda' },
  { value: 'CONTAMINACAO', label: 'Contaminação' },
  { value: 'CORRECAO', label: 'Correção de lançamento' },
  { value: 'VENCIMENTO', label: 'Vencimento' },
  { value: 'OUTRO', label: 'Outro (ver observação)' },
]

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

export const UNITS = ['mL', 'L', 'unidades', 'testes', 'frascos', 'kits', 'g', 'mg']

export const TEMPS = ['2-8°C', '15-25°C (Ambiente)', '-20°C', '-80°C']

export const TAG_STATUS_TABS = ['todos', 'ativo', 'em_uso', 'inativo', 'vencido'] as const

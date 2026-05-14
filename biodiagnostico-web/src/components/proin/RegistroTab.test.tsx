import { describe, expect, it } from 'vitest'
import { getOperationalReferences } from './qcReferenceResolution'
import type { QcReferenceValue } from '../../types'

function reference(overrides: Partial<QcReferenceValue> = {}): QcReferenceValue {
  return {
    id: overrides.id ?? 'ref-1',
    name: overrides.name ?? 'Controle Glicose',
    level: overrides.level ?? 'Normal',
    lotNumber: overrides.lotNumber,
    manufacturer: overrides.manufacturer,
    targetValue: overrides.targetValue ?? 100,
    targetSd: overrides.targetSd ?? 5,
    cvMaxThreshold: overrides.cvMaxThreshold ?? 10,
    validFrom: overrides.validFrom ?? '2026-05-01',
    validUntil: overrides.validUntil ?? '',
    isActive: overrides.isActive ?? true,
    notes: overrides.notes,
    exam: overrides.exam ?? {
      id: 'exam-1',
      name: 'Glicose',
      area: 'bioquimica',
      unit: 'mg/dL',
      isActive: true,
    },
  }
}

describe('getOperationalReferences', () => {
  it('retorna a referência vigente do exame sem exigir lote operacional', () => {
    const refs = [reference({ lotNumber: 'LEGADO-01' })]

    expect(getOperationalReferences(refs, 'bioquimica', 'Glicose', '2026-05-14')).toHaveLength(1)
  })

  it('mantém múltiplas referências para o fluxo bloquear ambiguidade', () => {
    const refs = [
      reference({ id: 'ref-1', name: 'Controle A' }),
      reference({ id: 'ref-2', name: 'Controle B' }),
    ]

    expect(getOperationalReferences(refs, 'bioquimica', 'Glicose', '2026-05-14')).toHaveLength(2)
  })

  it('ignora referência vencida ou de nível legado diferente', () => {
    const refs = [
      reference({ id: 'vencida', validUntil: '2026-05-01' }),
      reference({ id: 'alto', level: 'Alto' }),
    ]

    expect(getOperationalReferences(refs, 'bioquimica', 'Glicose', '2026-05-14')).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { getOperationalReferences, pickRecommendedReference, rankOperationalReferences } from './qcReferenceResolution'
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

  it('mantém múltiplas referências vigentes como candidatas para o ranking de desambiguação', () => {
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

describe('rankOperationalReferences (B4)', () => {
  const date = '2026-05-14'

  it('coloca a referência com validFrom mais recente em primeiro', () => {
    const refs = [
      reference({ id: 'antiga', validFrom: '2026-01-01' }),
      reference({ id: 'recente', validFrom: '2026-05-01' }),
      reference({ id: 'media', validFrom: '2026-03-01' }),
    ]

    const ranked = rankOperationalReferences(refs, date)

    expect(ranked.map((r) => r.id)).toEqual(['recente', 'media', 'antiga'])
  })

  it('prioriza vigente na data sobre não vigente', () => {
    const refs = [
      reference({ id: 'futura', validFrom: '2026-06-01' }), // ainda não vigente
      reference({ id: 'vigente', validFrom: '2026-01-01', validUntil: '2026-12-31' }),
    ]

    const ranked = rankOperationalReferences(refs, date)

    expect(ranked[0].id).toBe('vigente')
  })

  it('desempata por validUntil mais distante quando validFrom é igual', () => {
    const refs = [
      reference({ id: 'curta', validFrom: '2026-05-01', validUntil: '2026-05-31' }),
      reference({ id: 'longa', validFrom: '2026-05-01', validUntil: '2026-12-31' }),
    ]

    const ranked = rankOperationalReferences(refs, date)

    expect(ranked.map((r) => r.id)).toEqual(['longa', 'curta'])
  })

  it('trata validUntil ausente como validade mais longa no desempate', () => {
    const refs = [
      reference({ id: 'com-validade', validFrom: '2026-05-01', validUntil: '2026-12-31' }),
      reference({ id: 'sem-validade', validFrom: '2026-05-01', validUntil: '' }),
    ]

    const ranked = rankOperationalReferences(refs, date)

    expect(ranked[0].id).toBe('sem-validade')
  })

  it('é determinístico: desempate final estável por id quando datas empatam', () => {
    const refs = [
      reference({ id: 'aaa', validFrom: '2026-05-01', validUntil: '2026-12-31' }),
      reference({ id: 'zzz', validFrom: '2026-05-01', validUntil: '2026-12-31' }),
    ]

    const forward = rankOperationalReferences(refs, date).map((r) => r.id)
    const reversed = rankOperationalReferences([...refs].reverse(), date).map((r) => r.id)

    expect(forward).toEqual(['zzz', 'aaa'])
    expect(reversed).toEqual(['zzz', 'aaa'])
  })

  it('não muta o array original', () => {
    const refs = [
      reference({ id: 'antiga', validFrom: '2026-01-01' }),
      reference({ id: 'recente', validFrom: '2026-05-01' }),
    ]
    const snapshot = refs.map((r) => r.id)

    rankOperationalReferences(refs, date)

    expect(refs.map((r) => r.id)).toEqual(snapshot)
  })
})

describe('pickRecommendedReference (B4)', () => {
  const date = '2026-05-14'

  it('retorna null para lista vazia', () => {
    expect(pickRecommendedReference([], date)).toBeNull()
  })

  it('recomenda a referência iniciada mais recentemente entre as vigentes', () => {
    const refs = [
      reference({ id: 'lote-antigo', validFrom: '2026-01-01', validUntil: '2026-12-31' }),
      reference({ id: 'lote-atual', validFrom: '2026-05-01', validUntil: '2026-12-31' }),
    ]

    expect(pickRecommendedReference(refs, date)?.id).toBe('lote-atual')
  })
})

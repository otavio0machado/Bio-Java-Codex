import { describe, expect, it } from 'vitest'
import { getQcExamUnit, getVisibleQcExams, isQcExamAllowed } from './qcAreas'

describe('catálogo legado de Coagulação', () => {
  it('resolve nomes ignorando caixa e espaços e mantém a ordem canônica', () => {
    const visible = getVisibleQcExams([
      { id: 'ttpa', name: '  ttpa ', area: 'coagulacao' },
      { id: 'atividade', name: ' atividade (%) ', area: 'coagulacao' },
      { id: 'inr', name: 'inr', area: 'coagulacao' },
      { id: 'fibrinogenio', name: 'Fibrinogênio', area: 'coagulacao' },
    ], 'coagulacao')

    expect(visible.map((exam) => [exam.name, exam.unit])).toEqual([
      ['Atividade (%)', '%'],
      ['INR', undefined],
      ['TTPA', 's'],
    ])
    expect(isQcExamAllowed('coagulacao', '  InR ')).toBe(true)
    expect(getQcExamUnit('coagulacao', { name: ' ttPa ', unit: undefined })).toBe('s')
  })
})

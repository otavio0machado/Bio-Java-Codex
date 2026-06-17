import { describe, expect, it } from 'vitest'
import {
  fieldLabel,
  formatConfidence,
  groupSuggestionsByRow,
  isApplicableExamTypo,
  issueLabel,
  resolveTypoExamName,
} from './batchValidationHelpers'
import type { BatchSuggestion } from '../../types'

function suggestion(overrides: Partial<BatchSuggestion> = {}): BatchSuggestion {
  return {
    row: overrides.row ?? 0,
    field: overrides.field ?? 'examName',
    issue: overrides.issue ?? 'TYPO',
    suggestion: overrides.suggestion ?? 'possível erro de digitação → GLICOSE',
    confidence: overrides.confidence ?? 0.9,
  }
}

describe('groupSuggestionsByRow (B5)', () => {
  it('agrupa por linha preservando a ordem de chegada das linhas', () => {
    const groups = groupSuggestionsByRow([
      suggestion({ row: 2, field: 'value' }),
      suggestion({ row: 0, field: 'examName' }),
      suggestion({ row: 2, field: 'targetSd' }),
    ])

    expect(groups.map((g) => g.row)).toEqual([2, 0])
    expect(groups[0].suggestions).toHaveLength(2)
    expect(groups[0].suggestions.map((s) => s.field)).toEqual(['value', 'targetSd'])
    expect(groups[1].suggestions).toHaveLength(1)
  })

  it('retorna vazio quando nao ha sugestoes', () => {
    expect(groupSuggestionsByRow([])).toEqual([])
  })

  it('nao muta o array original', () => {
    const input = [suggestion({ row: 1 }), suggestion({ row: 0 })]
    const snapshot = input.map((s) => s.row)

    groupSuggestionsByRow(input)

    expect(input.map((s) => s.row)).toEqual(snapshot)
  })
})

describe('resolveTypoExamName (B5)', () => {
  const exams = ['Glicose', 'Colesterol Total', 'Triglicerídeos']

  it('casa o nome cadastrado citado no texto da sugestao (case-insensitive)', () => {
    expect(resolveTypoExamName('possível erro de digitação → GLICOSE', exams)).toBe('Glicose')
  })

  it('casa nome composto com acento', () => {
    expect(resolveTypoExamName('você quis dizer Colesterol Total?', exams)).toBe('Colesterol Total')
  })

  it('retorna null quando nenhum exame cadastrado aparece (IA nunca inventa)', () => {
    expect(resolveTypoExamName('valor implausível para o controle', exams)).toBeNull()
  })

  it('retorna null quando ha ambiguidade (mais de um exame citado)', () => {
    expect(resolveTypoExamName('seria Glicose ou Colesterol Total?', exams)).toBeNull()
  })

  it('ignora nomes vazios na lista de exames', () => {
    expect(resolveTypoExamName('aplicar Glicose', ['', 'Glicose'])).toBe('Glicose')
  })
})

describe('isApplicableExamTypo (B5)', () => {
  it('verdadeiro apenas para TYPO em examName', () => {
    expect(isApplicableExamTypo(suggestion({ issue: 'TYPO', field: 'examName' }))).toBe(true)
  })

  it('falso para TYPO em outro campo', () => {
    expect(isApplicableExamTypo(suggestion({ issue: 'TYPO', field: 'value' }))).toBe(false)
  })

  it('falso para outros tipos de problema no examName', () => {
    expect(isApplicableExamTypo(suggestion({ issue: 'UNKNOWN_EXAM', field: 'examName' }))).toBe(false)
  })
})

describe('formatConfidence (B5)', () => {
  it('formata fracao como percentual inteiro', () => {
    expect(formatConfidence(0.92)).toBe('92%')
    expect(formatConfidence(1)).toBe('100%')
    expect(formatConfidence(0)).toBe('0%')
  })

  it('satura fora de [0,1]', () => {
    expect(formatConfidence(1.4)).toBe('100%')
    expect(formatConfidence(-0.2)).toBe('0%')
  })
})

describe('rotulos PT-BR (B5)', () => {
  it('traduz issues conhecidos e cai no valor cru para desconhecidos', () => {
    expect(issueLabel('TYPO')).toBe('Possível erro de digitação')
    expect(issueLabel('UNKNOWN_EXAM')).toBe('Exame não reconhecido')
    expect(issueLabel('FUTURO_DESCONHECIDO')).toBe('FUTURO_DESCONHECIDO')
  })

  it('traduz campos conhecidos e cai no valor cru para desconhecidos', () => {
    expect(fieldLabel('examName')).toBe('exame')
    expect(fieldLabel('targetSd')).toBe('DP')
    expect(fieldLabel('campoNovo')).toBe('campoNovo')
  })
})

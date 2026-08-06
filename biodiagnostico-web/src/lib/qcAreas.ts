import type { LabArea, QcExam } from '../types'

export const QC_AREA_OPTIONS: ReadonlyArray<{ value: LabArea; label: string }> = [
  { value: 'bioquimica', label: 'Bioquímica' },
  { value: 'coagulacao', label: 'Coagulação' },
  { value: 'hematologia', label: 'Hematologia' },
  { value: 'imunologia', label: 'Imunologia' },
  { value: 'parasitologia', label: 'Parasitologia' },
  { value: 'microbiologia', label: 'Microbiologia' },
  { value: 'uroanalise', label: 'Uroanálise' },
]

export const COAGULATION_EXAMS = [
  { name: 'Atividade (%)', unit: '%' },
  { name: 'INR', unit: null },
  { name: 'TTPA', unit: 's' },
] as const

export function normalizeQcExamName(examName: string): string {
  return examName.trim().toLocaleLowerCase('pt-BR')
}

const COAGULATION_EXAMS_BY_NAME = new Map(
  COAGULATION_EXAMS.map((exam) => [normalizeQcExamName(exam.name), exam]),
)

export function hasFullQcCycle(area: string): boolean {
  return area === 'bioquimica' || area === 'coagulacao'
}

export function isQcExamAllowed(area: string, examName: string): boolean {
  return area !== 'coagulacao' || COAGULATION_EXAMS_BY_NAME.has(normalizeQcExamName(examName))
}

export function getVisibleQcExams(exams: QcExam[], area: string): QcExam[] {
  if (area !== 'coagulacao') return exams

  const byName = new Map(exams.map((exam) => [normalizeQcExamName(exam.name), exam]))
  return COAGULATION_EXAMS.flatMap((definition) => {
    const exam = byName.get(normalizeQcExamName(definition.name))
    return exam ? [{ ...exam, name: definition.name, unit: definition.unit ?? undefined }] : []
  })
}

export function getQcExamUnit(area: string, exam: Pick<QcExam, 'name' | 'unit'>): string | null {
  if (area === 'coagulacao') {
    return COAGULATION_EXAMS_BY_NAME.get(normalizeQcExamName(exam.name))?.unit ?? null
  }
  return exam.unit?.trim() || null
}

export function formatQcExamOption(area: string, exam: Pick<QcExam, 'name' | 'unit'>): string {
  const unit = getQcExamUnit(area, exam)
  return `${exam.name} — ${unit ?? 'sem unidade'}`
}

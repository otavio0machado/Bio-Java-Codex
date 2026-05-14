import type { QcReferenceValue } from '../../types'

export function getOperationalReferences(
  references: QcReferenceValue[],
  area: string,
  examName: string,
  date: string,
) {
  if (!examName) return []
  return references.filter((reference) =>
    reference.isActive &&
    reference.exam?.area === area &&
    reference.exam.name === examName &&
    (reference.level || 'Normal').toLowerCase() === 'normal' &&
    isRefValidOnDate(reference, date),
  )
}

function isRefValidOnDate(ref: QcReferenceValue, date: string) {
  const d = date || new Date().toISOString().slice(0, 10)
  const from = ref.validFrom?.slice(0, 10)
  const until = ref.validUntil?.slice(0, 10)
  return (!from || from <= d) && (!until || until >= d)
}

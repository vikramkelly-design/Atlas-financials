export function gradeColor(grade) {
  if (grade === 'A' || grade === 'B+') return 'var(--color-positive)'
  if (grade === 'B' || grade === 'C+') return 'var(--color-gold)'
  return 'var(--color-negative)'
}

export function gradeBg(grade) {
  if (grade === 'A' || grade === 'B+') return 'var(--color-positive-light)'
  if (grade === 'B' || grade === 'C+') return 'var(--color-gold-15)'
  return 'var(--color-negative-light)'
}

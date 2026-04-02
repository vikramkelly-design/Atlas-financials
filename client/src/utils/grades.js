export function gradeColor(grade) {
  if (grade === 'A' || grade === 'B+') return 'var(--color-success)'
  if (grade === 'B' || grade === 'C+') return 'var(--color-accent)'
  return 'var(--color-danger)'
}

export function gradeBg(grade) {
  if (grade === 'A' || grade === 'B+') return 'var(--color-success-light)'
  if (grade === 'B' || grade === 'C+') return 'var(--color-accent-15)'
  return 'var(--color-danger-light)'
}

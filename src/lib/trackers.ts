/** Prefer explicit chapter number; else parse leading digits from title. */
export function chapterProgressValue(input: {
  number?: number | null
  title?: string | null
  sortIndex?: number | null
}): number {
  if (typeof input.number === 'number' && Number.isFinite(input.number) && input.number > 0) {
    return Math.floor(input.number)
  }
  const title = input.title ?? ''
  const match = title.match(/(\d+(?:\.\d+)?)/)
  if (match) {
    const n = Number(match[1])
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  if (typeof input.sortIndex === 'number' && input.sortIndex >= 0) {
    return Math.floor(input.sortIndex) + 1
  }
  return 0
}

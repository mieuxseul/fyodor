import { describe, expect, it } from 'vitest'

import { chapterProgressValue } from '@/lib/trackers'

describe('chapterProgressValue', () => {
  it('prefers explicit chapter numbers', () => {
    expect(chapterProgressValue({ number: 12, title: 'Chapter 99' })).toBe(12)
  })

  it('parses digits from titles', () => {
    expect(chapterProgressValue({ title: 'Ch. 7 - Storm' })).toBe(7)
  })

  it('falls back to sort index', () => {
    expect(chapterProgressValue({ sortIndex: 3 })).toBe(4)
  })
})

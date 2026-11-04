import { beforeEach, describe, expect, it } from 'vitest'

import {
  hasNewChapters,
  markChaptersSeen,
  newChapterDelta,
  recordKnownChapterCount,
} from '@/lib/chapter-seen'

describe('chapter-seen', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('seeds without a badge on first sighting', () => {
    recordKnownChapterCount('atsu', 'title-1', 10)
    expect(hasNewChapters('atsu', 'title-1')).toBe(false)
    expect(newChapterDelta('atsu', 'title-1')).toBe(0)
  })

  it('shows a badge when known count rises above seen', () => {
    recordKnownChapterCount('atsu', 'title-1', 10)
    markChaptersSeen('atsu', 'title-1', 10)
    recordKnownChapterCount('atsu', 'title-1', 13)
    expect(hasNewChapters('atsu', 'title-1')).toBe(true)
    expect(newChapterDelta('atsu', 'title-1')).toBe(3)
  })

  it('clears the badge after markChaptersSeen', () => {
    recordKnownChapterCount('mangadex', 'md-1', 5)
    markChaptersSeen('mangadex', 'md-1', 5)
    recordKnownChapterCount('mangadex', 'md-1', 8)
    markChaptersSeen('mangadex', 'md-1', 8)
    expect(hasNewChapters('mangadex', 'md-1')).toBe(false)
  })
})
